-- ============================================================
--  NexusERP — Feature-Level Permissions Addendum
--  Run this AFTER nexuserp_module_catalog_addendum.sql
--
--  Adds an optional feature_id to tenant_user_permissions so an
--  admin can grant/deny a single menu item within ANY module (e.g.
--  Configuration → Company, Assets → Maintenance, Accounts → Bills)
--  instead of only the whole module.
--
--  feature_id = ''  → module-level row (existing behaviour, unchanged)
--  feature_id = <id> → override for one menu item's featureId
--    (the id set in module_catalog.menu_items[].requiredPermission.featureId)
--
--  Uses '' rather than NULL as the "whole module" sentinel so the
--  4-column UNIQUE constraint below stays a plain (non-partial) index —
--  required for Supabase's upsert(..., { onConflict }) to work.
-- ============================================================

ALTER TABLE tenant_user_permissions ADD COLUMN IF NOT EXISTS feature_id TEXT NOT NULL DEFAULT '';

ALTER TABLE tenant_user_permissions
  DROP CONSTRAINT IF EXISTS tenant_user_permissions_tenant_id_user_id_module_id_key;

ALTER TABLE tenant_user_permissions
  ADD CONSTRAINT tenant_user_permissions_tenant_id_user_id_module_id_feature_id_key
  UNIQUE (tenant_id, user_id, module_id, feature_id);

CREATE INDEX IF NOT EXISTS idx_tup_feature ON tenant_user_permissions (tenant_id, user_id, module_id, feature_id);

-- ── Wire up EVERY module's menu items with feature ids ──────────
-- Generic, not per-module: for every row in module_catalog, every menu
-- item gets requiredPermission.featureId = its own item id (e.g.
-- "asset-maintenance", "acc-bills"), and requiredPermission.moduleId/action
-- are filled in too (kept if already set, defaulting action to "view").
-- Merges onto each item BY ID rather than replacing menu_items wholesale —
-- preserves any label/icon/order edits made via the Supabase table editor,
-- and automatically covers modules added to the catalog later since it
-- runs over the whole table with no per-module id list to maintain.
UPDATE module_catalog
SET menu_items = COALESCE((
  SELECT jsonb_agg(
    CASE
      WHEN elem ? 'id' THEN elem || jsonb_build_object(
        'requiredPermission', jsonb_build_object(
          'action',    COALESCE(elem->'requiredPermission'->>'action', 'view'),
          'moduleId',  module_catalog.module_id,
          'featureId', elem->>'id'
        )
      )
      ELSE elem
    END
    ORDER BY ord
  )
  FROM jsonb_array_elements(menu_items) WITH ORDINALITY AS t(elem, ord)
), menu_items), -- empty menu_items ([]) → jsonb_agg returns NULL; keep the original [] instead
updated_at = now();
