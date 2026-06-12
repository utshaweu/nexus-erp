import { createElement, createContext, useContext, useRef, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/shared/api/supabase'
import useStore from '@core/store/useStore'
import registry from '@core/registry/ModuleRegistry'
import TenantContext from '@core/tenant/TenantContext'
import PermissionContext from '@core/permissions/PermissionContext'

/**
 * AuthProvider / useAuth
 * ──────────────────────
 * AuthProvider owns the single Supabase auth subscription and drives the
 * full bootstrap chain. It must be mounted ONCE inside TenantProvider and
 * PermissionProvider.
 *
 * useAuth() is a plain context consumer — calling it from multiple components
 * (AuthGuard, Sidebar, …) does NOT create extra subscriptions, so bootstrap()
 * runs exactly once per auth event.
 *
 * Bootstrap order (each step depends on the previous):
 *   1. Build app user from Supabase session
 *   2. Load tenant + membership  (TenantContext)
 *   3. Load installed modules    (ModuleRegistry)
 *   4. Load per-user permissions (PermissionContext)
 */

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const { setUser, setSession, logout } = useStore()
  const tenantCtx     = useContext(TenantContext)
  const permissionCtx = useContext(PermissionContext)
  const navigate      = useNavigate()
  const [loading, setLoading] = useState(true)

  // Deduplication guard: skip bootstrap if the same access_token fires again
  // (Supabase can fire both INITIAL_SESSION and SIGNED_IN for the same session)
  const lastTokenRef = useRef(null)

  // ── Bootstrap ─────────────────────────────────────────────────
  const bootstrap = async (session) => {
    const rawUser = session.user

    const user = {
      id:           rawUser.id,
      email:        rawUser.email,
      name:         rawUser.user_metadata?.full_name ?? rawUser.email,
      isSuperAdmin: rawUser.user_metadata?.is_super_admin === true,
      permissions:  {},
    }
    setUser(user)
    setSession(session)
    window.__erp_user__ = user

    if (user.isSuperAdmin) {
      // Super admins have no tenant row — clear any stale tenant state from a
      // previous non-admin session so AuthGuard doesn't show NoTenantScreen.
      tenantCtx.clearTenant()
      return
    }

    // 2. Load tenant membership
    await tenantCtx.loadTenantForUser(rawUser.id)

    const tenantId = window.__erp_tenant__?.id
    if (!tenantId) return // no tenant → AuthGuard shows error screen

    // 3. Load installed modules
    await registry.loadForTenant(tenantId)

    // 4. Load per-user permission overrides
    await permissionCtx.loadPermissions(rawUser.id, tenantId)
  }

  // ── Teardown ──────────────────────────────────────────────────
  const teardown = useCallback(() => {
    lastTokenRef.current = null
    permissionCtx.clearPermissions()
    registry.clearActiveTenant()
    tenantCtx.clearTenant()
    logout()
    window.__erp_user__        = null
    window.__erp_tenant__      = null
    window.__erp_tenant_user__ = null
    navigate('/', { replace: true })
  }, [navigate]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Single auth subscription (runs once for the whole app) ────
  useEffect(() => {
    let mounted = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
          if (session) {
            // Skip if we already bootstrapped this exact session token
            if (session.access_token !== lastTokenRef.current) {
              lastTokenRef.current = session.access_token
              await bootstrap(session)
            }
          }
        } else if (event === 'SIGNED_OUT') {
          teardown()
        }
        if (mounted) setLoading(false)
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Public API ────────────────────────────────────────────────
  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const signUp = (email, password, fullName) =>
    supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })

  const signOut = () => supabase.auth.signOut()

  const { user } = useStore()

  return createElement(
    AuthContext.Provider,
    { value: { user, loading, signIn, signUp, signOut } },
    children
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
