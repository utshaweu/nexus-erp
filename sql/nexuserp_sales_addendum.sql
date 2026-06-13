-- ============================================================
--  NexusERP — Sales Addendum Migration
--  Run this AFTER nexuserp_complete_migration.sql
--  Adds the quotations and quotation_lines tables.
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS quot_number_seq START 1;

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
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quotation_id     UUID          NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_name     TEXT          NOT NULL,
  quantity         NUMERIC(10,2) NOT NULL,
  unit_price       NUMERIC(15,2) NOT NULL,
  discount_pct     NUMERIC(5,2)  DEFAULT 0,
  tax_rate         NUMERIC(5,2)  DEFAULT 0,
  total_price      NUMERIC(15,2)
);

-- RLS
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin_quotations"    ON quotations FOR ALL USING (is_super_admin());
CREATE POLICY "tenant_quotations"         ON quotations FOR ALL USING (tenant_id = current_tenant_id());

ALTER TABLE quotation_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin_quotation_lines" ON quotation_lines FOR ALL USING (is_super_admin());
CREATE POLICY "tenant_quotation_lines"      ON quotation_lines FOR ALL USING (tenant_id = current_tenant_id());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quotations_tenant_status   ON quotations (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_quotations_tenant_customer ON quotations (tenant_id, customer_id);

-- Number generator (uses the sequence above)
CREATE OR REPLACE FUNCTION generate_quotation_number()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'Q-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('quot_number_seq')::TEXT,4,'0');
$$;
