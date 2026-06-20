-- ============================================================
--  NexusERP — Offers & Discounts Addendum
--  Run AFTER nexuserp_complete_migration.sql
--  Safe to re-run (idempotent via IF NOT EXISTS / CREATE OR REPLACE).
--
--  This file:
--    1. Creates the offers table
--    2. Adds updated_at auto-trigger
--    3. Applies RLS (DROP + re-CREATE for idempotency)
--    4. Adds performance indexes
-- ============================================================

-- ────────────────────────────────────────────────────────────
--  1 — OFFERS TABLE
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS offers (
  id             UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name           TEXT          NOT NULL,
  description    TEXT,
  offer_type     TEXT          NOT NULL DEFAULT 'percentage'
    CHECK (offer_type IN ('percentage', 'fixed_amount', 'buy_x_get_y')),
  discount_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  coupon_code    TEXT,
  minimum_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  applies_to     TEXT          NOT NULL DEFAULT 'all'
    CHECK (applies_to IN ('all', 'product', 'category', 'customer')),
  applies_to_ref TEXT,
  start_date     DATE,
  end_date       DATE,
  usage_limit    INT,
  usage_count    INT           NOT NULL DEFAULT 0,
  is_active      BOOLEAN       NOT NULL DEFAULT true,
  created_by     UUID          REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Partial unique index: coupon codes must be unique per tenant, but NULL/empty allowed
CREATE UNIQUE INDEX IF NOT EXISTS idx_offers_tenant_coupon
  ON offers (tenant_id, coupon_code)
  WHERE coupon_code IS NOT NULL AND coupon_code != '';

-- ────────────────────────────────────────────────────────────
--  2 — UPDATED_AT TRIGGER
-- ────────────────────────────────────────────────────────────

-- set_updated_at() already exists from approval addendum; no need to re-create

DROP TRIGGER IF EXISTS trg_offers_updated_at ON offers;
CREATE TRIGGER trg_offers_updated_at
  BEFORE UPDATE ON offers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ────────────────────────────────────────────────────────────
--  3 — ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_offers" ON offers;
DROP POLICY IF EXISTS "tenant_offers"      ON offers;

CREATE POLICY "super_admin_offers" ON offers FOR ALL USING (is_super_admin());
CREATE POLICY "tenant_offers"      ON offers FOR ALL USING (tenant_id = current_tenant_id());

-- ────────────────────────────────────────────────────────────
--  4 — PERFORMANCE INDEXES
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_offers_tenant_active
  ON offers (tenant_id, is_active);

CREATE INDEX IF NOT EXISTS idx_offers_tenant_dates
  ON offers (tenant_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_offers_tenant_type
  ON offers (tenant_id, offer_type);

CREATE INDEX IF NOT EXISTS idx_offers_tenant_created
  ON offers (tenant_id, created_at DESC);
