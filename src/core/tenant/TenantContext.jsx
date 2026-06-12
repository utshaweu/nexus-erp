import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '@/shared/api/supabase'

/**
 * TenantContext
 * ─────────────
 * Single source of truth for "which tenant is the logged-in user in".
 * All components that need tenant data read from this context.
 *
 * Shape of `tenant`:
 *   { id, name, slug, logo_url, plan, status, settings }
 *
 * Shape of `tenantUser`:
 *   { id, tenant_id, user_id, role, full_name, avatar_url, is_active }
 */

const TenantContext = createContext(null)

export function TenantProvider({ children }) {
  const [tenant, setTenant]         = useState(null)   // current tenant row
  const [tenantUser, setTenantUser] = useState(null)   // current membership row
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)

  /**
   * loadTenantForUser
   * Fetches the tenant and membership that belong to the given Supabase auth user.
   * Called once after sign-in.
   */
  const loadTenantForUser = useCallback(async (userId) => {
    setLoading(true)
    setError(null)

    try {
      // 1. Find the membership row (tenant_users)
      const { data: membership, error: memberErr } = await supabase
        .from('tenant_users')
        .select('*, tenant:tenants(*)')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle()

      if (memberErr) throw memberErr
      if (!membership) throw new Error('No tenant membership found for this user.')

      setTenantUser(membership)
      setTenant(membership.tenant)

      // Expose globally so non-React code (e.g. EventBus handlers) can read it
      window.__erp_tenant__      = membership.tenant
      window.__erp_tenant_user__ = membership

      // Sync role onto __erp_user__ so the permission engine (which reads
      // window.__erp_user__.role) resolves ROLE_DEFAULTS correctly.
      if (window.__erp_user__) {
        window.__erp_user__.role = membership.role
      }

    } catch (err) {
      setError(err.message)
      setTenant(null)
      setTenantUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  /** Clear tenant state on sign-out */
  const clearTenant = useCallback(() => {
    setTenant(null)
    setTenantUser(null)
    setError(null)
    window.__erp_tenant__      = null
    window.__erp_tenant_user__ = null
    if (window.__erp_user__) {
      window.__erp_user__.role = null
    }
  }, [])

  /** Refresh tenant settings from DB (e.g. after settings save) */
  const refreshTenant = useCallback(async () => {
    if (!tenant?.id) return
    const { data } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenant.id)
      .single()
    if (data) {
      setTenant(data)
      window.__erp_tenant__ = data
    }
  }, [tenant?.id])

  return (
    <TenantContext.Provider value={{
      tenant,
      tenantUser,
      loading,
      error,
      loadTenantForUser,
      clearTenant,
      refreshTenant,
      // Convenience helpers used across the app
      tenantId:   tenant?.id   ?? null,
      tenantName: tenant?.name ?? '',
      userRole:   tenantUser?.role ?? null,
      isOwner:    tenantUser?.role === 'owner',
      isAdmin:    ['owner', 'admin'].includes(tenantUser?.role),
      isManager:  ['owner', 'admin', 'manager'].includes(tenantUser?.role),
    }}>
      {children}
    </TenantContext.Provider>
  )
}

/**
 * useTenant()
 * Consume TenantContext anywhere in the tree.
 * Throws if used outside <TenantProvider>.
 */
export function useTenant() {
  const ctx = useContext(TenantContext)
  if (!ctx) throw new Error('useTenant must be used inside <TenantProvider>')
  return ctx
}

export default TenantContext
