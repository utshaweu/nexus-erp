import { useState, useEffect, useContext } from 'react'
import { supabase } from '@/shared/api/supabase'
import useStore from '@core/store/useStore'
import registry from '@core/registry/ModuleRegistry'
import TenantContext from '@core/tenant/TenantContext'
import PermissionContext from '@core/permissions/PermissionContext'

/**
 * useAuth
 * ───────
 * Manages Supabase auth and drives the full bootstrap chain on login.
 *
 * Bootstrap order (each step depends on the previous):
 *   1. Build app user object from Supabase session
 *   2. Load tenant + membership  (TenantContext)
 *   3. Load installed modules    (ModuleRegistry)
 *   4. Load user permissions     (PermissionContext)  ← NEW
 *
 * Teardown on sign-out clears all four in reverse order.
 *
 * Memory-leak safety:
 *   The Supabase auth subscription is unsubscribed in the useEffect
 *   cleanup. The isMounted pattern is NOT needed here because
 *   setLoading is the only setState called outside async, and it is
 *   synchronous within the useEffect body.
 */
export function useAuth() {
  const { setUser, setSession, logout } = useStore()
  const tenantCtx     = useContext(TenantContext)
  const permissionCtx = useContext(PermissionContext)
  const [loading, setLoading] = useState(true)

  // ── Bootstrap ─────────────────────────────────────────────────
  const bootstrap = async (session) => {
    const rawUser = session.user

    // 1. Build the app-level user object (no permissions yet)
    const user = {
      id:          rawUser.id,
      email:       rawUser.email,
      name:        rawUser.user_metadata?.full_name ?? rawUser.email,
      isSuperAdmin: rawUser.user_metadata?.is_super_admin === true,
      permissions: {}, // populated in step 4
    }
    setUser(user)
    setSession(session)
    window.__erp_user__ = user

    // Super admins have no tenant_users row — they access all tenants
    // via the /admin panel. Skip steps 2-4 entirely for them.
    if (!user.isSuperAdmin) {
      // 2. Load the tenant this user belongs to
      await tenantCtx.loadTenantForUser(rawUser.id)

      // window.__erp_tenant__ is set by TenantContext after step 2
      const tenantId = window.__erp_tenant__?.id
      if (!tenantId) return // no tenant → AuthGuard will show error screen

      // 3. Load installed modules for this tenant
      await registry.loadForTenant(tenantId)

      // 4. Load per-user permission overrides
      //    This populates window.__erp_user__.permissions
      await permissionCtx.loadPermissions(rawUser.id, tenantId)
    }
  }

  // ── Teardown ──────────────────────────────────────────────────
  const teardown = () => {
    permissionCtx.clearPermissions()
    registry.clearActiveTenant()
    tenantCtx.clearTenant()
    logout()
    window.__erp_user__        = null
    window.__erp_tenant__      = null
    window.__erp_tenant_user__ = null
  }

  // ── Auth state listener ───────────────────────────────────────
  useEffect(() => {
    let mounted = true

    // Restore session on page refresh
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) await bootstrap(session)
      if (mounted) setLoading(false)
    })

    // Listen to future sign-in / sign-out events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          await bootstrap(session)
        } else if (event === 'SIGNED_OUT') {
          teardown()
        }
        if (mounted) setLoading(false)
      }
    )

    // Cleanup — unsubscribe from Supabase auth listener
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Public sign-in / sign-up / sign-out ──────────────────────
  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signUp = async (email, password, fullName) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    return { error }
  }

  const signOut = () => supabase.auth.signOut()

  const { user } = useStore()
  return { user, loading, signIn, signUp, signOut }
}
