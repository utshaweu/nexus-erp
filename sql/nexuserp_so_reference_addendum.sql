-- ============================================================
--  NexusERP — Sales Order: Reference Code Addendum
--  Run AFTER nexuserp_complete_migration.sql
--  Safe to re-run (idempotent via IF NOT EXISTS).
--
--  Adds an optional reference code to sales_orders (e.g. the
--  customer's own PO number / external reference), mirroring the
--  reference column that already exists on purchase_orders.
-- ============================================================

ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS reference TEXT;
