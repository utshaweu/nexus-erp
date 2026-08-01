-- ============================================================================
--  NexusERP — Complete Database Schema (single-file consolidation)
--  ---------------------------------------------------------------------------
--  Replaces all 26 previous .sql files. Run ONCE in the Supabase SQL Editor.
--  Fully idempotent — safe to re-run on an existing database.
--
--  Contents
--    PART 1  Extensions
--    PART 2  Helper functions (RLS primitives)
--    PART 3  Foundation tables + RLS  (tenants, users, modules, permissions)
--    PART 4  Module catalogue table + RLS
--    PART 5  Business tables         (purchase, sales, inventory, accounts,
--                                     legacy HR, HR, assets, approvals, reports)
--    PART 6  Bulk RLS on business tables
--    PART 7  Views                   (inventory_levels)
--    PART 8  Sequences + number generators
--    PART 9  Application RPCs
--    PART 10 updated_at triggers
--    PART 11 Performance indexes
--    PART 12 Module catalogue seed + feature-permission wiring
--    PART 13 Optional seeds          (demo tenants, standard chart of accounts)
--
--  ---------------------------------------------------------------------------
--  CONSOLIDATION NOTES — conflicts between the old files and how they resolved
--  ---------------------------------------------------------------------------
--  The old files disagreed in a few places. Where two files defined the same
--  object differently, the definition that MATCHES THE APPLICATION CODE wins.
--  Every such decision is listed here; nothing else was altered.
--
--   1. journal_entry_lines — supplement_migration used debit/credit;
--      accounts_addendum used debit_amount/credit_amount.
--      → KEPT debit_amount/credit_amount (modules/accounts/api/journals.js).
--
--   2. journal_entries — supplement had fiscal_period_id/posted_by and
--      status CHECK (...,'reversed'); accounts had total_debit/total_credit
--      and status CHECK (...,'cancelled').
--      → KEPT the accounts shape (journals.js writes total_debit/total_credit,
--        JOURNAL_STATUS in shared/lib/constants.js = draft|posted|cancelled),
--        PLUS supplement's fiscal_period_id + posted_by as nullable extras so
--        no capability is lost.
--
--   3. bill_lines — supplement used product_name; accounts used description.
--      → KEPT description (modules/accounts/api/bills.js).
--
--   4. get_trial_balance() — its body referenced jel.debit / jel.credit, which
--      do not exist under the column names resolved in (1). Left as-is the
--      function would fail to compile and abort this script.
--      → BODY UPDATED to jel.debit_amount / jel.credit_amount. This is the one
--        behavioural fix in this file: the Reports → Financial trial balance
--        now reads the columns the app actually writes.
--
--   5. current_tenant_id() and the three admin_manage policies — the base
--      migration's versions caused infinite RLS recursion; nexuserp_rls_fix.sql
--      replaced them.
--      → ONLY the fixed (SECURITY DEFINER / current_user_role()) versions are
--        emitted here. The recursive originals are not reproduced.
--
--   6. asset_maintenance_logs.maintenance_type — the v1 CHECK allowed only
--      preventive|corrective|inspection, but MAINTENANCE_TYPE in
--      shared/lib/constants.js also offers 'emergency'.
--      → CHECK widened to include 'emergency' (a superset; nothing that was
--        previously accepted is now rejected).
--
--   7. Duplicate number generators kept the later definition:
--      generate_bill_number  → bill_number_seq  (accounts_addendum)
--      generate_asset_number → asset_number_seq (assets_addendum, year-prefixed)
--      generate_je_number is retained alongside generate_journal_entry_number;
--      the app calls the latter.
--
--   8. inventory_levels — the inventory_addendum version (includes reorder_qty)
--      supersedes the supplement version. get_low_stock_items() needs it.
--
--   9. supabase_schema.sql and supabase_permissions_migration.sql were earlier
--      generations of nexuserp_complete_migration.sql. Folded in; they carried
--      no unique objects.
--
--  10. Tables the app no longer reads are still created so nothing is dropped:
--      departments, employees, leave_requests (superseded by hr_*),
--      asset_depreciation_logs (superseded by asset_depreciation_schedules),
--      reports_saved_queries (superseded by report_saved_filters).
--
--  RE-RUNNING ON AN EXISTING DATABASE: every CREATE TABLE is IF NOT EXISTS, so
--  existing tables are left exactly as they are. If your database was built
--  with supplement_migration's journal_entry_lines (debit/credit columns),
--  PART 9's get_trial_balance will fail to compile — rename those two columns
--  to debit_amount/credit_amount first, or skip that one statement.
-- ============================================================================


-- ============================================================================
--  PART 1 — EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================================
--  PART 2 — HELPER FUNCTIONS
--  Used by every RLS policy. SECURITY DEFINER on the two that read
--  tenant_users is what prevents infinite RLS recursion.
-- ============================================================================

-- Tenant of the currently logged-in user.
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT tenant_id
  FROM   tenant_users
  WHERE  user_id   = auth.uid()
    AND  is_active = true
  LIMIT  1;
$$;

-- True when the JWT carries user_metadata.is_super_admin = true.
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'is_super_admin')::BOOLEAN,
    false
  );
$$;

-- Role of the current user within their tenant. Replaces the self-referential
-- EXISTS subquery that used to live inside the admin_manage policies.
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role
  FROM   tenant_users
  WHERE  user_id   = auth.uid()
    AND  tenant_id = current_tenant_id()
    AND  is_active = true
  LIMIT  1;
$$;

-- Generic updated_at touch trigger, shared by every table that has the column.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ============================================================================
--  PART 3 — FOUNDATION TABLES
-- ============================================================================

-- 3.1  TENANTS — one row per client company.
CREATE TABLE IF NOT EXISTS tenants (
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

-- 3.2  TENANT USERS — maps Supabase auth users to a tenant + role.
CREATE TABLE IF NOT EXISTS tenant_users (
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

-- 3.3  TENANT MODULES — which modules each tenant has installed.
CREATE TABLE IF NOT EXISTS tenant_modules (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id)    ON DELETE CASCADE,
  module_id    TEXT        NOT NULL,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  installed_by UUID        REFERENCES auth.users(id),
  UNIQUE (tenant_id, module_id)
);

-- 3.4  TENANT USER PERMISSIONS — per-user, per-module/feature overrides.
--      NULL action = inherit the role default; true/false = explicit override.
--      feature_id '' = module-level row; a non-empty value scopes the override
--      to one menu item (module_catalog.menu_items[].requiredPermission.featureId).
--      '' is used instead of NULL so the UNIQUE stays a plain index, which
--      Supabase's upsert(..., { onConflict }) requires.
CREATE TABLE IF NOT EXISTS tenant_user_permissions (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id)    ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id   TEXT        NOT NULL,
  feature_id  TEXT        NOT NULL DEFAULT '',
  can_view    BOOLEAN     DEFAULT NULL,
  can_create  BOOLEAN     DEFAULT NULL,
  can_edit    BOOLEAN     DEFAULT NULL,
  can_delete  BOOLEAN     DEFAULT NULL,
  can_approve BOOLEAN     DEFAULT NULL,
  can_export  BOOLEAN     DEFAULT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID        REFERENCES auth.users(id)
);

-- Backfill for databases created before the feature_id column existed.
ALTER TABLE tenant_user_permissions
  ADD COLUMN IF NOT EXISTS feature_id TEXT NOT NULL DEFAULT '';

-- Swap the 3-column uniqueness for the 4-column one (feature-aware).
ALTER TABLE tenant_user_permissions
  DROP CONSTRAINT IF EXISTS tenant_user_permissions_tenant_id_user_id_module_id_key;

DO $$ BEGIN
  ALTER TABLE tenant_user_permissions
    ADD CONSTRAINT tenant_user_permissions_tenant_id_user_id_module_id_feature_id_key
    UNIQUE (tenant_id, user_id, module_id, feature_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ── RLS — foundation tables ─────────────────────────────────────────────────

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "super_admin_all"     ON tenants;
DROP POLICY IF EXISTS "user_own_tenant"     ON tenants;
DROP POLICY IF EXISTS "admin_update_tenant" ON tenants;
CREATE POLICY "super_admin_all" ON tenants FOR ALL    USING (is_super_admin());
CREATE POLICY "user_own_tenant" ON tenants FOR SELECT USING (id = current_tenant_id());
-- Lets tenant admins/owners save Company settings (Configuration → Company).
CREATE POLICY "admin_update_tenant" ON tenants FOR UPDATE
  USING      (id = current_tenant_id() AND current_user_role() IN ('owner','admin'))
  WITH CHECK (id = current_tenant_id());

ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "super_admin_all" ON tenant_users;
DROP POLICY IF EXISTS "read_own_tenant" ON tenant_users;
DROP POLICY IF EXISTS "admin_manage"    ON tenant_users;
CREATE POLICY "super_admin_all" ON tenant_users FOR ALL    USING (is_super_admin());
CREATE POLICY "read_own_tenant" ON tenant_users FOR SELECT USING (tenant_id = current_tenant_id());
CREATE POLICY "admin_manage"    ON tenant_users FOR ALL    USING (
  tenant_id = current_tenant_id() AND current_user_role() IN ('owner','admin')
);

ALTER TABLE tenant_modules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "super_admin_all" ON tenant_modules;
DROP POLICY IF EXISTS "read_own"        ON tenant_modules;
DROP POLICY IF EXISTS "admin_manage"    ON tenant_modules;
CREATE POLICY "super_admin_all" ON tenant_modules FOR ALL    USING (is_super_admin());
CREATE POLICY "read_own"        ON tenant_modules FOR SELECT USING (tenant_id = current_tenant_id());
CREATE POLICY "admin_manage"    ON tenant_modules FOR ALL    USING (
  tenant_id = current_tenant_id() AND current_user_role() IN ('owner','admin')
);

ALTER TABLE tenant_user_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "super_admin_all"      ON tenant_user_permissions;
DROP POLICY IF EXISTS "read_own_tenant"      ON tenant_user_permissions;
DROP POLICY IF EXISTS "admin_manage"         ON tenant_user_permissions;
-- Stale names from the superseded supabase_permissions_migration.sql.
DROP POLICY IF EXISTS "super_admin_tup"      ON tenant_user_permissions;
DROP POLICY IF EXISTS "read_own_tenant_tup"  ON tenant_user_permissions;
DROP POLICY IF EXISTS "admin_manage_tup"     ON tenant_user_permissions;
CREATE POLICY "super_admin_all" ON tenant_user_permissions FOR ALL    USING (is_super_admin());
CREATE POLICY "read_own_tenant" ON tenant_user_permissions FOR SELECT USING (tenant_id = current_tenant_id());
CREATE POLICY "admin_manage"    ON tenant_user_permissions FOR ALL    USING (
  tenant_id = current_tenant_id() AND current_user_role() IN ('owner','admin')
);


-- ============================================================================
--  PART 4 — MODULE CATALOGUE
--  Global (not tenant-scoped) display metadata for every module. Merged OVER
--  the code manifest by ModuleRegistry at login, so names/icons/menu items are
--  editable without a deploy. Which modules a tenant has INSTALLED still lives
--  in tenant_modules.
-- ============================================================================

CREATE TABLE IF NOT EXISTS module_catalog (
  module_id    TEXT        PRIMARY KEY,
  name         TEXT        NOT NULL,
  description  TEXT,
  version      TEXT        DEFAULT '1.0.0',
  icon         TEXT,                       -- Lucide icon name
  color        TEXT,
  category     TEXT,
  features     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  dependencies JSONB       NOT NULL DEFAULT '[]'::jsonb,
  menu_items   JSONB       NOT NULL DEFAULT '[]'::jsonb,
  sort_order   INT         NOT NULL DEFAULT 0,
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Non-sensitive global metadata: any authenticated user reads, super admins write.
ALTER TABLE module_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_module_catalog"        ON module_catalog;
DROP POLICY IF EXISTS "super_admin_module_catalog" ON module_catalog;
CREATE POLICY "read_module_catalog"        ON module_catalog FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "super_admin_module_catalog" ON module_catalog FOR ALL    USING (is_super_admin());


-- ============================================================================
--  PART 5 — BUSINESS TABLES
--  Every table carries tenant_id. RLS is applied in bulk in PART 6.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
--  5.1  PURCHASE
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vendors (
  id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         TEXT         NOT NULL,
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

CREATE TABLE IF NOT EXISTS purchase_orders (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_number  TEXT          NOT NULL,
  vendor_id     UUID          REFERENCES vendors(id),
  status        TEXT          DEFAULT 'draft'
                  CHECK (status IN ('draft','pending','approved','received','cancelled')),
  order_date    DATE          NOT NULL DEFAULT CURRENT_DATE,
  expected_date DATE,
  reference     TEXT,
  notes         TEXT,
  subtotal      NUMERIC(15,2) DEFAULT 0,
  tax_amount    NUMERIC(15,2) DEFAULT 0,
  total_amount  NUMERIC(15,2) DEFAULT 0,
  created_by    UUID          REFERENCES auth.users(id),
  approved_by   UUID          REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ   DEFAULT now(),
  updated_at    TIMESTAMPTZ   DEFAULT now(),
  UNIQUE (tenant_id, order_number)
);

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  purchase_order_id UUID          NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_name      TEXT          NOT NULL,
  quantity          NUMERIC(10,2) NOT NULL,
  unit_price        NUMERIC(15,2) NOT NULL,
  tax_rate          NUMERIC(5,2)  DEFAULT 0,
  total_price       NUMERIC(15,2)
);

CREATE TABLE IF NOT EXISTS rfqs (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rfq_number    TEXT          NOT NULL,
  vendor_id     UUID          REFERENCES vendors(id),
  status        TEXT          DEFAULT 'draft'
                  CHECK (status IN ('draft','sent','received','expired','converted')),
  deadline      DATE,
  notes         TEXT,
  quoted_amount NUMERIC(15,2),
  created_by    UUID          REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ   DEFAULT now(),
  UNIQUE (tenant_id, rfq_number)
);

-- RFQ lines hold the requested product + quantity only; pricing comes from the
-- vendor's quote (rfqs.quoted_amount). "Convert to PO" copies these into
-- purchase_order_lines.
CREATE TABLE IF NOT EXISTS rfq_lines (
  id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rfq_id       UUID          NOT NULL REFERENCES rfqs(id)    ON DELETE CASCADE,
  product_name TEXT          NOT NULL,
  quantity     NUMERIC(10,2) NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────────────────
--  5.2  SALES
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customers (
  id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         TEXT          NOT NULL,
  contact_name TEXT,
  email        TEXT,
  phone        TEXT,
  address      TEXT,
  country      TEXT,
  industry     TEXT,
  status       TEXT          DEFAULT 'active' CHECK (status IN ('active','inactive')),
  credit_limit NUMERIC(15,2) DEFAULT 0,
  created_at   TIMESTAMPTZ   DEFAULT now(),
  updated_at   TIMESTAMPTZ   DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales_orders (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_number    TEXT          NOT NULL,
  customer_id     UUID          REFERENCES customers(id),
  status          TEXT          DEFAULT 'draft'
                    CHECK (status IN ('draft','confirmed','invoiced','done','cancelled')),
  order_date      DATE          NOT NULL DEFAULT CURRENT_DATE,
  delivery_date   DATE,
  salesperson_id  UUID          REFERENCES auth.users(id),
  reference       TEXT,                                    -- customer's own PO / external ref
  notes           TEXT,
  subtotal        NUMERIC(15,2) DEFAULT 0,
  tax_amount      NUMERIC(15,2) DEFAULT 0,
  total_amount    NUMERIC(15,2) DEFAULT 0,
  coupon_code     TEXT,                                    -- order-level coupon applied
  coupon_discount NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   DEFAULT now(),
  updated_at      TIMESTAMPTZ   DEFAULT now(),
  UNIQUE (tenant_id, order_number)
);

-- Backfill for databases created before these columns existed.
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS reference       TEXT;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS coupon_code     TEXT;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS coupon_discount NUMERIC(15,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS sales_order_lines (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sales_order_id  UUID          NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_name    TEXT          NOT NULL,
  quantity        NUMERIC(10,2) NOT NULL,
  unit_price      NUMERIC(15,2) NOT NULL,
  discount_pct    NUMERIC(5,2)  DEFAULT 0,
  discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0,  -- fixed-$ alternative to discount_pct
  tax_rate        NUMERIC(5,2)  DEFAULT 0,
  total_price     NUMERIC(15,2),
  is_gift         BOOLEAN       NOT NULL DEFAULT false -- auto-added "Buy X Get Y" free line
);

ALTER TABLE sales_order_lines ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE sales_order_lines ADD COLUMN IF NOT EXISTS is_gift         BOOLEAN       NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS quotations (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quotation_number TEXT          NOT NULL,
  customer_id      UUID          REFERENCES customers(id),
  status           TEXT          DEFAULT 'draft'
                     CHECK (status IN ('draft','sent','accepted','expired','cancelled')),
  quotation_date   DATE          NOT NULL DEFAULT CURRENT_DATE,
  expiry_date      DATE,
  notes            TEXT,
  subtotal         NUMERIC(15,2) DEFAULT 0,
  tax_amount       NUMERIC(15,2) DEFAULT 0,
  total_amount     NUMERIC(15,2) DEFAULT 0,
  created_by       UUID          REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ   DEFAULT now(),
  updated_at       TIMESTAMPTZ   DEFAULT now(),
  UNIQUE (tenant_id, quotation_number)
);

CREATE TABLE IF NOT EXISTS quotation_lines (
  id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quotation_id UUID          NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_name TEXT          NOT NULL,
  quantity     NUMERIC(10,2) NOT NULL,
  unit_price   NUMERIC(15,2) NOT NULL,
  discount_pct NUMERIC(5,2)  DEFAULT 0,
  tax_rate     NUMERIC(5,2)  DEFAULT 0,
  total_price  NUMERIC(15,2)
);

CREATE TABLE IF NOT EXISTS offers (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name             TEXT          NOT NULL,
  description      TEXT,
  offer_type       TEXT          NOT NULL DEFAULT 'percentage'
                     CHECK (offer_type IN ('percentage','fixed_amount','buy_x_get_y')),
  discount_value   NUMERIC(10,2) NOT NULL DEFAULT 0,
  coupon_code      TEXT,
  minimum_amount   NUMERIC(15,2) NOT NULL DEFAULT 0,
  applies_to       TEXT          NOT NULL DEFAULT 'all'
                     CHECK (applies_to IN ('all','product','category','customer')),
  applies_to_ref   TEXT,
  -- "Buy X Get Y": which product/qty must be bought, which is given free.
  buy_product_name TEXT,
  buy_quantity     NUMERIC(10,2),
  get_product_name TEXT,
  get_quantity     NUMERIC(10,2),
  start_date       DATE,
  end_date         DATE,
  usage_limit      INT,
  usage_count      INT           NOT NULL DEFAULT 0,
  is_active        BOOLEAN       NOT NULL DEFAULT true,
  created_by       UUID          REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE offers ADD COLUMN IF NOT EXISTS buy_product_name TEXT;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS buy_quantity     NUMERIC(10,2);
ALTER TABLE offers ADD COLUMN IF NOT EXISTS get_product_name TEXT;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS get_quantity     NUMERIC(10,2);

-- Coupon codes unique per tenant; NULL/empty allowed for non-coupon offers.
CREATE UNIQUE INDEX IF NOT EXISTS idx_offers_tenant_coupon
  ON offers (tenant_id, coupon_code)
  WHERE coupon_code IS NOT NULL AND coupon_code != '';

-- ────────────────────────────────────────────────────────────────────────────
--  5.3  INVENTORY
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS warehouses (
  id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code         TEXT         NOT NULL,
  name         TEXT         NOT NULL,
  location     TEXT,
  manager_id   UUID         REFERENCES auth.users(id),
  capacity_pct NUMERIC(5,2) DEFAULT 0,
  status       TEXT         DEFAULT 'active',
  created_at   TIMESTAMPTZ  DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS products (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sku             TEXT          NOT NULL,
  name            TEXT          NOT NULL,
  description     TEXT,
  category        TEXT,
  unit_of_measure TEXT          DEFAULT 'unit',
  cost_price      NUMERIC(15,2) DEFAULT 0,
  sale_price      NUMERIC(15,2) DEFAULT 0,
  reorder_qty     NUMERIC(10,2) DEFAULT 0,
  status          TEXT          DEFAULT 'active'
                    CHECK (status IN ('active','inactive','archived')),
  created_at      TIMESTAMPTZ   DEFAULT now(),
  updated_at      TIMESTAMPTZ   DEFAULT now(),
  UNIQUE (tenant_id, sku)
);

CREATE TABLE IF NOT EXISTS stock_moves (
  id                  UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  move_number         TEXT          NOT NULL,
  product_id          UUID          NOT NULL REFERENCES products(id),
  move_type           TEXT          NOT NULL
                        CHECK (move_type IN ('incoming','outgoing','internal','adjustment')),
  quantity            NUMERIC(10,2) NOT NULL,
  source_warehouse_id UUID          REFERENCES warehouses(id),
  dest_warehouse_id   UUID          REFERENCES warehouses(id),
  reference           TEXT,
  move_date           DATE          DEFAULT CURRENT_DATE,
  created_by          UUID          REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ   DEFAULT now(),
  UNIQUE (tenant_id, move_number)
);

-- ────────────────────────────────────────────────────────────────────────────
--  5.4  ACCOUNTS
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chart_of_accounts (
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

-- Required by Configuration → Fiscal Periods, and referenced by journal entries.
CREATE TABLE IF NOT EXISTS fiscal_periods (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,          -- e.g. "FY 2025-26 Q1"
  start_date DATE        NOT NULL,
  end_date   DATE        NOT NULL,
  status     TEXT        NOT NULL DEFAULT 'open'
               CHECK (status IN ('open','closed','locked')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS invoices (
  id             UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_number TEXT          NOT NULL,
  customer_id    UUID          REFERENCES customers(id),
  sales_order_id UUID          REFERENCES sales_orders(id),
  status         TEXT          DEFAULT 'draft'
                   CHECK (status IN ('draft','sent','paid','overdue','cancelled')),
  invoice_date   DATE          DEFAULT CURRENT_DATE,
  due_date       DATE,
  subtotal       NUMERIC(15,2) DEFAULT 0,
  tax_amount     NUMERIC(15,2) DEFAULT 0,
  total_amount   NUMERIC(15,2) DEFAULT 0,
  paid_amount    NUMERIC(15,2) DEFAULT 0,
  notes          TEXT,
  created_by     UUID          REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ   DEFAULT now(),
  UNIQUE (tenant_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id  UUID          NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT          NOT NULL,
  quantity    NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price  NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_rate    NUMERIC(5,2)  NOT NULL DEFAULT 0,
  total_price NUMERIC(15,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bills (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bill_number       TEXT          NOT NULL,
  vendor_id         UUID          REFERENCES vendors(id),
  purchase_order_id UUID          REFERENCES purchase_orders(id),
  status            TEXT          DEFAULT 'draft'
                      CHECK (status IN ('draft','posted','paid','cancelled')),
  bill_date         DATE          DEFAULT CURRENT_DATE,
  due_date          DATE,
  total_amount      NUMERIC(15,2) DEFAULT 0,
  paid_amount       NUMERIC(15,2) DEFAULT 0,
  created_at        TIMESTAMPTZ   DEFAULT now(),
  UNIQUE (tenant_id, bill_number)
);

-- See consolidation note 3: `description`, not `product_name`.
CREATE TABLE IF NOT EXISTS bill_lines (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bill_id     UUID          NOT NULL REFERENCES bills(id)   ON DELETE CASCADE,
  description TEXT          NOT NULL,
  quantity    NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price  NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_rate    NUMERIC(5,2)  NOT NULL DEFAULT 0,
  total_price NUMERIC(15,2) NOT NULL DEFAULT 0
);

-- See consolidation note 2: accounts shape + supplement's two extra columns.
CREATE TABLE IF NOT EXISTS journal_entries (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entry_number     TEXT          NOT NULL,
  entry_date       DATE          NOT NULL DEFAULT CURRENT_DATE,
  description      TEXT,
  reference        TEXT,
  status           TEXT          NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','posted','cancelled')),
  total_debit      NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_credit     NUMERIC(15,2) NOT NULL DEFAULT 0,
  fiscal_period_id UUID          REFERENCES fiscal_periods(id),
  created_by       UUID          REFERENCES auth.users(id),
  posted_by        UUID          REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, entry_number)
);

ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS fiscal_period_id UUID REFERENCES fiscal_periods(id);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS posted_by        UUID REFERENCES auth.users(id);

-- See consolidation note 1: debit_amount/credit_amount, not debit/credit.
-- Each entry must balance (SUM(debit_amount) = SUM(credit_amount)); enforced
-- in application code, not by a constraint.
CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID          NOT NULL REFERENCES tenants(id)         ON DELETE CASCADE,
  journal_entry_id UUID          NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id       UUID          NOT NULL REFERENCES chart_of_accounts(id),
  description      TEXT,
  debit_amount     NUMERIC(15,2) NOT NULL DEFAULT 0,
  credit_amount    NUMERIC(15,2) NOT NULL DEFAULT 0
);

-- ────────────────────────────────────────────────────────────────────────────
--  5.5  LEGACY HR  (superseded by the hr_* tables in 5.6)
--  Kept so nothing is dropped. `assets.assigned_to` still references employees.
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS departments (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  code       TEXT,
  manager_id UUID,
  parent_id  UUID        REFERENCES departments(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS employees (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_number TEXT          NOT NULL,
  user_id         UUID          REFERENCES auth.users(id),
  first_name      TEXT          NOT NULL,
  last_name       TEXT          NOT NULL,
  email           TEXT          NOT NULL,
  phone           TEXT,
  department_id   UUID          REFERENCES departments(id),
  position        TEXT,
  manager_id      UUID          REFERENCES employees(id),
  employment_type TEXT          DEFAULT 'full_time'
                    CHECK (employment_type IN ('full_time','part_time','contract','intern')),
  status          TEXT          DEFAULT 'active'
                    CHECK (status IN ('active','inactive','terminated')),
  hire_date       DATE,
  salary          NUMERIC(15,2),
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ   DEFAULT now(),
  updated_at      TIMESTAMPTZ   DEFAULT now(),
  UNIQUE (tenant_id, employee_number),
  UNIQUE (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID         NOT NULL REFERENCES employees(id),
  leave_type  TEXT         NOT NULL
                CHECK (leave_type IN ('annual','sick','emergency','unpaid','maternity','paternity')),
  start_date  DATE         NOT NULL,
  end_date    DATE         NOT NULL,
  days_count  NUMERIC(4,1),
  reason      TEXT,
  status      TEXT         DEFAULT 'pending'
                CHECK (status IN ('pending','approved','rejected','cancelled')),
  approved_by UUID         REFERENCES employees(id),
  created_at  TIMESTAMPTZ  DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────────────────
--  5.6  HR  (the tables the HR module actually uses)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_departments (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  description TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS hr_positions (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  department_id UUID        REFERENCES hr_departments(id) ON DELETE SET NULL,
  title         TEXT        NOT NULL,
  description   TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, title, department_id)
);

-- user_id links an employee to an auth account, enabling the self-service
-- leave/movement portal for non-admin users.
CREATE TABLE IF NOT EXISTS hr_employees (
  id                  UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_number     TEXT          NOT NULL,
  user_id             UUID          REFERENCES auth.users(id) ON DELETE SET NULL,

  first_name          TEXT          NOT NULL,
  last_name           TEXT          NOT NULL,
  email               TEXT,
  phone               TEXT,
  gender              TEXT          CHECK (gender IN ('male','female','other','prefer_not_to_say')),
  date_of_birth       DATE,
  address             TEXT,
  nationality         TEXT,

  join_date           DATE          NOT NULL DEFAULT CURRENT_DATE,
  employment_type     TEXT          NOT NULL DEFAULT 'full_time'
                        CHECK (employment_type IN ('full_time','part_time','contract','intern')),
  status              TEXT          NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','inactive','on_leave','terminated')),
  department_id       UUID          REFERENCES hr_departments(id) ON DELETE SET NULL,
  position_id         UUID          REFERENCES hr_positions(id)   ON DELETE SET NULL,
  manager_id          UUID          REFERENCES hr_employees(id)   ON DELETE SET NULL,

  basic_salary        NUMERIC(15,2) NOT NULL DEFAULT 0,
  bank_account_name   TEXT,
  bank_account_number TEXT,
  bank_name           TEXT,

  notes               TEXT,
  created_by          UUID          REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, employee_number)
);

-- One employee per linked auth user (no dual-linking).
CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_employees_user_id_unique
  ON hr_employees(user_id) WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS hr_leave_types (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  days_allowed    INTEGER     NOT NULL DEFAULT 0,
  employment_type TEXT        NOT NULL DEFAULT 'full_time'
                    CHECK (employment_type IN ('full_time','part_time','contract','intern')),
  is_paid         BOOLEAN     NOT NULL DEFAULT true,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

ALTER TABLE hr_leave_types
  ADD COLUMN IF NOT EXISTS employment_type TEXT NOT NULL DEFAULT 'full_time'
    CHECK (employment_type IN ('full_time','part_time','contract','intern'));

CREATE TABLE IF NOT EXISTS hr_leave_requests (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id)      ON DELETE CASCADE,
  employee_id      UUID        NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  leave_type_id    UUID        REFERENCES hr_leave_types(id)        ON DELETE SET NULL,
  start_date       DATE        NOT NULL,
  end_date         DATE        NOT NULL,
  days_count       INTEGER     NOT NULL DEFAULT 1,
  reason           TEXT,
  status           TEXT        NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','rejected','cancelled')),
  approved_by      UUID        REFERENCES auth.users(id),
  approved_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  created_by       UUID        REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hr_payroll_runs (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_number       TEXT          NOT NULL,
  period_month     INTEGER       NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year      INTEGER       NOT NULL,
  status           TEXT          NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','approved','paid','cancelled')),
  total_gross      NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_deductions NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_net        NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes            TEXT,
  approved_by      UUID          REFERENCES auth.users(id),
  approved_at      TIMESTAMPTZ,
  created_by       UUID          REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, run_number)
);

CREATE TABLE IF NOT EXISTS hr_payroll_entries (
  id             UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID          NOT NULL REFERENCES tenants(id)         ON DELETE CASCADE,
  payroll_run_id UUID          NOT NULL REFERENCES hr_payroll_runs(id) ON DELETE CASCADE,
  employee_id    UUID          NOT NULL REFERENCES hr_employees(id)    ON DELETE CASCADE,
  basic_salary   NUMERIC(15,2) NOT NULL DEFAULT 0,
  allowances     NUMERIC(15,2) NOT NULL DEFAULT 0,
  deductions     NUMERIC(15,2) NOT NULL DEFAULT 0,
  gross_salary   NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_salary     NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (payroll_run_id, employee_id)
);

CREATE TABLE IF NOT EXISTS hr_attendance (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID        NOT NULL REFERENCES tenants(id)      ON DELETE CASCADE,
  employee_id    UUID        NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  date           DATE        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'present'
                   CHECK (status IN ('present','absent','late','half_day','holiday','on_leave')),
  check_in_time  TIME,
  check_out_time TIME,
  notes          TEXT,
  created_by     UUID        REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, date)
);

-- Out-of-office requests: field visits, WFH, tours, etc.
CREATE TABLE IF NOT EXISTS hr_movements (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id)      ON DELETE CASCADE,
  employee_id      UUID        NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  movement_type    TEXT        NOT NULL,
  from_date        DATE        NOT NULL,
  to_date          DATE        NOT NULL,
  start_time       TIME,
  end_time         TIME,
  location         TEXT,
  reason           TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','rejected','cancelled')),
  approved_by      UUID        REFERENCES auth.users(id),
  approved_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  created_by       UUID        REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-employee leave balance per year. Deducted on approval, refunded on cancel.
CREATE TABLE IF NOT EXISTS hr_leave_balances (
  id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID         NOT NULL REFERENCES tenants(id)        ON DELETE CASCADE,
  employee_id   UUID         NOT NULL REFERENCES hr_employees(id)   ON DELETE CASCADE,
  leave_type_id UUID         NOT NULL REFERENCES hr_leave_types(id) ON DELETE CASCADE,
  year          INTEGER      NOT NULL,
  total_days    NUMERIC(5,1) NOT NULL DEFAULT 0,
  used_days     NUMERIC(5,1) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (employee_id, leave_type_id, year)
);

-- ────────────────────────────────────────────────────────────────────────────
--  5.7  ASSETS
--  Shape = the v1 base table plus every column the Assets module addendum
--  added on top. Both generations are represented, exactly as a database that
--  ran the old files in order would look.
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS asset_categories (
  id                   UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                 TEXT         NOT NULL,
  code                 TEXT,
  description          TEXT,
  depreciation_method  TEXT         DEFAULT 'straight_line'
                         CHECK (depreciation_method IN ('straight_line','declining_balance','units_of_production')),
  useful_life_years    INT,
  salvage_value_pct    NUMERIC(5,2) DEFAULT 0,
  default_useful_life  INTEGER      NOT NULL DEFAULT 5,
  default_salvage_rate NUMERIC(5,2) NOT NULL DEFAULT 10,
  is_active            BOOLEAN      NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ  DEFAULT now(),
  UNIQUE (tenant_id, code)
);

ALTER TABLE asset_categories ADD COLUMN IF NOT EXISTS description          TEXT;
ALTER TABLE asset_categories ADD COLUMN IF NOT EXISTS default_useful_life  INTEGER      NOT NULL DEFAULT 5;
ALTER TABLE asset_categories ADD COLUMN IF NOT EXISTS default_salvage_rate NUMERIC(5,2) NOT NULL DEFAULT 10;
ALTER TABLE asset_categories ADD COLUMN IF NOT EXISTS is_active            BOOLEAN      NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS assets (
  id                       UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id                UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  asset_number             TEXT          NOT NULL,
  name                     TEXT          NOT NULL,
  description              TEXT,
  category_id              UUID          REFERENCES asset_categories(id),
  purchase_date            DATE,
  purchase_cost            NUMERIC(15,2) NOT NULL,
  book_value               NUMERIC(15,2),
  salvage_value            NUMERIC(15,2) DEFAULT 0,
  accumulated_depreciation NUMERIC(15,2) NOT NULL DEFAULT 0,
  useful_life_years        INT,
  depreciation_method      TEXT          DEFAULT 'straight_line',
  location                 TEXT,
  assigned_to              UUID          REFERENCES employees(id),
  status                   TEXT          DEFAULT 'active'
                             CHECK (status IN ('active','maintenance','disposed','fully_depreciated')),
  serial_number            TEXT,
  warranty_expiry          DATE,
  disposal_date            DATE,
  disposal_amount          NUMERIC(15,2),
  notes                    TEXT,
  vendor_id                UUID          REFERENCES vendors(id),
  created_by               UUID          REFERENCES auth.users(id),
  created_at               TIMESTAMPTZ   DEFAULT now(),
  updated_at               TIMESTAMPTZ   DEFAULT now(),
  UNIQUE (tenant_id, asset_number)
);

ALTER TABLE assets ADD COLUMN IF NOT EXISTS accumulated_depreciation NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS disposal_date            DATE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS disposal_amount          NUMERIC(15,2);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS notes                    TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS created_by               UUID REFERENCES auth.users(id);

-- Legacy depreciation log (superseded by asset_depreciation_schedules).
CREATE TABLE IF NOT EXISTS asset_depreciation_logs (
  id                  UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  asset_id            UUID          NOT NULL REFERENCES assets(id)  ON DELETE CASCADE,
  period_date         DATE          NOT NULL,
  opening_value       NUMERIC(15,2),
  depreciation_amount NUMERIC(15,2),
  closing_value       NUMERIC(15,2),
  created_at          TIMESTAMPTZ   DEFAULT now()
);

-- The table the Assets module reads and writes.
CREATE TABLE IF NOT EXISTS asset_depreciation_schedules (
  id                       UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id                UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  asset_id                 UUID          NOT NULL REFERENCES assets(id)  ON DELETE CASCADE,
  period_date              DATE          NOT NULL,
  period_label             TEXT          NOT NULL,
  depreciation_amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
  accumulated_depreciation NUMERIC(15,2) NOT NULL DEFAULT 0,
  book_value_after         NUMERIC(15,2) NOT NULL DEFAULT 0,
  status                   TEXT          NOT NULL DEFAULT 'scheduled'
                             CHECK (status IN ('scheduled','posted','cancelled')),
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- maintenance_type includes 'emergency' — see consolidation note 6.
CREATE TABLE IF NOT EXISTS asset_maintenance_logs (
  id                    UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  asset_id              UUID          NOT NULL REFERENCES assets(id),
  log_number            TEXT,
  maintenance_type      TEXT          CHECK (maintenance_type IN ('preventive','corrective','emergency','inspection')),
  status                TEXT          NOT NULL DEFAULT 'scheduled'
                          CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  description           TEXT,
  cost                  NUMERIC(15,2) DEFAULT 0,
  performed_by          TEXT,
  scheduled_date        DATE,
  completed_date        DATE,
  maintenance_date      DATE          DEFAULT CURRENT_DATE,   -- legacy column, retained
  next_maintenance_date DATE,                                 -- legacy column, retained
  notes                 TEXT,
  created_by            UUID          REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ   DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE asset_maintenance_logs ADD COLUMN IF NOT EXISTS log_number     TEXT;
ALTER TABLE asset_maintenance_logs ADD COLUMN IF NOT EXISTS status         TEXT NOT NULL DEFAULT 'scheduled'
  CHECK (status IN ('scheduled','in_progress','completed','cancelled'));
ALTER TABLE asset_maintenance_logs ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE asset_maintenance_logs ADD COLUMN IF NOT EXISTS completed_date DATE;
ALTER TABLE asset_maintenance_logs ADD COLUMN IF NOT EXISTS notes          TEXT;
ALTER TABLE asset_maintenance_logs ADD COLUMN IF NOT EXISTS created_by     UUID REFERENCES auth.users(id);
ALTER TABLE asset_maintenance_logs ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE asset_maintenance_logs
    ADD CONSTRAINT asset_maintenance_logs_tenant_log_key UNIQUE (tenant_id, log_number);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
--  5.8  APPROVALS
--  `feature` scopes a workflow/request to one menu item (e.g. "/sales/orders")
--  rather than the whole module. Nullable so existing rows keep working.
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS approval_workflows (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL,
  module            TEXT        NOT NULL,
  feature           TEXT,
  trigger_condition TEXT,
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE approval_workflows ADD COLUMN IF NOT EXISTS feature    TEXT;
ALTER TABLE approval_workflows ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS approval_workflow_steps (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_id   UUID        NOT NULL REFERENCES approval_workflows(id) ON DELETE CASCADE,
  step_order    INT         NOT NULL,
  step_name     TEXT        NOT NULL,
  approver_role TEXT        NOT NULL,
  approval_type TEXT        NOT NULL DEFAULT 'any' CHECK (approval_type IN ('any','all')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS approval_requests (
  id             UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_number TEXT          NOT NULL,
  workflow_id    UUID          REFERENCES approval_workflows(id),
  title          TEXT          NOT NULL,
  description    TEXT,
  module         TEXT          NOT NULL,
  feature        TEXT,
  record_id      UUID,
  record_type    TEXT,
  amount         NUMERIC(15,2),
  priority       TEXT          NOT NULL DEFAULT 'normal'
                   CHECK (priority IN ('low','normal','high','urgent')),
  status         TEXT          NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','approved','rejected','cancelled')),
  current_step   INT           NOT NULL DEFAULT 1,
  requested_by   UUID          REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, request_number)
);

ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS feature TEXT;

CREATE TABLE IF NOT EXISTS approval_actions (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_id  UUID        NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  step_number INT         NOT NULL,
  action      TEXT        NOT NULL CHECK (action IN ('approved','rejected','delegated')),
  actor_id    UUID        REFERENCES auth.users(id),
  comment     TEXT,
  acted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────────────────
--  5.9  REPORTS
-- ────────────────────────────────────────────────────────────────────────────

-- Legacy (superseded by report_saved_filters); kept so nothing is dropped.
CREATE TABLE IF NOT EXISTS reports_saved_queries (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  report_type  TEXT        NOT NULL,   -- 'financial' | 'operations' | 'hr' | 'custom'
  config       JSONB       NOT NULL DEFAULT '{}',
  is_scheduled BOOLEAN     NOT NULL DEFAULT false,
  schedule     TEXT,                   -- cron expression when is_scheduled = true
  created_by   UUID        REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- The table the Reports module reads and writes.
CREATE TABLE IF NOT EXISTS report_saved_filters (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  name        TEXT        NOT NULL,
  report_page TEXT        NOT NULL,   -- 'financial' | 'operations' | 'hr'
  filters     JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================================
--  PART 6 — BULK RLS ON BUSINESS TABLES
--  One pattern for all of them: super admins bypass, everyone else is confined
--  to their own tenant. DROP-then-CREATE so the whole file stays re-runnable.
-- ============================================================================

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    -- purchase
    'vendors','purchase_orders','purchase_order_lines','rfqs','rfq_lines',
    -- sales
    'customers','sales_orders','sales_order_lines','quotations','quotation_lines','offers',
    -- inventory
    'warehouses','products','stock_moves',
    -- accounts
    'chart_of_accounts','fiscal_periods','invoices','invoice_lines',
    'bills','bill_lines','journal_entries','journal_entry_lines',
    -- legacy hr
    'departments','employees','leave_requests',
    -- hr
    'hr_departments','hr_positions','hr_employees','hr_leave_types','hr_leave_requests',
    'hr_payroll_runs','hr_payroll_entries','hr_attendance','hr_movements','hr_leave_balances',
    -- assets
    'asset_categories','assets','asset_depreciation_logs',
    'asset_depreciation_schedules','asset_maintenance_logs',
    -- approvals
    'approval_workflows','approval_workflow_steps','approval_requests','approval_actions',
    -- reports
    'reports_saved_queries','report_saved_filters'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "super_admin_%1$s" ON %1$I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_%1$s" ON %1$I', tbl);
    EXECUTE format(
      'CREATE POLICY "super_admin_%1$s" ON %1$I FOR ALL USING (is_super_admin())', tbl);
    EXECUTE format(
      'CREATE POLICY "tenant_%1$s" ON %1$I FOR ALL USING (tenant_id = current_tenant_id())', tbl);
  END LOOP;
END $$;

-- Shorter policy names used by the assets addendum — dropped so a table never
-- ends up with two equivalent policies after an upgrade from the old files.
DROP POLICY IF EXISTS "super_admin_asset_depr_sched" ON asset_depreciation_schedules;
DROP POLICY IF EXISTS "tenant_asset_depr_sched"      ON asset_depreciation_schedules;
DROP POLICY IF EXISTS "super_admin_asset_maint"      ON asset_maintenance_logs;
DROP POLICY IF EXISTS "tenant_asset_maint"           ON asset_maintenance_logs;


-- ============================================================================
--  PART 7 — VIEWS
-- ============================================================================

-- Current on-hand quantity per product per warehouse, computed by replaying
-- every stock move:
--   incoming / adjustment → add to dest_warehouse
--   outgoing              → deduct from source_warehouse
--   internal              → deduct from source, add to dest
CREATE OR REPLACE VIEW inventory_levels
  WITH (security_invoker = true)
AS
WITH moves AS (
  SELECT tenant_id, product_id, dest_warehouse_id   AS warehouse_id,  quantity AS delta
  FROM   stock_moves
  WHERE  move_type IN ('incoming','adjustment') AND dest_warehouse_id IS NOT NULL

  UNION ALL

  SELECT tenant_id, product_id, source_warehouse_id AS warehouse_id, -quantity AS delta
  FROM   stock_moves
  WHERE  move_type = 'outgoing' AND source_warehouse_id IS NOT NULL

  UNION ALL

  SELECT tenant_id, product_id, dest_warehouse_id   AS warehouse_id,  quantity AS delta
  FROM   stock_moves
  WHERE  move_type = 'internal' AND dest_warehouse_id IS NOT NULL

  UNION ALL

  SELECT tenant_id, product_id, source_warehouse_id AS warehouse_id, -quantity AS delta
  FROM   stock_moves
  WHERE  move_type = 'internal' AND source_warehouse_id IS NOT NULL
)
SELECT
  m.tenant_id,
  m.product_id,
  p.sku,
  p.name         AS product_name,
  p.unit_of_measure,
  m.warehouse_id,
  w.name         AS warehouse_name,
  SUM(m.delta)   AS qty_on_hand,
  p.reorder_qty
FROM   moves m
JOIN   products   p ON p.id = m.product_id
JOIN   warehouses w ON w.id = m.warehouse_id
GROUP  BY m.tenant_id, m.product_id, p.sku, p.name, p.unit_of_measure,
          m.warehouse_id, w.name, p.reorder_qty;


-- ============================================================================
--  PART 8 — SEQUENCES & NUMBER GENERATORS
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS po_number_seq          START 1;
CREATE SEQUENCE IF NOT EXISTS so_number_seq          START 1;
CREATE SEQUENCE IF NOT EXISTS quot_number_seq        START 1;
CREATE SEQUENCE IF NOT EXISTS rfq_seq                START 1;
CREATE SEQUENCE IF NOT EXISTS stock_seq              START 1;
CREATE SEQUENCE IF NOT EXISTS inv_number_seq         START 1;
CREATE SEQUENCE IF NOT EXISTS bill_seq               START 1;
CREATE SEQUENCE IF NOT EXISTS bill_number_seq        START 1;
CREATE SEQUENCE IF NOT EXISTS je_seq                 START 1;
CREATE SEQUENCE IF NOT EXISTS je_number_seq          START 1;
CREATE SEQUENCE IF NOT EXISTS asset_seq              START 1;
CREATE SEQUENCE IF NOT EXISTS asset_number_seq       START 1;
CREATE SEQUENCE IF NOT EXISTS maint_log_seq          START 1;
CREATE SEQUENCE IF NOT EXISTS apr_seq                START 1;
CREATE SEQUENCE IF NOT EXISTS employee_number_seq    START 1;
CREATE SEQUENCE IF NOT EXISTS payroll_run_number_seq START 1;

-- ── Purchase / Sales / Inventory ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'PO-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('po_number_seq')::TEXT,4,'0');
$$;

CREATE OR REPLACE FUNCTION generate_so_number()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'SO-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('so_number_seq')::TEXT,4,'0');
$$;

CREATE OR REPLACE FUNCTION generate_quotation_number()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'Q-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('quot_number_seq')::TEXT,4,'0');
$$;

CREATE OR REPLACE FUNCTION generate_rfq_number()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'RFQ-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('rfq_seq')::TEXT,4,'0');
$$;

CREATE OR REPLACE FUNCTION generate_stock_number()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'SM-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('stock_seq')::TEXT,4,'0');
$$;

-- ── Accounts ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'INV-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('inv_number_seq')::TEXT,4,'0');
$$;

CREATE OR REPLACE FUNCTION generate_bill_number()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'BILL-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('bill_number_seq')::TEXT,4,'0');
$$;

-- Called by the app (modules/accounts/api/journals.js).
CREATE OR REPLACE FUNCTION generate_journal_entry_number()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'JE-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('je_number_seq')::TEXT,4,'0');
$$;

-- Older alias kept for compatibility; not called by the app.
CREATE OR REPLACE FUNCTION generate_je_number()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'JE-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('je_seq')::TEXT,4,'0');
$$;

-- ── Assets / HR / Approvals ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION generate_asset_number()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'AST-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('asset_number_seq')::TEXT,4,'0');
$$;

CREATE OR REPLACE FUNCTION generate_maintenance_log_number()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'MNT-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('maint_log_seq')::TEXT,4,'0');
$$;

CREATE OR REPLACE FUNCTION generate_employee_number()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'EMP-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('employee_number_seq')::TEXT,4,'0');
$$;

CREATE OR REPLACE FUNCTION generate_payroll_run_number()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'PAY-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('payroll_run_number_seq')::TEXT,4,'0');
$$;

CREATE OR REPLACE FUNCTION generate_apr_number()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'APR-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('apr_seq')::TEXT,4,'0');
$$;

GRANT EXECUTE ON FUNCTION generate_apr_number() TO anon, authenticated;


-- ============================================================================
--  PART 9 — APPLICATION RPCs
-- ============================================================================

-- ── Permissions ─────────────────────────────────────────────────────────────

-- Permission rows for a user + tenant. Used when building the in-memory map.
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

-- ── Tenant / user provisioning ──────────────────────────────────────────────

-- setup_tenant_user — SECURITY DEFINER, called right after signUp().
--
-- Why it exists: supabase.auth.signUp() swaps the client session for the new
-- user's session, so a direct INSERT into tenant_users fails RLS — the new user
-- is neither a super admin nor yet a tenant member. This runs as the DB owner
-- and applies its own gate instead.
CREATE OR REPLACE FUNCTION setup_tenant_user(
  p_tenant_id  UUID,
  p_user_id    UUID,
  p_role       TEXT,
  p_full_name  TEXT,
  p_module_ids TEXT[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow if the caller is a super admin, OR is the user being added and has
  -- no existing membership (a fresh signup claiming its first tenant).
  IF NOT (
    is_super_admin()
    OR (
      auth.uid() = p_user_id
      AND NOT EXISTS (SELECT 1 FROM tenant_users WHERE user_id = p_user_id)
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to create this membership';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant_id) THEN
    RAISE EXCEPTION 'Tenant % not found', p_tenant_id;
  END IF;

  INSERT INTO tenant_users (tenant_id, user_id, role, full_name, is_active)
  VALUES (p_tenant_id, p_user_id, p_role, p_full_name, true)
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  IF p_module_ids IS NOT NULL AND array_length(p_module_ids, 1) > 0 THEN
    INSERT INTO tenant_modules (tenant_id, module_id, installed_by)
    SELECT p_tenant_id, unnest(p_module_ids), p_user_id
    ON CONFLICT (tenant_id, module_id) DO NOTHING;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION setup_tenant_user TO authenticated;

-- Tenant members enriched with their auth.users email. SECURITY DEFINER so it
-- can read auth.users; scoped to the caller's own tenant.
CREATE OR REPLACE FUNCTION get_tenant_users_with_email()
RETURNS TABLE (
  id         UUID,
  tenant_id  UUID,
  user_id    UUID,
  role       TEXT,
  full_name  TEXT,
  email      TEXT,
  avatar_url TEXT,
  is_active  BOOLEAN,
  joined_at  TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  IF current_tenant_id() IS NULL THEN
    RAISE EXCEPTION 'Not a member of any tenant';
  END IF;

  RETURN QUERY
  SELECT tu.id, tu.tenant_id, tu.user_id, tu.role, tu.full_name,
         au.email, tu.avatar_url, tu.is_active, tu.joined_at
  FROM   tenant_users tu
  JOIN   auth.users   au ON au.id = tu.user_id
  WHERE  tu.tenant_id = current_tenant_id()
  ORDER  BY tu.joined_at ASC;
END;
$$;

-- Lets a tenant admin add an existing auth user to their tenant by email.
CREATE OR REPLACE FUNCTION add_tenant_user_by_email(
  p_email     TEXT,
  p_role      TEXT DEFAULT 'user',
  p_full_name TEXT DEFAULT NULL
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id   UUID;
  v_tenant_id UUID;
  v_full_name TEXT;
BEGIN
  IF current_user_role() NOT IN ('owner','admin') THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  IF p_role NOT IN ('owner','admin','manager','user','viewer') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid role');
  END IF;

  v_tenant_id := current_tenant_id();
  v_full_name := COALESCE(NULLIF(TRIM(p_full_name), ''), p_email);

  SELECT id INTO v_user_id
  FROM   auth.users
  WHERE  email = LOWER(TRIM(p_email))
  LIMIT  1;

  IF v_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No registered user found with that email address. Ask them to sign up first.'
    );
  END IF;

  -- Insert, or re-activate a previously removed member.
  INSERT INTO tenant_users (tenant_id, user_id, role, full_name, is_active)
  VALUES (v_tenant_id, v_user_id, p_role, v_full_name, true)
  ON CONFLICT (tenant_id, user_id)
  DO UPDATE SET role = EXCLUDED.role, full_name = EXCLUDED.full_name, is_active = true;

  RETURN json_build_object('success', true, 'user_id', v_user_id);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ── Inventory ───────────────────────────────────────────────────────────────

-- Products at or below their reorder point.
--   const { data } = await supabase.rpc('get_low_stock_items', { p_tenant_id })
CREATE OR REPLACE FUNCTION get_low_stock_items(p_tenant_id UUID)
RETURNS TABLE (
  product_id      UUID,
  product_name    TEXT,
  sku             TEXT,
  warehouse_id    UUID,
  warehouse_name  TEXT,
  qty_on_hand     NUMERIC,
  reorder_qty     NUMERIC,
  unit_of_measure TEXT
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT il.product_id, il.product_name, il.sku,
         il.warehouse_id, il.warehouse_name,
         il.qty_on_hand, il.reorder_qty, il.unit_of_measure
  FROM   inventory_levels il
  WHERE  il.tenant_id   = p_tenant_id
    AND  il.reorder_qty > 0
    AND  il.qty_on_hand <= il.reorder_qty
  ORDER  BY il.qty_on_hand ASC;
$$;

-- ── Reports ─────────────────────────────────────────────────────────────────

-- Trial balance: posted journal_entry_lines aggregated per account for a date
-- range. Every chart-of-accounts row is returned, even with no transactions.
-- Column names are debit_amount/credit_amount — see consolidation note 4.
CREATE OR REPLACE FUNCTION get_trial_balance(
  p_tenant_id UUID,
  p_date_from TEXT,
  p_date_to   TEXT
)
RETURNS TABLE (
  account_code TEXT,
  account_name TEXT,
  account_type TEXT,
  total_debit  NUMERIC,
  total_credit NUMERIC,
  balance      NUMERIC
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT
    coa.code                                              AS account_code,
    coa.name                                              AS account_name,
    coa.account_type                                      AS account_type,
    COALESCE(SUM(f.debit_amount),  0)                     AS total_debit,
    COALESCE(SUM(f.credit_amount), 0)                     AS total_credit,
    COALESCE(SUM(f.debit_amount - f.credit_amount), 0)    AS balance
  FROM chart_of_accounts coa
  LEFT JOIN (
    SELECT jel.account_id, jel.debit_amount, jel.credit_amount
    FROM   journal_entry_lines jel
    INNER JOIN journal_entries je
      ON  je.id         = jel.journal_entry_id
      AND je.tenant_id  = p_tenant_id
      AND je.status     = 'posted'
      AND je.entry_date BETWEEN p_date_from::DATE AND p_date_to::DATE
  ) f ON f.account_id = coa.id
  WHERE coa.tenant_id = p_tenant_id
  GROUP BY coa.id, coa.code, coa.name, coa.account_type
  ORDER BY coa.code;
$$;

-- Monthly revenue vs expenses.
-- Revenue = sent+paid invoices; Expenses = posted+paid bills.
CREATE OR REPLACE FUNCTION get_income_summary(
  p_tenant_id UUID,
  p_date_from TEXT,
  p_date_to   TEXT
)
RETURNS TABLE (
  period     TEXT,
  revenue    NUMERIC,
  expenses   NUMERIC,
  net_profit NUMERIC
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  WITH months AS (
    SELECT TO_CHAR(gs.d, 'YYYY-MM') AS period
    FROM generate_series(
      date_trunc('month', p_date_from::DATE),
      date_trunc('month', p_date_to::DATE),
      '1 month'::INTERVAL
    ) AS gs(d)
  ),
  rev AS (
    SELECT TO_CHAR(invoice_date, 'YYYY-MM') AS period, SUM(total_amount) AS revenue
    FROM   invoices
    WHERE  tenant_id = p_tenant_id
      AND  status IN ('sent','paid')
      AND  invoice_date BETWEEN p_date_from::DATE AND p_date_to::DATE
    GROUP  BY 1
  ),
  exp AS (
    SELECT TO_CHAR(bill_date, 'YYYY-MM') AS period, SUM(total_amount) AS expenses
    FROM   bills
    WHERE  tenant_id = p_tenant_id
      AND  status IN ('posted','paid')
      AND  bill_date BETWEEN p_date_from::DATE AND p_date_to::DATE
    GROUP  BY 1
  )
  SELECT
    m.period,
    COALESCE(r.revenue,  0)                          AS revenue,
    COALESCE(e.expenses, 0)                          AS expenses,
    COALESCE(r.revenue, 0) - COALESCE(e.expenses, 0) AS net_profit
  FROM months m
  LEFT JOIN rev r ON r.period = m.period
  LEFT JOIN exp e ON e.period = m.period
  ORDER BY m.period;
$$;


-- ============================================================================
--  PART 10 — updated_at TRIGGERS
-- ============================================================================

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'vendors','customers','purchase_orders','sales_orders','products',
    'employees','assets','journal_entries','offers',
    'approval_requests','approval_workflows','reports_saved_queries'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON %1$I', tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON %1$I
         FOR EACH ROW EXECUTE FUNCTION set_updated_at()', tbl);
  END LOOP;
END $$;


-- ============================================================================
--  PART 11 — PERFORMANCE INDEXES
--  Every tenant_id and foreign-key column that a list page or join filters on.
-- ============================================================================

-- ── Foundation ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tenant_users_user_id     ON tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_modules_tenant    ON tenant_modules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tup_tenant_user          ON tenant_user_permissions(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_tup_feature              ON tenant_user_permissions(tenant_id, user_id, module_id, feature_id);
CREATE INDEX IF NOT EXISTS idx_module_catalog_active    ON module_catalog(is_active, sort_order);

-- ── Purchase ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_vendors_tenant           ON vendors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_po_tenant_status         ON purchase_orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_po_tenant_vendor         ON purchase_orders(tenant_id, vendor_id);
CREATE INDEX IF NOT EXISTS idx_pol_purchase_order_id    ON purchase_order_lines(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_rfq_lines_rfq            ON rfq_lines(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_lines_tenant         ON rfq_lines(tenant_id);

-- ── Sales ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_customers_tenant         ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_so_tenant_status         ON sales_orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_so_tenant_customer       ON sales_orders(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_sol_sales_order_id       ON sales_order_lines(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_quotations_tenant_status   ON quotations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_quotations_tenant_customer ON quotations(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_quotation_lines_quotation  ON quotation_lines(quotation_id);
CREATE INDEX IF NOT EXISTS idx_offers_tenant_active     ON offers(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_offers_tenant_dates      ON offers(tenant_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_offers_tenant_type       ON offers(tenant_id, offer_type);
CREATE INDEX IF NOT EXISTS idx_offers_tenant_created    ON offers(tenant_id, created_at DESC);

-- ── Inventory ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_tenant          ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant_status   ON products(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_products_tenant_category ON products(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_warehouses_tenant_status ON warehouses(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_stock_moves_tenant_product ON stock_moves(tenant_id, product_id);
CREATE INDEX IF NOT EXISTS idx_stock_moves_tenant_type  ON stock_moves(tenant_id, move_type);
CREATE INDEX IF NOT EXISTS idx_stock_moves_tenant_date  ON stock_moves(tenant_id, move_date DESC);

-- ── Accounts ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_coa_tenant_type          ON chart_of_accounts(tenant_id, account_type);
CREATE INDEX IF NOT EXISTS idx_fiscal_periods_tenant    ON fiscal_periods(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_status   ON invoices(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_customer ON invoices(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_date     ON invoices(tenant_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice    ON invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_bills_tenant_vendor      ON bills(tenant_id, vendor_id);
CREATE INDEX IF NOT EXISTS idx_bills_tenant_date        ON bills(tenant_id, bill_date DESC);
CREATE INDEX IF NOT EXISTS idx_bill_lines_bill          ON bill_lines(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_lines_tenant        ON bill_lines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_je_tenant_status         ON journal_entries(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_je_tenant_date           ON journal_entries(tenant_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_je_tenant_period         ON journal_entries(tenant_id, fiscal_period_id);
CREATE INDEX IF NOT EXISTS idx_jel_entry_id             ON journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_jel_account_id           ON journal_entry_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_jel_tenant               ON journal_entry_lines(tenant_id);

-- ── Legacy HR ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_employees_tenant_dept    ON employees(tenant_id, department_id);
CREATE INDEX IF NOT EXISTS idx_lr_employee_id           ON leave_requests(employee_id);

-- ── HR ──────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_hr_departments_tenant    ON hr_departments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hr_positions_tenant_dept ON hr_positions(tenant_id, department_id);
CREATE INDEX IF NOT EXISTS idx_hr_employees_tenant_status ON hr_employees(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_employees_tenant_dept   ON hr_employees(tenant_id, department_id);
CREATE INDEX IF NOT EXISTS idx_hr_employees_tenant_joined ON hr_employees(tenant_id, join_date DESC);
CREATE INDEX IF NOT EXISTS idx_hr_employees_user_id     ON hr_employees(user_id);
CREATE INDEX IF NOT EXISTS idx_hr_leave_types_tenant    ON hr_leave_types(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_tenant_status ON hr_leave_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_employee      ON hr_leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_dates         ON hr_leave_requests(tenant_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_hr_payroll_runs_tenant_status   ON hr_payroll_runs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_payroll_runs_period          ON hr_payroll_runs(tenant_id, period_year DESC, period_month DESC);
CREATE INDEX IF NOT EXISTS idx_hr_payroll_entries_run          ON hr_payroll_entries(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_hr_payroll_entries_employee     ON hr_payroll_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_tenant_date       ON hr_attendance(tenant_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_employee_date     ON hr_attendance(employee_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_tenant_status     ON hr_attendance(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_movements_tenant_status      ON hr_movements(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_movements_employee           ON hr_movements(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_movements_dates              ON hr_movements(tenant_id, from_date DESC);
CREATE INDEX IF NOT EXISTS idx_hr_leave_balances_emp_year      ON hr_leave_balances(employee_id, year);
CREATE INDEX IF NOT EXISTS idx_hr_leave_balances_tenant        ON hr_leave_balances(tenant_id);

-- ── Assets ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_asset_categories_tenant  ON asset_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assets_tenant_status     ON assets(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_assets_tenant_category   ON assets(tenant_id, category_id);
CREATE INDEX IF NOT EXISTS idx_assets_tenant_date       ON assets(tenant_id, purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_adl_asset_id             ON asset_depreciation_logs(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_depr_asset_id      ON asset_depreciation_schedules(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_depr_tenant_status ON asset_depreciation_schedules(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_asset_depr_period        ON asset_depreciation_schedules(tenant_id, period_date);
CREATE INDEX IF NOT EXISTS idx_asset_maint_asset_id     ON asset_maintenance_logs(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_maint_tenant_status ON asset_maintenance_logs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_asset_maint_scheduled    ON asset_maintenance_logs(tenant_id, scheduled_date DESC);

-- ── Approvals ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_approval_requests_tenant_status       ON approval_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_tenant_requested_by ON approval_requests(tenant_id, requested_by);
CREATE INDEX IF NOT EXISTS idx_approval_requests_tenant_created      ON approval_requests(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_requests_tenant_updated      ON approval_requests(tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_workflow_steps_workflow      ON approval_workflow_steps(workflow_id, step_order);
CREATE INDEX IF NOT EXISTS idx_approval_actions_request              ON approval_actions(request_id, acted_at);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_tenant_module      ON approval_workflows(tenant_id, module, is_active);

-- ── Reports ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rsq_tenant                    ON reports_saved_queries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_report_saved_filters_tenant   ON report_saved_filters(tenant_id);
CREATE INDEX IF NOT EXISTS idx_report_saved_filters_page     ON report_saved_filters(tenant_id, report_page);


-- ============================================================================
--  PART 12 — MODULE CATALOGUE SEED
--  Display metadata for the nine shipped modules. Re-running refreshes every
--  column from these values (ON CONFLICT DO UPDATE), so this file is the
--  source of truth for module metadata — edit here, or in the Supabase table
--  editor for one-off tweaks.
-- ============================================================================

INSERT INTO module_catalog
  (module_id, name, description, version, icon, color, category,
   features, dependencies, menu_items, sort_order)
VALUES
  (
    'purchase', 'Purchase',
    'Manage purchase orders, vendor relationships, RFQs, and procurement workflows.',
    '1.0.0', 'ShoppingCart', '#f59e0b', 'Operations',
    '["Purchase Orders","Request for Quotations (RFQ)","Vendor Management","Purchase Approvals","Purchase Analytics"]'::jsonb,
    '[]'::jsonb,
    '[
      {"id":"purchase-dashboard","label":"Dashboard","path":"/purchase","icon":"LayoutDashboard","order":1},
      {"id":"purchase-orders","label":"Purchase Orders","path":"/purchase/orders","icon":"FileText","order":2},
      {"id":"purchase-rfq","label":"RFQ","path":"/purchase/rfq","icon":"ClipboardList","order":3},
      {"id":"purchase-vendors","label":"Vendors","path":"/purchase/vendors","icon":"Building2","order":4}
    ]'::jsonb,
    1
  ),
  (
    'sales', 'Sales',
    'Drive revenue with quotations, sales orders, customer management, and pipeline analytics.',
    '1.0.0', 'TrendingUp', '#10b981', 'Operations',
    '["Quotations & Sales Orders","Customer Management","Offers & Discount Rules","Coupon Code Management","Sales Pipeline","Revenue Analytics"]'::jsonb,
    '[]'::jsonb,
    '[
      {"id":"sales-dashboard","label":"Dashboard","path":"/sales","icon":"LayoutDashboard","order":1},
      {"id":"sales-orders","label":"Sales Orders","path":"/sales/orders","icon":"FileText","order":2},
      {"id":"sales-quotations","label":"Quotations","path":"/sales/quotations","icon":"ClipboardList","order":3},
      {"id":"sales-customers","label":"Customers","path":"/sales/customers","icon":"Users","order":4},
      {"id":"sales-offers","label":"Offers & Discounts","path":"/sales/offers","icon":"Tag","order":5}
    ]'::jsonb,
    2
  ),
  (
    'inventory', 'Inventory',
    'Track stock levels, warehouses, product movements, and reorder rules.',
    '1.0.0', 'Package', '#3b82f6', 'Operations',
    '["Product Catalog","Stock Management","Warehouse Locations","Delivery & Receipts","Reorder Rules"]'::jsonb,
    '["purchase"]'::jsonb,
    '[
      {"id":"inv-dashboard","label":"Dashboard","path":"/inventory","icon":"LayoutDashboard","order":1},
      {"id":"inv-products","label":"Products","path":"/inventory/products","icon":"Package","order":2},
      {"id":"inv-stock","label":"Stock Moves","path":"/inventory/stock","icon":"ArrowLeftRight","order":3},
      {"id":"inv-warehouses","label":"Warehouses","path":"/inventory/warehouses","icon":"Warehouse","order":4}
    ]'::jsonb,
    3
  ),
  (
    'accounts', 'Accounts',
    'Full financial management: invoices, bills, journals, reconciliation, and financial reports.',
    '1.0.0', 'DollarSign', '#8b5cf6', 'Finance',
    '["Chart of Accounts","Customer Invoices","Vendor Bills","Payment Reconciliation","Journal Entries","P&L & Balance Sheet"]'::jsonb,
    '[]'::jsonb,
    '[
      {"id":"acc-dashboard","label":"Dashboard","path":"/accounts","icon":"LayoutDashboard","order":1},
      {"id":"acc-invoices","label":"Invoices","path":"/accounts/invoices","icon":"FileText","order":2},
      {"id":"acc-bills","label":"Bills","path":"/accounts/bills","icon":"Receipt","order":3},
      {"id":"acc-journals","label":"Journals","path":"/accounts/journals","icon":"BookOpen","order":4},
      {"id":"acc-coa","label":"Chart of Accounts","path":"/accounts/coa","icon":"List","order":5}
    ]'::jsonb,
    4
  ),
  (
    'hr', 'Human Resources',
    'Manage employees, departments, attendance, leave, and payroll.',
    '1.0.0', 'Users', '#ec4899', 'Human Resources',
    '["Employee Directory","Departments & Positions","Attendance Tracking","Leave Management","Payroll"]'::jsonb,
    '[]'::jsonb,
    '[
      {"id":"hr-dashboard","label":"Dashboard","path":"/hr","icon":"LayoutDashboard","order":1},
      {"id":"hr-employees","label":"Employees","path":"/hr/employees","icon":"Users","order":2},
      {"id":"hr-departments","label":"Departments","path":"/hr/departments","icon":"Building","order":3},
      {"id":"hr-attendance","label":"Attendance","path":"/hr/attendance","icon":"Clock","order":4},
      {"id":"hr-movement","label":"Movement","path":"/hr/movement","icon":"ArrowLeftRight","order":5},
      {"id":"hr-leave","label":"Leave","path":"/hr/leave","icon":"Calendar","order":6},
      {"id":"hr-payroll","label":"Payroll","path":"/hr/payroll","icon":"DollarSign","order":7}
    ]'::jsonb,
    5
  ),
  (
    'configuration', 'Configuration',
    'System-wide settings: company info, users, roles, fiscal years, and module settings.',
    '1.0.0', 'Settings', '#64748b', 'System',
    '["Company Settings","Users & Roles","Module Settings","Fiscal Periods","Currency"]'::jsonb,
    '[]'::jsonb,
    '[
      {"id":"cfg-company","label":"Company","path":"/configuration/company","icon":"Building2","order":1},
      {"id":"cfg-users","label":"Users & Roles","path":"/configuration/users","icon":"UserCog","order":2},
      {"id":"cfg-modules","label":"Module Settings","path":"/configuration/modules","icon":"Puzzle","order":3},
      {"id":"cfg-fiscal","label":"Fiscal Periods","path":"/configuration/fiscal","icon":"CalendarDays","order":4}
    ]'::jsonb,
    6
  ),
  (
    'reports', 'Reports',
    'Dynamic reports across all installed modules. Export to PDF and Excel.',
    '1.0.0', 'BarChart2', '#a855f7', 'Analytics',
    '["Cross-module Analytics","Financial Reports","Operations Reports","Export to PDF & Excel","Scheduled Reports","Custom Dashboards"]'::jsonb,
    '[]'::jsonb,
    '[
      {"id":"rpt-overview","label":"Overview","path":"/reports","icon":"BarChart2","order":1},
      {"id":"rpt-financial","label":"Financial","path":"/reports/financial","icon":"DollarSign","order":2},
      {"id":"rpt-operations","label":"Operations","path":"/reports/operations","icon":"Activity","order":3},
      {"id":"rpt-hr","label":"HR Reports","path":"/reports/hr","icon":"Users","order":4}
    ]'::jsonb,
    7
  ),
  (
    'assets', 'Assets',
    'Track and manage fixed assets, depreciation schedules, maintenance, and disposal.',
    '1.0.0', 'Cpu', '#f97316', 'Finance',
    '["Asset Registry","Depreciation Schedules","Asset Categories","Maintenance Tracking","Asset Disposal","Asset Reports"]'::jsonb,
    '["accounts"]'::jsonb,
    '[
      {"id":"asset-dashboard","label":"Dashboard","path":"/assets","icon":"LayoutDashboard","order":1},
      {"id":"asset-list","label":"Assets","path":"/assets/list","icon":"Cpu","order":2},
      {"id":"asset-depreciation","label":"Depreciation","path":"/assets/depreciation","icon":"TrendingDown","order":3},
      {"id":"asset-categories","label":"Categories","path":"/assets/categories","icon":"Tag","order":4},
      {"id":"asset-maintenance","label":"Maintenance","path":"/assets/maintenance","icon":"Wrench","order":5}
    ]'::jsonb,
    8
  ),
  (
    'approval', 'Approvals',
    'Configurable multi-level approval workflows for any ERP document or request.',
    '1.0.0', 'CheckSquare', '#06b6d4', 'Operations',
    '["Multi-level Approval Workflows","Approval Templates","Delegation Support","Approval History & Audit Trail","Email & In-app Notifications","Approval Dashboard"]'::jsonb,
    '[]'::jsonb,
    '[
      {"id":"approval-dashboard","label":"Dashboard","path":"/approval","icon":"LayoutDashboard","order":1},
      {"id":"approval-pending","label":"Pending Approvals","path":"/approval/pending","icon":"Clock","order":2},
      {"id":"approval-my","label":"My Requests","path":"/approval/my-requests","icon":"Send","order":3},
      {"id":"approval-workflows","label":"Workflows","path":"/approval/workflows","icon":"GitBranch","order":4},
      {"id":"approval-history","label":"History","path":"/approval/history","icon":"History","order":5}
    ]'::jsonb,
    9
  )
ON CONFLICT (module_id) DO UPDATE SET
  name         = EXCLUDED.name,
  description  = EXCLUDED.description,
  version      = EXCLUDED.version,
  icon         = EXCLUDED.icon,
  color        = EXCLUDED.color,
  category     = EXCLUDED.category,
  features     = EXCLUDED.features,
  dependencies = EXCLUDED.dependencies,
  menu_items   = EXCLUDED.menu_items,
  sort_order   = EXCLUDED.sort_order,
  updated_at   = now();


-- ── Wire every menu item up for feature-level permissions ───────────────────
-- Generic, not per-module: each menu item gets
--   requiredPermission = { action, moduleId, featureId: <the item's own id> }
-- Merged onto items BY ID rather than replacing menu_items wholesale, so any
-- label/icon/order edits made in the Supabase table editor survive, and modules
-- added to the catalogue later are covered with no list to maintain here.
UPDATE module_catalog
SET menu_items = COALESCE((
  SELECT jsonb_agg(
    CASE
      WHEN elem ? 'id' THEN elem || jsonb_build_object(
        'requiredPermission', jsonb_build_object(
          'action',    COALESCE(elem->'requiredPermission'->>'action', 'view'),
          'moduleId',  module_catalog.module_id,
          'featureId', elem->>'id'
        )
      )
      ELSE elem
    END
    ORDER BY ord
  )
  FROM jsonb_array_elements(menu_items) WITH ORDINALITY AS t(elem, ord)
), menu_items),   -- empty menu_items ([]) → jsonb_agg returns NULL; keep the []
updated_at = now();


-- ============================================================================
--  PART 13 — OPTIONAL SEEDS
--  Everything below is commented out. Uncomment only what you want.
-- ============================================================================

-- ── 13.1  Demo tenants ──────────────────────────────────────────────────────
-- INSERT INTO tenants (name, slug, plan) VALUES
--   ('Prince Bazar', 'prince-bazar', 'growth'),
--   ('Agora',        'agora',        'starter')
-- ON CONFLICT (slug) DO NOTHING;
--
-- Then, in Supabase Auth → Users, create the accounts:
--   superadmin@nexuserp.com   user_metadata: { "is_super_admin": true, "full_name": "Super Admin" }
--   admin@prince-bazar.com    user_metadata: { "full_name": "Prince Bazar Admin" }
--
-- …copy their UUIDs and link them:
-- INSERT INTO tenant_users (tenant_id, user_id, role, full_name)
-- SELECT t.id, '<auth-user-uuid>'::uuid, 'owner', 'Prince Bazar Admin'
-- FROM tenants t WHERE t.slug = 'prince-bazar';
--
-- …then install modules for them:
-- INSERT INTO tenant_modules (tenant_id, module_id)
-- SELECT t.id, m.module_id FROM tenants t,
--   (VALUES ('sales'),('purchase')) AS m(module_id)
-- WHERE t.slug = 'prince-bazar';
--
-- Easier alternative: sign in as the super admin and create everything from
-- the built-in Admin Panel at /admin.

-- ── 13.2  Standard chart of accounts (per tenant) ───────────────────────────
-- Conventional small/mid-size business account structure. Replace the UUID
-- with your tenant's id (SELECT id FROM tenants WHERE name = '…'), then run
-- the block. Safe to re-run — existing codes are skipped.
--
-- DO $$
-- DECLARE
--   v_tenant_id UUID := '00000000-0000-0000-0000-000000000000'; -- REPLACE ME
-- BEGIN
--   INSERT INTO chart_of_accounts (tenant_id, code, name, account_type, is_active) VALUES
--     -- 1000s — ASSETS
--     (v_tenant_id, '1000', 'Assets',                             'asset', true),
--     (v_tenant_id, '1010', 'Cash and Cash Equivalents',          'asset', true),
--     (v_tenant_id, '1020', 'Petty Cash',                         'asset', true),
--     (v_tenant_id, '1030', 'Accounts Receivable',                'asset', true),
--     (v_tenant_id, '1040', 'Inventory',                          'asset', true),
--     (v_tenant_id, '1050', 'Prepaid Expenses',                   'asset', true),
--     (v_tenant_id, '1060', 'Other Current Assets',               'asset', true),
--     (v_tenant_id, '1500', 'Property, Plant & Equipment',        'asset', true),
--     (v_tenant_id, '1510', 'Furniture and Fixtures',             'asset', true),
--     (v_tenant_id, '1520', 'Office Equipment',                   'asset', true),
--     (v_tenant_id, '1530', 'Vehicles',                           'asset', true),
--     (v_tenant_id, '1540', 'Buildings',                          'asset', true),
--     (v_tenant_id, '1590', 'Accumulated Depreciation',           'asset', true),
--     (v_tenant_id, '1600', 'Other Non-Current Assets',           'asset', true),
--     -- 2000s — LIABILITIES
--     (v_tenant_id, '2000', 'Liabilities',                        'liability', true),
--     (v_tenant_id, '2010', 'Accounts Payable',                   'liability', true),
--     (v_tenant_id, '2020', 'Accrued Liabilities',                'liability', true),
--     (v_tenant_id, '2030', 'Sales Tax Payable',                  'liability', true),
--     (v_tenant_id, '2040', 'Payroll Liabilities',                'liability', true),
--     (v_tenant_id, '2050', 'Short-Term Loans',                   'liability', true),
--     (v_tenant_id, '2060', 'Current Portion of Long-Term Debt',  'liability', true),
--     (v_tenant_id, '2500', 'Long-Term Liabilities',              'liability', true),
--     (v_tenant_id, '2510', 'Long-Term Loans Payable',            'liability', true),
--     (v_tenant_id, '2520', 'Deferred Tax Liability',             'liability', true),
--     -- 3000s — EQUITY
--     (v_tenant_id, '3000', 'Equity',                             'equity', true),
--     (v_tenant_id, '3010', 'Owner''s Capital',                   'equity', true),
--     (v_tenant_id, '3020', 'Retained Earnings',                  'equity', true),
--     (v_tenant_id, '3030', 'Owner''s Drawings',                  'equity', true),
--     (v_tenant_id, '3040', 'Additional Paid-in Capital',         'equity', true),
--     -- 4000s — REVENUE
--     (v_tenant_id, '4000', 'Revenue',                            'revenue', true),
--     (v_tenant_id, '4010', 'Sales Revenue',                      'revenue', true),
--     (v_tenant_id, '4020', 'Service Revenue',                    'revenue', true),
--     (v_tenant_id, '4030', 'Other Income',                       'revenue', true),
--     (v_tenant_id, '4040', 'Interest Income',                    'revenue', true),
--     (v_tenant_id, '4900', 'Sales Returns and Allowances',       'revenue', true),
--     -- 5000s — EXPENSES
--     (v_tenant_id, '5000', 'Expenses',                           'expense', true),
--     (v_tenant_id, '5010', 'Cost of Goods Sold',                 'expense', true),
--     (v_tenant_id, '5100', 'Salaries and Wages',                 'expense', true),
--     (v_tenant_id, '5110', 'Employee Benefits',                  'expense', true),
--     (v_tenant_id, '5120', 'Payroll Tax Expense',                'expense', true),
--     (v_tenant_id, '5200', 'Rent Expense',                       'expense', true),
--     (v_tenant_id, '5210', 'Utilities Expense',                  'expense', true),
--     (v_tenant_id, '5220', 'Office Supplies Expense',            'expense', true),
--     (v_tenant_id, '5230', 'Insurance Expense',                  'expense', true),
--     (v_tenant_id, '5240', 'Depreciation Expense',               'expense', true),
--     (v_tenant_id, '5250', 'Repairs and Maintenance',            'expense', true),
--     (v_tenant_id, '5260', 'Advertising and Marketing',          'expense', true),
--     (v_tenant_id, '5270', 'Travel Expense',                     'expense', true),
--     (v_tenant_id, '5280', 'Professional Fees',                  'expense', true),
--     (v_tenant_id, '5290', 'Bank Fees and Charges',              'expense', true),
--     (v_tenant_id, '5300', 'Telephone and Internet',             'expense', true),
--     (v_tenant_id, '5400', 'Interest Expense',                   'expense', true),
--     (v_tenant_id, '5500', 'Bad Debt Expense',                   'expense', true),
--     (v_tenant_id, '5900', 'Miscellaneous Expense',              'expense', true)
--   ON CONFLICT (tenant_id, code) DO NOTHING;
--
--   -- Wire parent/child relationships by code.
--   UPDATE chart_of_accounts c
--   SET parent_id = p.id
--   FROM (VALUES
--     ('1010','1000'), ('1020','1000'), ('1030','1000'), ('1040','1000'),
--     ('1050','1000'), ('1060','1000'), ('1500','1000'), ('1600','1000'),
--     ('1510','1500'), ('1520','1500'), ('1530','1500'), ('1540','1500'), ('1590','1500'),
--     ('2010','2000'), ('2020','2000'), ('2030','2000'), ('2040','2000'),
--     ('2050','2000'), ('2060','2000'), ('2500','2000'),
--     ('2510','2500'), ('2520','2500'),
--     ('3010','3000'), ('3020','3000'), ('3030','3000'), ('3040','3000'),
--     ('4010','4000'), ('4020','4000'), ('4030','4000'), ('4040','4000'), ('4900','4000'),
--     ('5010','5000'), ('5100','5000'), ('5200','5000'), ('5220','5000'),
--     ('5230','5000'), ('5240','5000'), ('5250','5000'), ('5260','5000'),
--     ('5270','5000'), ('5280','5000'), ('5290','5000'), ('5300','5000'),
--     ('5400','5000'), ('5500','5000'), ('5900','5000'),
--     ('5110','5100'), ('5120','5100'),
--     ('5210','5200')
--   ) AS m(code, parent_code)
--   JOIN chart_of_accounts p ON p.code = m.parent_code AND p.tenant_id = v_tenant_id
--   WHERE c.code = m.code AND c.tenant_id = v_tenant_id;
-- END $$;


-- ============================================================================
--  DONE
--
--  Verify the RLS recursion fix took:
--    SELECT proname, prosecdef FROM pg_proc
--    WHERE proname IN ('current_tenant_id','current_user_role');
--    -- both rows should show prosecdef = true
--
--  Then sign in as the super admin and create tenants, users and module
--  installs from the Admin Panel at /admin — no further SQL required.
-- ============================================================================
