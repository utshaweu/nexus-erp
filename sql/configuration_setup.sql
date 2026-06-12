-- ============================================================
--  NexusERP — Configuration Module Setup
--  Run this AFTER nexuserp_rls_fix.sql.
--
--  1. UPDATE policy on `tenants` so admins can save company settings
--  2. get_tenant_users_with_email() — reads auth.users via SECURITY DEFINER
--  3. add_tenant_user_by_email()    — adds an existing auth user to the tenant
--  4. Drop the recursive admin_manage_tup policy (replaced by rls_fix.sql)
-- ============================================================


-- ────────────────────────────────────────────────────────────
--  FIX 1 — Allow tenant admins/owners to UPDATE their own row
--  in `tenants`. The base schema only grants SELECT to regular
--  users. Without this, Company settings save returns 403.
--  Requires current_user_role() from nexuserp_rls_fix.sql.
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "admin_update_tenant" ON tenants;
CREATE POLICY "admin_update_tenant" ON tenants
  FOR UPDATE
  USING  (id = current_tenant_id() AND current_user_role() IN ('owner','admin'))
  WITH CHECK (id = current_tenant_id());


-- ────────────────────────────────────────────────────────────
--  FIX 2 — Drop the recursive admin_manage_tup policy on
--  tenant_user_permissions. The nexuserp_rls_fix.sql already
--  added a non-recursive "admin_manage" replacement; this stale
--  policy causes an extra (harmless but wasteful) recursion path.
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "admin_manage_tup" ON tenant_user_permissions;


-- ────────────────────────────────────────────────────────────
--  NEW FUNCTION — get_tenant_users_with_email()
--  Returns all tenant_users rows enriched with the auth.users
--  email field. SECURITY DEFINER so it can join auth.users,
--  scoped to the caller's tenant via current_tenant_id().
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_tenant_users_with_email()
RETURNS TABLE (
  id         UUID,
  tenant_id  UUID,
  user_id    UUID,
  role       TEXT,
  full_name  TEXT,
  email      TEXT,
  avatar_url TEXT,
  is_active  BOOLEAN,
  joined_at  TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  IF current_tenant_id() IS NULL THEN
    RAISE EXCEPTION 'Not a member of any tenant';
  END IF;

  RETURN QUERY
  SELECT
    tu.id,
    tu.tenant_id,
    tu.user_id,
    tu.role,
    tu.full_name,
    au.email,
    tu.avatar_url,
    tu.is_active,
    tu.joined_at
  FROM   tenant_users tu
  JOIN   auth.users   au ON au.id = tu.user_id
  WHERE  tu.tenant_id = current_tenant_id()
  ORDER  BY tu.joined_at ASC;
END;
$$;


-- ────────────────────────────────────────────────────────────
--  NEW FUNCTION — add_tenant_user_by_email(email, role, full_name)
--  Lets a tenant admin add an existing Supabase auth user to
--  their tenant by email address. Returns JSON result.
--  Only callable by owner/admin of the current tenant.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION add_tenant_user_by_email(
  p_email     TEXT,
  p_role      TEXT    DEFAULT 'user',
  p_full_name TEXT    DEFAULT NULL
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id    UUID;
  v_tenant_id  UUID;
  v_full_name  TEXT;
BEGIN
  -- Only admins/owners of the current tenant may call this
  IF current_user_role() NOT IN ('owner','admin') THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  -- Validate role
  IF p_role NOT IN ('owner','admin','manager','user','viewer') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid role');
  END IF;

  v_tenant_id := current_tenant_id();
  v_full_name := COALESCE(NULLIF(TRIM(p_full_name), ''), p_email);

  -- Look up user by email in auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = LOWER(TRIM(p_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No registered user found with that email address. Ask them to sign up first.'
    );
  END IF;

  -- Insert (or re-activate if they were previously removed)
  INSERT INTO tenant_users (tenant_id, user_id, role, full_name, is_active)
  VALUES (v_tenant_id, v_user_id, p_role, v_full_name, true)
  ON CONFLICT (tenant_id, user_id)
  DO UPDATE SET role = EXCLUDED.role, full_name = EXCLUDED.full_name, is_active = true;

  RETURN json_build_object('success', true, 'user_id', v_user_id);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;


-- ────────────────────────────────────────────────────────────
--  DONE — Apply this file after:
--    1. nexuserp_complete_migration.sql
--    2. nexuserp_supplement_migration.sql
--    3. supabase_permissions_migration.sql
--    4. nexuserp_rls_fix.sql
-- ────────────────────────────────────────────────────────────
