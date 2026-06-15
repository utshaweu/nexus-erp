-- ============================================================
--  NexusERP — Inventory Module Addendum
--  Run AFTER nexuserp_complete_migration.sql and
--             nexuserp_supplement_migration.sql
--
--  Adds:
--    1. Missing performance indexes for inventory queries
--    2. Confirms inventory_levels view and generate_stock_number()
--       are present (safe IF NOT EXISTS guards)
--    3. Low-stock RPC helper for the dashboard
-- ============================================================


-- ────────────────────────────────────────────────────────────
--  1 — PERFORMANCE INDEXES
--  The base migration indexed products(tenant_id) and
--  stock_moves(tenant_id, product_id), but the inventory
--  module also filters by status and category.
-- ────────────────────────────────────────────────────────────

-- products: status filter (Products page status tabs)
CREATE INDEX IF NOT EXISTS idx_products_tenant_status
  ON products(tenant_id, status);

-- products: category grouping (Dashboard chart)
CREATE INDEX IF NOT EXISTS idx_products_tenant_category
  ON products(tenant_id, category);

-- warehouses: active warehouse lookups (Stock Move modal dropdown)
CREATE INDEX IF NOT EXISTS idx_warehouses_tenant_status
  ON warehouses(tenant_id, status);

-- stock_moves: move type filter (Stock Moves page tabs)
CREATE INDEX IF NOT EXISTS idx_stock_moves_tenant_type
  ON stock_moves(tenant_id, move_type);

-- stock_moves: date ordering (Stock Moves page default sort)
CREATE INDEX IF NOT EXISTS idx_stock_moves_tenant_date
  ON stock_moves(tenant_id, move_date DESC);


-- ────────────────────────────────────────────────────────────
--  2 — STOCK NUMBER SEQUENCE (guard if supplement not run)
-- ────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS stock_seq START 1;

CREATE OR REPLACE FUNCTION generate_stock_number()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'SM-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('stock_seq')::TEXT,4,'0');
$$;


-- ────────────────────────────────────────────────────────────
--  3 — INVENTORY LEVELS VIEW (guard if supplement not run)
-- ────────────────────────────────────────────────────────────

-- NOTE: CREATE OR REPLACE VIEW requires existing columns to keep the same
-- name and position. New columns must be appended at the end.
-- The original view (nexuserp_supplement_migration.sql) has these columns in order:
--   tenant_id, product_id, sku, product_name, unit_of_measure,
--   warehouse_id, warehouse_name, qty_on_hand
-- We append reorder_qty as a new column at the end.
CREATE OR REPLACE VIEW inventory_levels
  WITH (security_invoker = true)
AS
WITH moves AS (
  SELECT tenant_id, product_id, dest_warehouse_id AS warehouse_id,  quantity  AS delta
  FROM   stock_moves
  WHERE  move_type IN ('incoming','adjustment') AND dest_warehouse_id IS NOT NULL

  UNION ALL

  SELECT tenant_id, product_id, source_warehouse_id AS warehouse_id, -quantity AS delta
  FROM   stock_moves
  WHERE  move_type = 'outgoing'   AND source_warehouse_id IS NOT NULL

  UNION ALL

  SELECT tenant_id, product_id, dest_warehouse_id   AS warehouse_id,  quantity AS delta
  FROM   stock_moves
  WHERE  move_type = 'internal'   AND dest_warehouse_id IS NOT NULL

  UNION ALL

  SELECT tenant_id, product_id, source_warehouse_id AS warehouse_id, -quantity AS delta
  FROM   stock_moves
  WHERE  move_type = 'internal'   AND source_warehouse_id IS NOT NULL
)
SELECT
  m.tenant_id,
  m.product_id,
  p.sku,
  p.name              AS product_name,
  p.unit_of_measure,
  m.warehouse_id,
  w.name              AS warehouse_name,
  SUM(m.delta)        AS qty_on_hand,
  p.reorder_qty                          -- appended at the end (safe for OR REPLACE)
FROM   moves m
JOIN   products   p ON p.id = m.product_id
JOIN   warehouses w ON w.id = m.warehouse_id
GROUP  BY
  m.tenant_id, m.product_id, p.sku, p.name, p.unit_of_measure,
  m.warehouse_id, w.name, p.reorder_qty;


-- ────────────────────────────────────────────────────────────
--  4 — get_low_stock_items RPC
--  Returns products where qty_on_hand <= reorder_qty.
--  Called from the Dashboard or any other page that needs
--  a full low-stock list without complex client-side joins.
--
--  Usage (from Supabase client):
--    const { data } = await supabase.rpc('get_low_stock_items', {
--      p_tenant_id: tenantId,
--    })
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_low_stock_items(p_tenant_id UUID)
RETURNS TABLE (
  product_id    UUID,
  product_name  TEXT,
  sku           TEXT,
  warehouse_id  UUID,
  warehouse_name TEXT,
  qty_on_hand   NUMERIC,
  reorder_qty   NUMERIC,
  unit_of_measure TEXT
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT
    il.product_id,
    il.product_name,
    il.sku,
    il.warehouse_id,
    il.warehouse_name,
    il.qty_on_hand,
    il.reorder_qty,
    il.unit_of_measure
  FROM   inventory_levels il
  WHERE  il.tenant_id  = p_tenant_id
    AND  il.reorder_qty > 0
    AND  il.qty_on_hand <= il.reorder_qty
  ORDER  BY il.qty_on_hand ASC;
$$;


-- ────────────────────────────────────────────────────────────
--  DONE
--  Summary of additions:
--    • 5 performance indexes on products, warehouses, stock_moves
--    • generate_stock_number() guard (idempotent)
--    • inventory_levels view updated to include reorder_qty column
--    • get_low_stock_items(p_tenant_id) RPC function
-- ────────────────────────────────────────────────────────────
