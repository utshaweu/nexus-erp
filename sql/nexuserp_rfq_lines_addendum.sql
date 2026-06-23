-- ============================================================
--  NexusERP — RFQ Line Items Addendum
--  Run AFTER nexuserp_complete_migration.sql
--  Safe to re-run (idempotent via IF NOT EXISTS / DROP+CREATE).
--
--  This file:
--    1. Creates the rfq_lines table (product + quantity per RFQ)
--    2. Applies RLS (super-admin + tenant), mirroring the bulk loop
--    3. Adds performance indexes
--
--  RFQ lines hold only the requested product + quantity — pricing
--  comes from the vendor's quote (rfqs.quoted_amount). On "Convert
--  to PO" these lines are copied into purchase_order_lines.
-- ============================================================

-- ────────────────────────────────────────────────────────────
--  1 — RFQ_LINES TABLE
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rfq_lines (
  id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rfq_id       UUID          NOT NULL REFERENCES rfqs(id)    ON DELETE CASCADE,
  product_name TEXT          NOT NULL,
  quantity     NUMERIC(10,2) NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
--  2 — ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────

ALTER TABLE rfq_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_rfq_lines" ON rfq_lines;
DROP POLICY IF EXISTS "tenant_rfq_lines"      ON rfq_lines;

CREATE POLICY "super_admin_rfq_lines" ON rfq_lines FOR ALL USING (is_super_admin());
CREATE POLICY "tenant_rfq_lines"      ON rfq_lines FOR ALL USING (tenant_id = current_tenant_id());

-- ────────────────────────────────────────────────────────────
--  3 — PERFORMANCE INDEXES
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_rfq_lines_rfq    ON rfq_lines (rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_lines_tenant ON rfq_lines (tenant_id);
