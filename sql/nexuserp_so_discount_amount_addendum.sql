-- ============================================================
--  NexusERP — Sales Order Line: Fixed-Amount Discount Addendum
--  Run AFTER nexuserp_complete_migration.sql
--  Safe to re-run (idempotent via IF NOT EXISTS).
--
--  Adds discount_amount to sales_order_lines so a line discount can
--  be a fixed $ amount as well as a percentage (discount_pct). The UI
--  uses exactly one of the two per line (the other stays 0).
-- ============================================================

ALTER TABLE sales_order_lines
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0;
