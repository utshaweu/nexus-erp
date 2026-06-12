-- ============================================================
--  NexusERP — RLS Infinite Recursion Fix
--  Run this in Supabase SQL Editor.
--
--  Problem: current_tenant_id() queries tenant_users →
--           tenant_users RLS calls current_tenant_id() →
--           infinite recursion.
--
--  Fix:
--    1. Make current_tenant_id() SECURITY DEFINER so it
--       bypasses RLS when reading tenant_users.
--    2. Add current_user_role() SECURITY DEFINER to replace
--       the self-referential EXISTS subquery in admin_manage.
--    3. Recreate the three admin_manage policies that had
--       the self-referential subquery.
-- ============================================================


-- ────────────────────────────────────────────────────────────
--  FIX 1 — current_tenant_id() → SECURITY DEFINER
--  Now runs as the function owner (superuser), bypassing RLS
--  on tenant_users. Breaks the primary recursion loop.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT tenant_id
  FROM   tenant_users
  WHERE  user_id   = auth.uid()
    AND  is_active = true
  LIMIT  1;
$$;


-- ────────────────────────────────────────────────────────────
--  FIX 2 — current_user_role() helper (SECURITY DEFINER)
--  Replaces the self-referential EXISTS subquery that caused
--  the second recursion path inside admin_manage policies.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role
  FROM   tenant_users
  WHERE  user_id   = auth.uid()
    AND  tenant_id = current_tenant_id()
    AND  is_active = true
  LIMIT  1;
$$;


-- ────────────────────────────────────────────────────────────
--  FIX 3 — Recreate admin_manage on tenant_users
--  Old policy had: EXISTS (SELECT 1 FROM tenant_users ...)
--  which queried tenant_users from inside tenant_users RLS
--  → second recursion path.
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "admin_manage" ON tenant_users;
CREATE POLICY "admin_manage" ON tenant_users FOR ALL USING (
  tenant_id = current_tenant_id() AND
  current_user_role() IN ('owner','admin')
);


-- ────────────────────────────────────────────────────────────
--  FIX 4 — Recreate admin_manage on tenant_modules
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "admin_manage" ON tenant_modules;
CREATE POLICY "admin_manage" ON tenant_modules FOR ALL USING (
  tenant_id = current_tenant_id() AND
  current_user_role() IN ('owner','admin')
);


-- ────────────────────────────────────────────────────────────
--  FIX 5 — Recreate admin_manage on tenant_user_permissions
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "admin_manage" ON tenant_user_permissions;
CREATE POLICY "admin_manage" ON tenant_user_permissions FOR ALL USING (
  tenant_id = current_tenant_id() AND
  current_user_role() IN ('owner','admin')
);


-- ────────────────────────────────────────────────────────────
--  DONE — Verify by running:
--    SELECT proname, prosecdef FROM pg_proc
--    WHERE proname IN ('current_tenant_id','current_user_role');
--  Both rows should show prosecdef = true.
-- ────────────────────────────────────────────────────────────
