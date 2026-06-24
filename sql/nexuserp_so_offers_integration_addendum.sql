-- ============================================================
--  NexusERP — Sales Order ↔ Offers Integration Addendum
--  Run AFTER nexuserp_offers_addendum.sql + nexuserp_so_discount_amount_addendum.sql
--  Safe to re-run (idempotent via IF NOT EXISTS).
--
--  Adds:
--    1. sales_order_lines.is_gift  — marks auto-added "Buy X Get Y" free lines
--    2. sales_orders.coupon_code + coupon_discount — order-level coupon applied
-- ============================================================

ALTER TABLE sales_order_lines
  ADD COLUMN IF NOT EXISTS is_gift BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS coupon_code     TEXT,
  ADD COLUMN IF NOT EXISTS coupon_discount NUMERIC(15,2) NOT NULL DEFAULT 0;
