-- ============================================================
--  setup_tenant_user  — SECURITY DEFINER RPC
--  Run in Supabase SQL Editor.
--
--  Problem it solves:
--    supabase.auth.signUp() replaces the client session with the
--    newly-created user's session. Any subsequent direct INSERT into
--    tenant_users fails RLS because the new user is not yet a super
--    admin or a tenant member.
--
--  This function runs as the DB owner (SECURITY DEFINER), bypassing
--  RLS. It adds its own security gate: the caller must be either a
--  super admin OR the user being added with no existing memberships
--  (a freshly-created user registering their first tenant).
-- ============================================================

CREATE OR REPLACE FUNCTION setup_tenant_user(
  p_tenant_id  UUID,
  p_user_id    UUID,
  p_role       TEXT,
  p_full_name  TEXT,
  p_module_ids TEXT[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ── Security gate ───────────────────────────────────────────
  -- Allow if:
  --   (a) caller is a super admin, OR
  --   (b) caller IS the user being added AND they have no existing
  --       membership (prevents users adding themselves to arbitrary tenants)
  IF NOT (
    is_super_admin()
    OR (
      auth.uid() = p_user_id
      AND NOT EXISTS (SELECT 1 FROM tenant_users WHERE user_id = p_user_id)
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to create this membership';
  END IF;

  -- ── Verify tenant exists ────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant_id) THEN
    RAISE EXCEPTION 'Tenant % not found', p_tenant_id;
  END IF;

  -- ── Insert membership ───────────────────────────────────────
  INSERT INTO tenant_users (tenant_id, user_id, role, full_name, is_active)
  VALUES (p_tenant_id, p_user_id, p_role, p_full_name, true)
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  -- ── Install selected modules ────────────────────────────────
  IF p_module_ids IS NOT NULL AND array_length(p_module_ids, 1) > 0 THEN
    INSERT INTO tenant_modules (tenant_id, module_id, installed_by)
    SELECT p_tenant_id, unnest(p_module_ids), p_user_id
    ON CONFLICT (tenant_id, module_id) DO NOTHING;
  END IF;
END;
$$;

-- Grant execute to authenticated users
-- (the function itself enforces who may actually call it)
GRANT EXECUTE ON FUNCTION setup_tenant_user TO authenticated;
