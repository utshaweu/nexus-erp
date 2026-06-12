-- ============================================================
--  NexusERP — Supplement Migration v1.1
--  Run this AFTER nexuserp_complete_migration.sql.
--
--  Fills the gaps identified in the original migration:
--    1. updated_at auto-triggers (7 existing tables)
--    2. Missing number generators (RFQ, Bill, Stock Move, JE)
--    3. bill_lines table
--    4. fiscal_periods table
--    5. journal_entries + journal_entry_lines tables
--    6. inventory_levels view (current on-hand qty)
--    7. reports_saved_queries table
--    8. RLS on all new tables
--    9. Missing performance indexes on existing tables
--
--  Safe to run on an existing database.
--  Does NOT modify any table, policy, or function from the
--  original migration — only adds new objects.
-- ============================================================


-- ────────────────────────────────────────────────────────────
--  SUPPLEMENT 1 — updated_at AUTO-TRIGGER
--  Several tables have updated_at columns but no trigger to
--  keep them current. This fixes that for all affected tables.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_sales_orders_updated_at
  BEFORE UPDATE ON sales_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_assets_updated_at
  BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ────────────────────────────────────────────────────────────
--  SUPPLEMENT 2 — MISSING NUMBER GENERATORS
--  The original migration generated PO/SO/INV/AST/APR numbers
--  but left RFQ, Bill, Stock Move, and Journal Entry without
--  sequences or generator functions.
-- ────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS rfq_seq   START 1;
CREATE SEQUENCE IF NOT EXISTS bill_seq  START 1;
CREATE SEQUENCE IF NOT EXISTS stock_seq START 1;
CREATE SEQUENCE IF NOT EXISTS je_seq    START 1;

CREATE OR REPLACE FUNCTION generate_rfq_number()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'RFQ-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('rfq_seq')::TEXT,4,'0');
$$;

CREATE OR REPLACE FUNCTION generate_bill_number()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'BILL-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('bill_seq')::TEXT,4,'0');
$$;

CREATE OR REPLACE FUNCTION generate_stock_number()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'SM-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('stock_seq')::TEXT,4,'0');
$$;

CREATE OR REPLACE FUNCTION generate_je_number()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'JE-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('je_seq')::TEXT,4,'0');
$$;


-- ────────────────────────────────────────────────────────────
--  SUPPLEMENT 3 — BILL LINES
--  The bills table stores totals but has no line-item table,
--  unlike purchase_orders (purchase_order_lines) and
--  sales_orders (sales_order_lines).
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bill_lines (
  id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bill_id      UUID          NOT NULL REFERENCES bills(id)   ON DELETE CASCADE,
  product_name TEXT          NOT NULL,
  quantity     NUMERIC(10,2) NOT NULL,
  unit_price   NUMERIC(15,2) NOT NULL,
  tax_rate     NUMERIC(5,2)  DEFAULT 0,
  total_price  NUMERIC(15,2)
);

CREATE INDEX IF NOT EXISTS idx_bill_lines_bill_id ON bill_lines(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_lines_tenant  ON bill_lines(tenant_id);


-- ────────────────────────────────────────────────────────────
--  SUPPLEMENT 4 — FISCAL PERIODS
--  Required by the Configuration module's "Fiscal Periods"
--  page (src/modules/configuration/pages/FiscalPeriods.jsx).
--  Also referenced by journal entries below.
-- ────────────────────────────────────────────────────────────

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

CREATE INDEX IF NOT EXISTS idx_fiscal_periods_tenant ON fiscal_periods(tenant_id, status);


-- ────────────────────────────────────────────────────────────
--  SUPPLEMENT 5 — JOURNAL ENTRIES (double-entry accounting)
--  The Accounts module has chart_of_accounts, invoices, and
--  bills but no table to record the actual debit/credit
--  journal entries those transactions generate.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS journal_entries (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id)      ON DELETE CASCADE,
  entry_number     TEXT        NOT NULL,
  entry_date       DATE        NOT NULL DEFAULT CURRENT_DATE,
  reference        TEXT,
  description      TEXT,
  status           TEXT        NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','posted','reversed')),
  fiscal_period_id UUID        REFERENCES fiscal_periods(id),
  created_by       UUID        REFERENCES auth.users(id),
  posted_by        UUID        REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, entry_number)
);

CREATE INDEX IF NOT EXISTS idx_je_tenant_status ON journal_entries(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_je_tenant_period ON journal_entries(tenant_id, fiscal_period_id);

CREATE OR REPLACE TRIGGER trg_journal_entries_updated_at
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Each journal entry must balance: SUM(debit) = SUM(credit)
-- Enforce this in application code or a DB trigger as needed.
CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID          NOT NULL REFERENCES tenants(id)         ON DELETE CASCADE,
  journal_entry_id UUID          NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id       UUID          NOT NULL REFERENCES chart_of_accounts(id),
  description      TEXT,
  debit            NUMERIC(15,2) NOT NULL DEFAULT 0,
  credit           NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jel_entry_id   ON journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_jel_account_id ON journal_entry_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_jel_tenant     ON journal_entry_lines(tenant_id);


-- ────────────────────────────────────────────────────────────
--  SUPPLEMENT 6 — INVENTORY LEVELS VIEW
--  stock_moves records every movement but gives no single
--  "current quantity" answer. This view replays all moves to
--  compute on-hand qty per product per warehouse.
--
--  Move type logic:
--    incoming / adjustment → add qty to dest_warehouse
--    outgoing              → deduct qty from source_warehouse
--    internal              → deduct from source, add to dest
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW inventory_levels
  WITH (security_invoker = true)
AS
WITH moves AS (
  -- incoming + adjustment: qty arrives at destination
  SELECT tenant_id, product_id, dest_warehouse_id AS warehouse_id,  quantity AS delta
  FROM   stock_moves
  WHERE  move_type IN ('incoming','adjustment')
    AND  dest_warehouse_id IS NOT NULL
  UNION ALL
  -- outgoing: qty leaves source
  SELECT tenant_id, product_id, source_warehouse_id AS warehouse_id, -quantity AS delta
  FROM   stock_moves
  WHERE  move_type = 'outgoing'
    AND  source_warehouse_id IS NOT NULL
  UNION ALL
  -- internal: add to destination ...
  SELECT tenant_id, product_id, dest_warehouse_id AS warehouse_id,   quantity AS delta
  FROM   stock_moves
  WHERE  move_type = 'internal'
    AND  dest_warehouse_id IS NOT NULL
  UNION ALL
  -- ... and deduct from source
  SELECT tenant_id, product_id, source_warehouse_id AS warehouse_id, -quantity AS delta
  FROM   stock_moves
  WHERE  move_type = 'internal'
    AND  source_warehouse_id IS NOT NULL
)
SELECT
  m.tenant_id,
  m.product_id,
  p.sku,
  p.name            AS product_name,
  p.unit_of_measure,
  m.warehouse_id,
  w.name            AS warehouse_name,
  SUM(m.delta)      AS qty_on_hand
FROM   moves m
JOIN   products   p ON p.id = m.product_id
JOIN   warehouses w ON w.id = m.warehouse_id
GROUP  BY m.tenant_id, m.product_id, p.sku, p.name, p.unit_of_measure,
          m.warehouse_id, w.name;


-- ────────────────────────────────────────────────────────────
--  SUPPLEMENT 7 — REPORTS SAVED QUERIES
--  The Reports module store slice declares savedReports and
--  scheduledReports but these were never persisted to the DB.
-- ────────────────────────────────────────────────────────────

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

CREATE INDEX IF NOT EXISTS idx_rsq_tenant ON reports_saved_queries(tenant_id);

CREATE OR REPLACE TRIGGER trg_rsq_updated_at
  BEFORE UPDATE ON reports_saved_queries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ────────────────────────────────────────────────────────────
--  SUPPLEMENT 8 — RLS ON ALL NEW TABLES
--  Same two-policy pattern as the original migration:
--    super admins bypass all, regular users see own tenant.
-- ────────────────────────────────────────────────────────────

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'bill_lines',
    'fiscal_periods',
    'journal_entries',
    'journal_entry_lines',
    'reports_saved_queries'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format(
      'CREATE POLICY "super_admin_%1$s" ON %1$I FOR ALL USING (is_super_admin())', tbl);
    EXECUTE format(
      'CREATE POLICY "tenant_%1$s" ON %1$I FOR ALL USING (tenant_id = current_tenant_id())', tbl);
  END LOOP;
END $$;


-- ────────────────────────────────────────────────────────────
--  SUPPLEMENT 9 — MISSING PERFORMANCE INDEXES (existing tables)
--  Foreign-key columns that were not indexed in the original
--  migration — these cause sequential scans on every join.
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_pol_purchase_order_id ON purchase_order_lines(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_sol_sales_order_id    ON sales_order_lines(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_aws_steps_workflow    ON approval_workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_aa_request_id         ON approval_actions(request_id);
CREATE INDEX IF NOT EXISTS idx_lr_employee_id        ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_adl_asset_id          ON asset_depreciation_logs(asset_id);
CREATE INDEX IF NOT EXISTS idx_aml_asset_id          ON asset_maintenance_logs(asset_id);


-- ────────────────────────────────────────────────────────────
--  DONE
--  The schema is now complete. Summary of what was added:
--    • set_updated_at() trigger on 7 existing tables
--    • Sequences + generators: RFQ, BILL, SM, JE number formats
--    • New tables: bill_lines, fiscal_periods, journal_entries,
--      journal_entry_lines, reports_saved_queries
--    • New view:   inventory_levels
--    • RLS on all 5 new tables (super_admin + tenant policies)
--    • 7 missing FK indexes on existing tables
-- ────────────────────────────────────────────────────────────
