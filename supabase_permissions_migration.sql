-- ============================================================
-- NexusERP — Permission Migration
-- Run this AFTER supabase_schema.sql
-- Adds per-user, per-module, per-action permission overrides.
-- ============================================================

-- ── tenant_user_permissions ───────────────────────────────────
-- One row per (tenant, user, module).
-- NULL means "inherit from role default" — only explicit
-- true/false overrides the role default for that action.
-- This is intentional: you only store what differs from default.
CREATE TABLE IF NOT EXISTS tenant_user_permissions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id)       ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  module_id    TEXT NOT NULL,

  -- NULL = inherit from role, true = allow, false = deny
  can_view     BOOLEAN DEFAULT NULL,
  can_create   BOOLEAN DEFAULT NULL,
  can_edit     BOOLEAN DEFAULT NULL,
  can_delete   BOOLEAN DEFAULT NULL,
  can_approve  BOOLEAN DEFAULT NULL,
  can_export   BOOLEAN DEFAULT NULL,

  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   UUID REFERENCES auth.users(id),

  UNIQUE (tenant_id, user_id, module_id)
);

-- Index for the most common query: "give me all permissions for user X in tenant Y"
CREATE INDEX IF NOT EXISTS idx_tup_tenant_user
  ON tenant_user_permissions (tenant_id, user_id);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE tenant_user_permissions ENABLE ROW LEVEL SECURITY;

-- Super admins see everything
CREATE POLICY "super_admin_tup"
  ON tenant_user_permissions FOR ALL
  USING (is_super_admin());

-- Members can read permissions within their tenant
CREATE POLICY "read_own_tenant_tup"
  ON tenant_user_permissions FOR SELECT
  USING (tenant_id = current_tenant_id());

-- Only owners/admins can write permission rows
CREATE POLICY "admin_manage_tup"
  ON tenant_user_permissions FOR ALL
  USING (
    tenant_id = current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM tenant_users tu
      WHERE tu.user_id   = auth.uid()
        AND tu.tenant_id = current_tenant_id()
        AND tu.role IN ('owner', 'admin')
    )
  );

-- ── Helper: fetch resolved permissions for current user ───────
-- Returns one row per module with true/false resolved values.
-- Resolution order: explicit override → role default.
-- Used by the app on login to build the permission map in memory.
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID, p_tenant_id UUID)
RETURNS TABLE (
  module_id   TEXT,
  can_view    BOOLEAN,
  can_create  BOOLEAN,
  can_edit    BOOLEAN,
  can_delete  BOOLEAN,
  can_approve BOOLEAN,
  can_export  BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    tup.module_id,
    tup.can_view,
    tup.can_create,
    tup.can_edit,
    tup.can_delete,
    tup.can_approve,
    tup.can_export
  FROM tenant_user_permissions tup
  WHERE tup.tenant_id = p_tenant_id
    AND tup.user_id   = p_user_id;
$$;
