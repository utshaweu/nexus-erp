-- ============================================================
--  NexusERP — Accounts Module Addendum
--  Run AFTER nexuserp_complete_migration.sql
--  Safe to re-run (idempotent).
--
--  Adds:
--    1. invoice_lines   — line items for customer invoices
--    2. bill_lines      — line items for vendor bills
--    3. journal_entries — double-entry journal header
--    4. journal_entry_lines — debit/credit detail rows
--    5. Number-generator functions for bills and journals
--    6. Indexes for common query patterns
-- ============================================================

-- ────────────────────────────────────────────────────────────
--  1 — SEQUENCES & NUMBER GENERATORS
--  generate_invoice_number() already exists in the base migration.
-- ────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS bill_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS je_number_seq   START 1;

CREATE OR REPLACE FUNCTION generate_bill_number()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'BILL-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('bill_number_seq')::TEXT,4,'0');
$$;

CREATE OR REPLACE FUNCTION generate_journal_entry_number()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'JE-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('je_number_seq')::TEXT,4,'0');
$$;

-- ────────────────────────────────────────────────────────────
--  2 — INVOICE LINES
-- ────────────────────────────────────────────────────────────

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

ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_invoice_lines" ON invoice_lines;
DROP POLICY IF EXISTS "tenant_invoice_lines"      ON invoice_lines;
CREATE POLICY "super_admin_invoice_lines" ON invoice_lines FOR ALL USING (is_super_admin());
CREATE POLICY "tenant_invoice_lines"      ON invoice_lines FOR ALL USING (tenant_id = current_tenant_id());

-- ────────────────────────────────────────────────────────────
--  3 — BILL LINES
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bill_lines (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bill_id     UUID          NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  description TEXT          NOT NULL,
  quantity    NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price  NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_rate    NUMERIC(5,2)  NOT NULL DEFAULT 0,
  total_price NUMERIC(15,2) NOT NULL DEFAULT 0
);

ALTER TABLE bill_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_bill_lines" ON bill_lines;
DROP POLICY IF EXISTS "tenant_bill_lines"      ON bill_lines;
CREATE POLICY "super_admin_bill_lines" ON bill_lines FOR ALL USING (is_super_admin());
CREATE POLICY "tenant_bill_lines"      ON bill_lines FOR ALL USING (tenant_id = current_tenant_id());

-- ────────────────────────────────────────────────────────────
--  4 — JOURNAL ENTRIES
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS journal_entries (
  id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entry_number TEXT          NOT NULL,
  entry_date   DATE          NOT NULL DEFAULT CURRENT_DATE,
  description  TEXT,
  reference    TEXT,
  status       TEXT          NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','posted','cancelled')),
  total_debit  NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_credit NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_by   UUID          REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, entry_number)
);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_journal_entries" ON journal_entries;
DROP POLICY IF EXISTS "tenant_journal_entries"      ON journal_entries;
CREATE POLICY "super_admin_journal_entries" ON journal_entries FOR ALL USING (is_super_admin());
CREATE POLICY "tenant_journal_entries"      ON journal_entries FOR ALL USING (tenant_id = current_tenant_id());

-- ────────────────────────────────────────────────────────────
--  5 — JOURNAL ENTRY LINES
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  journal_entry_id UUID          NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id       UUID          NOT NULL REFERENCES chart_of_accounts(id),
  description      TEXT,
  debit_amount     NUMERIC(15,2) NOT NULL DEFAULT 0,
  credit_amount    NUMERIC(15,2) NOT NULL DEFAULT 0
);

ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_journal_entry_lines" ON journal_entry_lines;
DROP POLICY IF EXISTS "tenant_journal_entry_lines"      ON journal_entry_lines;
CREATE POLICY "super_admin_journal_entry_lines" ON journal_entry_lines FOR ALL USING (is_super_admin());
CREATE POLICY "tenant_journal_entry_lines"      ON journal_entry_lines FOR ALL USING (tenant_id = current_tenant_id());

-- ────────────────────────────────────────────────────────────
--  6 — PERFORMANCE INDEXES
--  All guarded with IF NOT EXISTS — safe to re-run.
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice
  ON invoice_lines(invoice_id);

CREATE INDEX IF NOT EXISTS idx_bill_lines_bill
  ON bill_lines(bill_id);

CREATE INDEX IF NOT EXISTS idx_journal_entries_tenant_status
  ON journal_entries(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_journal_entries_tenant_date
  ON journal_entries(tenant_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry
  ON journal_entry_lines(journal_entry_id);

CREATE INDEX IF NOT EXISTS idx_coa_tenant_type
  ON chart_of_accounts(tenant_id, account_type);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_customer
  ON invoices(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_bills_tenant_vendor
  ON bills(tenant_id, vendor_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_date
  ON invoices(tenant_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_bills_tenant_date
  ON bills(tenant_id, bill_date DESC);

-- ────────────────────────────────────────────────────────────
--  DONE
-- ============================================================
