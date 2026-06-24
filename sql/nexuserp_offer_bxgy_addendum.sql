-- ============================================================
--  NexusERP — Offers: Buy X Get Y Free Items Addendum
--  Run AFTER nexuserp_offers_addendum.sql
--  Safe to re-run (idempotent via IF NOT EXISTS).
--
--  Lets a "buy_x_get_y" offer name WHICH product/qty must be bought
--  and WHICH product/qty is given free (previously only two bare
--  numbers were stored via discount_value / applies_to_ref).
-- ============================================================

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS buy_product_name TEXT,
  ADD COLUMN IF NOT EXISTS buy_quantity     NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS get_product_name TEXT,
  ADD COLUMN IF NOT EXISTS get_quantity     NUMERIC(10,2);
