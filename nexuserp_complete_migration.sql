-- ============================================================
--  NexusERP — Complete Supabase SQL Migration
--  Run this ONCE in Supabase SQL Editor on a fresh project.
--  Covers: extensions, helpers, all tables, RLS, indexes,
--          sequences, and the permission system.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────────────────────────
--  PART 1 — MULTI-TENANT FOUNDATION
-- ────────────────────────────────────────────────────────────

-- 1.1  TENANTS
--      Each client (Prince Bazar, Agora, …) is one row.
--      Adding a new client = INSERT one row. Zero code changes.
CREATE TABLE tenants (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT        NOT NULL UNIQUE,
  slug       TEXT        NOT NULL UNIQUE,   -- url-safe: "prince-bazar"
  logo_url   TEXT,
  plan       TEXT        NOT NULL DEFAULT 'starter'
               CHECK (plan IN ('starter','growth','enterprise')),
  status     TEXT        NOT NULL DEFAULT 'active'
               CHECK (status IN ('active','suspended','trial')),
  settings   JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.2  TENANT USERS
--      Maps Supabase auth users → tenant + role.
--      One user belongs to exactly one tenant.
CREATE TABLE tenant_users (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID        NOT NULL REFERENCES tenants(id)    ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL DEFAULT 'user'
               CHECK (role IN ('owner','admin','manager','user','viewer')),
  full_name  TEXT,
  avatar_url TEXT,
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);
CREATE INDEX idx_tenant_users_user_id ON tenant_users(user_id);

-- 1.3  TENANT MODULES
--      Which modules each tenant has installed.
--      Prince Bazar: sales, purchase  |  Agora: hr, configuration
CREATE TABLE tenant_modules (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id)    ON DELETE CASCADE,
  module_id    TEXT        NOT NULL,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  installed_by UUID        REFERENCES auth.users(id),
  UNIQUE (tenant_id, module_id)
);
CREATE INDEX idx_tenant_modules_tenant ON tenant_modules(tenant_id);

-- 1.4  TENANT USER PERMISSIONS
--      Per-user, per-module action overrides.
--      NULL = inherit role default. true/false = explicit override.
--      Only store rows that differ from the role default.
CREATE TABLE tenant_user_permissions (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id)    ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id   TEXT        NOT NULL,
  can_view    BOOLEAN     DEFAULT NULL,
  can_create  BOOLEAN     DEFAULT NULL,
  can_edit    BOOLEAN     DEFAULT NULL,
  can_delete  BOOLEAN     DEFAULT NULL,
  can_approve BOOLEAN     DEFAULT NULL,
  can_export  BOOLEAN     DEFAULT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID        REFERENCES auth.users(id),
  UNIQUE (tenant_id, user_id, module_id)
);
CREATE INDEX idx_tup_tenant_user ON tenant_user_permissions(tenant_id, user_id);

-- ────────────────────────────────────────────────────────────
--  PART 2 — HELPER FUNCTIONS (used by all RLS policies)
-- ────────────────────────────────────────────────────────────

-- Returns the tenant_id of the currently logged-in user.
-- Used in every RLS policy — keeps policies DRY.
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT tenant_id
  FROM   tenant_users
  WHERE  user_id   = auth.uid()
    AND  is_active = true
  LIMIT  1;
$$;

-- Returns true if the current JWT has is_super_admin=true in user_metadata.
-- Super admins bypass all tenant isolation.
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'is_super_admin')::BOOLEAN,
    false
  );
$$;

-- Returns permission rows for a given user + tenant.
-- Called on login to build the in-memory permission map.
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID, p_tenant_id UUID)
RETURNS TABLE (
  module_id   TEXT,
  can_view    BOOLEAN,
  can_create  BOOLEAN,
  can_edit    BOOLEAN,
  can_delete  BOOLEAN,
  can_approve BOOLEAN,
  can_export  BOOLEAN
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT module_id, can_view, can_create, can_edit,
         can_delete, can_approve, can_export
  FROM   tenant_user_permissions
  WHERE  tenant_id = p_tenant_id
    AND  user_id   = p_user_id;
$$;

-- ────────────────────────────────────────────────────────────
--  PART 3 — RLS ON FOUNDATION TABLES
-- ────────────────────────────────────────────────────────────

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin_all"  ON tenants FOR ALL    USING (is_super_admin());
CREATE POLICY "user_own_tenant"  ON tenants FOR SELECT USING (id = current_tenant_id());

ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin_all"  ON tenant_users FOR ALL    USING (is_super_admin());
CREATE POLICY "read_own_tenant"  ON tenant_users FOR SELECT USING (tenant_id = current_tenant_id());
CREATE POLICY "admin_manage"     ON tenant_users FOR ALL    USING (
  tenant_id = current_tenant_id() AND
  EXISTS (SELECT 1 FROM tenant_users tu
          WHERE tu.user_id = auth.uid() AND tu.tenant_id = current_tenant_id()
            AND tu.role IN ('owner','admin'))
);

ALTER TABLE tenant_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin_all"  ON tenant_modules FOR ALL    USING (is_super_admin());
CREATE POLICY "read_own"         ON tenant_modules FOR SELECT USING (tenant_id = current_tenant_id());
CREATE POLICY "admin_manage"     ON tenant_modules FOR ALL    USING (
  tenant_id = current_tenant_id() AND
  EXISTS (SELECT 1 FROM tenant_users tu
          WHERE tu.user_id = auth.uid() AND tu.tenant_id = current_tenant_id()
            AND tu.role IN ('owner','admin'))
);

ALTER TABLE tenant_user_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin_all"  ON tenant_user_permissions FOR ALL    USING (is_super_admin());
CREATE POLICY "read_own_tenant"  ON tenant_user_permissions FOR SELECT USING (tenant_id = current_tenant_id());
CREATE POLICY "admin_manage"     ON tenant_user_permissions FOR ALL    USING (
  tenant_id = current_tenant_id() AND
  EXISTS (SELECT 1 FROM tenant_users tu
          WHERE tu.user_id = auth.uid() AND tu.tenant_id = current_tenant_id()
            AND tu.role IN ('owner','admin'))
);

-- ────────────────────────────────────────────────────────────
--  PART 4 — BUSINESS TABLES (all carry tenant_id)
-- ────────────────────────────────────────────────────────────

-- ── Purchase ─────────────────────────────────────────────────
CREATE TABLE vendors (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  contact_name TEXT,
  email        TEXT,
  phone        TEXT,
  address      TEXT,
  country      TEXT,
  category     TEXT,
  rating       NUMERIC(3,1) DEFAULT 0,
  status       TEXT         DEFAULT 'active'
                 CHECK (status IN ('active','inactive','blacklisted')),
  created_at   TIMESTAMPTZ  DEFAULT now(),
  updated_at   TIMESTAMPTZ  DEFAULT now()
);

CREATE TABLE purchase_orders (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_number  TEXT        NOT NULL,
  vendor_id     UUID        REFERENCES vendors(id),
  status        TEXT        DEFAULT 'draft'
                  CHECK (status IN ('draft','pending','approved','received','cancelled')),
  order_date    DATE        NOT NULL DEFAULT CURRENT_DATE,
  expected_date DATE,
  reference     TEXT,
  notes         TEXT,
  subtotal      NUMERIC(15,2) DEFAULT 0,
  tax_amount    NUMERIC(15,2) DEFAULT 0,
  total_amount  NUMERIC(15,2) DEFAULT 0,
  created_by    UUID        REFERENCES auth.users(id),
  approved_by   UUID        REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, order_number)
);

CREATE TABLE purchase_order_lines (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  purchase_order_id UUID        NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_name      TEXT        NOT NULL,
  quantity          NUMERIC(10,2) NOT NULL,
  unit_price        NUMERIC(15,2) NOT NULL,
  tax_rate          NUMERIC(5,2)  DEFAULT 0,
  total_price       NUMERIC(15,2)
);

CREATE TABLE rfqs (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rfq_number    TEXT        NOT NULL,
  vendor_id     UUID        REFERENCES vendors(id),
  status        TEXT        DEFAULT 'draft'
                  CHECK (status IN ('draft','sent','received','expired','converted')),
  deadline      DATE,
  notes         TEXT,
  quoted_amount NUMERIC(15,2),
  created_by    UUID        REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, rfq_number)
);

-- ── Sales ─────────────────────────────────────────────────────
CREATE TABLE customers (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  contact_name TEXT,
  email        TEXT,
  phone        TEXT,
  address      TEXT,
  country      TEXT,
  industry     TEXT,
  status       TEXT        DEFAULT 'active' CHECK (status IN ('active','inactive')),
  credit_limit NUMERIC(15,2) DEFAULT 0,
  created_at   TIMESTAMPTZ  DEFAULT now(),
  updated_at   TIMESTAMPTZ  DEFAULT now()
);

CREATE TABLE sales_orders (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_number   TEXT        NOT NULL,
  customer_id    UUID        REFERENCES customers(id),
  status         TEXT        DEFAULT 'draft'
                   CHECK (status IN ('draft','confirmed','invoiced','done','cancelled')),
  order_date     DATE        NOT NULL DEFAULT CURRENT_DATE,
  delivery_date  DATE,
  salesperson_id UUID        REFERENCES auth.users(id),
  notes          TEXT,
  subtotal       NUMERIC(15,2) DEFAULT 0,
  tax_amount     NUMERIC(15,2) DEFAULT 0,
  total_amount   NUMERIC(15,2) DEFAULT 0,
  created_at     TIMESTAMPTZ   DEFAULT now(),
  updated_at     TIMESTAMPTZ   DEFAULT now(),
  UNIQUE (tenant_id, order_number)
);

CREATE TABLE sales_order_lines (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sales_order_id UUID        NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_name   TEXT        NOT NULL,
  quantity       NUMERIC(10,2) NOT NULL,
  unit_price     NUMERIC(15,2) NOT NULL,
  discount_pct   NUMERIC(5,2)  DEFAULT 0,
  tax_rate       NUMERIC(5,2)  DEFAULT 0,
  total_price    NUMERIC(15,2)
);

-- ── Inventory ─────────────────────────────────────────────────
CREATE TABLE warehouses (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code         TEXT        NOT NULL,
  name         TEXT        NOT NULL,
  location     TEXT,
  manager_id   UUID        REFERENCES auth.users(id),
  capacity_pct NUMERIC(5,2) DEFAULT 0,
  status       TEXT         DEFAULT 'active',
  created_at   TIMESTAMPTZ  DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE products (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sku             TEXT        NOT NULL,
  name            TEXT        NOT NULL,
  description     TEXT,
  category        TEXT,
  unit_of_measure TEXT        DEFAULT 'unit',
  cost_price      NUMERIC(15,2) DEFAULT 0,
  sale_price      NUMERIC(15,2) DEFAULT 0,
  reorder_qty     NUMERIC(10,2) DEFAULT 0,
  status          TEXT          DEFAULT 'active'
                    CHECK (status IN ('active','inactive','archived')),
  created_at      TIMESTAMPTZ   DEFAULT now(),
  updated_at      TIMESTAMPTZ   DEFAULT now(),
  UNIQUE (tenant_id, sku)
);

CREATE TABLE stock_moves (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  move_number         TEXT        NOT NULL,
  product_id          UUID        NOT NULL REFERENCES products(id),
  move_type           TEXT        NOT NULL
                        CHECK (move_type IN ('incoming','outgoing','internal','adjustment')),
  quantity            NUMERIC(10,2) NOT NULL,
  source_warehouse_id UUID        REFERENCES warehouses(id),
  dest_warehouse_id   UUID        REFERENCES warehouses(id),
  reference           TEXT,
  move_date           DATE        DEFAULT CURRENT_DATE,
  created_by          UUID        REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, move_number)
);

-- ── Accounts ──────────────────────────────────────────────────
CREATE TABLE chart_of_accounts (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code         TEXT        NOT NULL,
  name         TEXT        NOT NULL,
  account_type TEXT        NOT NULL
                 CHECK (account_type IN ('asset','liability','equity','revenue','expense')),
  parent_id    UUID        REFERENCES chart_of_accounts(id),
  is_active    BOOLEAN     DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE invoices (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_number TEXT        NOT NULL,
  customer_id    UUID        REFERENCES customers(id),
  sales_order_id UUID        REFERENCES sales_orders(id),
  status         TEXT        DEFAULT 'draft'
                   CHECK (status IN ('draft','sent','paid','overdue','cancelled')),
  invoice_date   DATE        DEFAULT CURRENT_DATE,
  due_date       DATE,
  subtotal       NUMERIC(15,2) DEFAULT 0,
  tax_amount     NUMERIC(15,2) DEFAULT 0,
  total_amount   NUMERIC(15,2) DEFAULT 0,
  paid_amount    NUMERIC(15,2) DEFAULT 0,
  notes          TEXT,
  created_by     UUID        REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, invoice_number)
);

CREATE TABLE bills (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bill_number       TEXT        NOT NULL,
  vendor_id         UUID        REFERENCES vendors(id),
  purchase_order_id UUID        REFERENCES purchase_orders(id),
  status            TEXT        DEFAULT 'draft'
                      CHECK (status IN ('draft','posted','paid','cancelled')),
  bill_date         DATE        DEFAULT CURRENT_DATE,
  due_date          DATE,
  total_amount      NUMERIC(15,2) DEFAULT 0,
  paid_amount       NUMERIC(15,2) DEFAULT 0,
  created_at        TIMESTAMPTZ   DEFAULT now(),
  UNIQUE (tenant_id, bill_number)
);

-- ── HR ─────────────────────────────────────────────────────────
CREATE TABLE departments (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  code       TEXT,
  manager_id UUID,
  parent_id  UUID        REFERENCES departments(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE employees (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_number TEXT        NOT NULL,
  user_id         UUID        REFERENCES auth.users(id),
  first_name      TEXT        NOT NULL,
  last_name       TEXT        NOT NULL,
  email           TEXT        NOT NULL,
  phone           TEXT,
  department_id   UUID        REFERENCES departments(id),
  position        TEXT,
  manager_id      UUID        REFERENCES employees(id),
  employment_type TEXT        DEFAULT 'full_time'
                    CHECK (employment_type IN ('full_time','part_time','contract','intern')),
  status          TEXT        DEFAULT 'active'
                    CHECK (status IN ('active','inactive','terminated')),
  hire_date       DATE,
  salary          NUMERIC(15,2),
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, employee_number),
  UNIQUE (tenant_id, email)
);

CREATE TABLE leave_requests (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID        NOT NULL REFERENCES employees(id),
  leave_type  TEXT        NOT NULL
                CHECK (leave_type IN ('annual','sick','emergency','unpaid','maternity','paternity')),
  start_date  DATE        NOT NULL,
  end_date    DATE        NOT NULL,
  days_count  NUMERIC(4,1),
  reason      TEXT,
  status      TEXT        DEFAULT 'pending'
                CHECK (status IN ('pending','approved','rejected','cancelled')),
  approved_by UUID        REFERENCES employees(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Assets ─────────────────────────────────────────────────────
CREATE TABLE asset_categories (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                TEXT        NOT NULL,
  code                TEXT,
  depreciation_method TEXT        DEFAULT 'straight_line'
                        CHECK (depreciation_method IN ('straight_line','declining_balance','units_of_production')),
  useful_life_years   INT,
  salvage_value_pct   NUMERIC(5,2) DEFAULT 0,
  created_at          TIMESTAMPTZ  DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE assets (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  asset_number        TEXT        NOT NULL,
  name                TEXT        NOT NULL,
  description         TEXT,
  category_id         UUID        REFERENCES asset_categories(id),
  purchase_date       DATE,
  purchase_cost       NUMERIC(15,2) NOT NULL,
  book_value          NUMERIC(15,2),
  salvage_value       NUMERIC(15,2) DEFAULT 0,
  useful_life_years   INT,
  depreciation_method TEXT        DEFAULT 'straight_line',
  location            TEXT,
  assigned_to         UUID        REFERENCES employees(id),
  status              TEXT        DEFAULT 'active'
                        CHECK (status IN ('active','maintenance','disposed','fully_depreciated')),
  serial_number       TEXT,
  warranty_expiry     DATE,
  vendor_id           UUID        REFERENCES vendors(id),
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, asset_number)
);

CREATE TABLE asset_depreciation_logs (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  asset_id            UUID        NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  period_date         DATE        NOT NULL,
  opening_value       NUMERIC(15,2),
  depreciation_amount NUMERIC(15,2),
  closing_value       NUMERIC(15,2),
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE asset_maintenance_logs (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  asset_id              UUID        NOT NULL REFERENCES assets(id),
  maintenance_type      TEXT        CHECK (maintenance_type IN ('preventive','corrective','inspection')),
  description           TEXT,
  cost                  NUMERIC(15,2) DEFAULT 0,
  performed_by          TEXT,
  maintenance_date      DATE        DEFAULT CURRENT_DATE,
  next_maintenance_date DATE,
  created_at            TIMESTAMPTZ DEFAULT now()
);

-- ── Approvals ──────────────────────────────────────────────────
CREATE TABLE approval_workflows (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL,
  module            TEXT        NOT NULL,
  trigger_condition TEXT,
  is_active         BOOLEAN     DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE approval_workflow_steps (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_id   UUID        NOT NULL REFERENCES approval_workflows(id) ON DELETE CASCADE,
  step_order    INT         NOT NULL,
  step_name     TEXT        NOT NULL,
  approver_role TEXT        NOT NULL,
  approval_type TEXT        DEFAULT 'any' CHECK (approval_type IN ('any','all')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE approval_requests (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_number TEXT        NOT NULL,
  workflow_id    UUID        REFERENCES approval_workflows(id),
  title          TEXT        NOT NULL,
  description    TEXT,
  module         TEXT        NOT NULL,
  record_id      UUID,
  record_type    TEXT,
  amount         NUMERIC(15,2),
  priority       TEXT        DEFAULT 'normal'
                   CHECK (priority IN ('low','normal','high','urgent')),
  status         TEXT        DEFAULT 'pending'
                   CHECK (status IN ('pending','approved','rejected','cancelled')),
  current_step   INT         DEFAULT 1,
  requested_by   UUID        REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, request_number)
);

CREATE TABLE approval_actions (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_id  UUID        NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  step_number INT         NOT NULL,
  action      TEXT        NOT NULL CHECK (action IN ('approved','rejected','delegated')),
  actor_id    UUID        REFERENCES auth.users(id),
  comment     TEXT,
  acted_at    TIMESTAMPTZ DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
--  PART 5 — BULK RLS ON ALL BUSINESS TABLES
--  Single pattern: tenant_id = current_tenant_id()
--  Super admins bypass via is_super_admin()
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'vendors','purchase_orders','purchase_order_lines','rfqs',
    'customers','sales_orders','sales_order_lines',
    'warehouses','products','stock_moves',
    'chart_of_accounts','invoices','bills',
    'departments','employees','leave_requests',
    'asset_categories','assets','asset_depreciation_logs','asset_maintenance_logs',
    'approval_workflows','approval_workflow_steps','approval_requests','approval_actions'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format(
      'CREATE POLICY "super_admin_%1$s" ON %1$I FOR ALL USING (is_super_admin())', tbl);
    EXECUTE format(
      'CREATE POLICY "tenant_%1$s" ON %1$I FOR ALL USING (tenant_id = current_tenant_id())', tbl);
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────
--  PART 6 — PERFORMANCE INDEXES
-- ────────────────────────────────────────────────────────────
CREATE INDEX ON purchase_orders       (tenant_id, status);
CREATE INDEX ON purchase_orders       (tenant_id, vendor_id);
CREATE INDEX ON sales_orders          (tenant_id, status);
CREATE INDEX ON sales_orders          (tenant_id, customer_id);
CREATE INDEX ON customers             (tenant_id);
CREATE INDEX ON vendors               (tenant_id);
CREATE INDEX ON products              (tenant_id);
CREATE INDEX ON stock_moves           (tenant_id, product_id);
CREATE INDEX ON employees             (tenant_id, department_id);
CREATE INDEX ON assets                (tenant_id, status);
CREATE INDEX ON invoices              (tenant_id, status);
CREATE INDEX ON approval_requests     (tenant_id, status);
CREATE INDEX ON approval_requests     (tenant_id, requested_by);
CREATE INDEX ON tenant_user_permissions (tenant_id, user_id);

-- ────────────────────────────────────────────────────────────
--  PART 7 — ORDER NUMBER GENERATORS
-- ────────────────────────────────────────────────────────────
CREATE SEQUENCE po_number_seq  START 1;
CREATE SEQUENCE so_number_seq  START 1;
CREATE SEQUENCE inv_number_seq START 1;
CREATE SEQUENCE asset_seq      START 1;
CREATE SEQUENCE apr_seq        START 1;

CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'PO-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('po_number_seq')::TEXT,4,'0');
$$;
CREATE OR REPLACE FUNCTION generate_so_number()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'SO-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('so_number_seq')::TEXT,4,'0');
$$;
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'INV-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('inv_number_seq')::TEXT,4,'0');
$$;
CREATE OR REPLACE FUNCTION generate_asset_number()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'AST-'||LPAD(nextval('asset_seq')::TEXT,4,'0');
$$;
CREATE OR REPLACE FUNCTION generate_apr_number()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'APR-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('apr_seq')::TEXT,4,'0');
$$;

-- ────────────────────────────────────────────────────────────
--  PART 8 — SEED DEMO DATA
--  After running this file:
--  1. In Supabase Auth Dashboard, create these users manually:
--       superadmin@nexuserp.com
--         user_metadata: { "is_super_admin": true, "full_name": "Super Admin" }
--       admin@prince-bazar.com
--         user_metadata: { "full_name": "Prince Bazar Admin" }
--       admin@agora.com
--         user_metadata: { "full_name": "Agora Admin" }
--  2. Copy their UUIDs, then run the INSERT statements below
--     replacing the placeholder UUIDs.
-- ────────────────────────────────────────────────────────────

-- Step A — Insert demo tenants
INSERT INTO tenants (name, slug, plan) VALUES
  ('Prince Bazar', 'prince-bazar', 'growth'),
  ('Agora',        'agora',        'starter')
ON CONFLICT (slug) DO NOTHING;

-- Step B — After creating auth users, run these (replace UUIDs):
-- ──────────────────────────────────────────────────────────────
-- REPLACE 'prince-bazar-user-uuid' with actual UUID from Supabase Auth
-- REPLACE 'agora-user-uuid' with actual UUID from Supabase Auth
-- ──────────────────────────────────────────────────────────────

-- INSERT INTO tenant_users (tenant_id, user_id, role, full_name)
-- SELECT t.id, 'prince-bazar-user-uuid'::uuid, 'owner', 'Prince Bazar Admin'
-- FROM tenants t WHERE t.slug = 'prince-bazar';

-- INSERT INTO tenant_users (tenant_id, user_id, role, full_name)
-- SELECT t.id, 'agora-user-uuid'::uuid, 'owner', 'Agora Admin'
-- FROM tenants t WHERE t.slug = 'agora';

-- Step C — Install modules per tenant
-- INSERT INTO tenant_modules (tenant_id, module_id)
-- SELECT t.id, m.module_id FROM tenants t,
--   (VALUES ('sales'),('purchase')) AS m(module_id)
-- WHERE t.slug = 'prince-bazar';

-- INSERT INTO tenant_modules (tenant_id, module_id)
-- SELECT t.id, m.module_id FROM tenants t,
--   (VALUES ('hr'),('configuration')) AS m(module_id)
-- WHERE t.slug = 'agora';

-- ────────────────────────────────────────────────────────────
--  DONE — Schema is ready.
--  Use the Super Admin panel in NexusERP to create tenants
--  and manage everything without writing SQL manually.
-- ────────────────────────────────────────────────────────────
