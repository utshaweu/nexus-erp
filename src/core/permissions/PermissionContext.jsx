import {
  createContext, useContext, useState,
  useCallback, useRef, useEffect,
} from 'react'
import { supabase } from '@/shared/api/supabase'
import {
  can as coreCan,
  canAccessModule as coreCanAccessModule,
  buildPermissionMap,
  ACTIONS,
} from '@core/permissions/permissions'

/**
 * PermissionContext
 * ─────────────────
 * Owns the per-user, per-module permission overrides loaded from
 * tenant_user_permissions after login.
 *
 * Exposes:
 *   can(action, moduleId?)        → boolean
 *   canAccessModule(moduleId)     → boolean  (used by Sidebar + Router)
 *   permissions                   → raw map  (used by editor UI)
 *   loadPermissions(userId, tenantId) → called once after login
 *   clearPermissions()            → called on logout
 *   refreshPermissions()          → called after admin saves changes
 *
 * Memory-leak prevention:
 *   - The Supabase subscription is cleaned up in a useEffect return.
 *   - isMounted ref prevents setState after unmount.
 *   - No dangling setInterval / setTimeout.
 */

const PermissionContext = createContext(null)

export function PermissionProvider({ children }) {
  // { [moduleId]: { view: bool|null, create: bool|null, … } }
  const [permissions, setPermissions] = useState({})
  const [loading, setLoading]         = useState(false)

  // Track the current (userId, tenantId) so refreshPermissions() can
  // re-fetch without needing them passed in again.
  const currentRef = useRef({ userId: null, tenantId: null })

  // Prevent setState after unmount
  const isMounted = useRef(true)
  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  // ── Realtime subscription ref ────────────────────────────────
  // We subscribe to changes in tenant_user_permissions so that
  // if an admin changes a user's permissions while they're logged in,
  // the UI updates immediately without a page reload.
  const realtimeChannelRef = useRef(null)

  const _subscribe = useCallback((userId, tenantId) => {
    // Clean up any previous subscription first
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current)
      realtimeChannelRef.current = null
    }

    const channel = supabase
      .channel(`permissions:${userId}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'tenant_user_permissions',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // Re-fetch on any change (INSERT / UPDATE / DELETE)
          _fetchPermissions(userId, tenantId)
        }
      )
      .subscribe()

    realtimeChannelRef.current = channel
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const _unsubscribe = useCallback(() => {
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current)
      realtimeChannelRef.current = null
    }
  }, [])

  // ── Fetch ────────────────────────────────────────────────────
  const _fetchPermissions = useCallback(async (userId, tenantId) => {
    if (!userId || !tenantId) return

    try {
      const { data, error } = await supabase
        .from('tenant_user_permissions')
        .select('module_id, can_view, can_create, can_edit, can_delete, can_approve, can_export')
        .eq('tenant_id', tenantId)
        .eq('user_id',   userId)

      if (error) throw error

      if (isMounted.current) {
        const map = buildPermissionMap(data ?? [])
        setPermissions(map)
        // Keep global window object in sync for non-React code
        if (window.__erp_user__) {
          window.__erp_user__.permissions = map
        }
      }
    } catch (err) {
      console.error('[PermissionContext] Failed to load permissions:', err.message)
    }
  }, [])

  // ── Public API ───────────────────────────────────────────────

  /** Called by useAuth.bootstrap() immediately after tenant loads */
  const loadPermissions = useCallback(async (userId, tenantId) => {
    if (!userId || !tenantId) return
    currentRef.current = { userId, tenantId }
    setLoading(true)
    await _fetchPermissions(userId, tenantId)
    _subscribe(userId, tenantId)
    if (isMounted.current) setLoading(false)
  }, [_fetchPermissions, _subscribe])

  /** Called by useAuth.teardown() on sign-out */
  const clearPermissions = useCallback(() => {
    _unsubscribe()
    currentRef.current = { userId: null, tenantId: null }
    setPermissions({})
    if (window.__erp_user__) {
      window.__erp_user__.permissions = {}
    }
  }, [_unsubscribe])

  /** Called by TenantUsersPanel after saving changes */
  const refreshPermissions = useCallback(async () => {
    const { userId, tenantId } = currentRef.current
    if (userId && tenantId) {
      await _fetchPermissions(userId, tenantId)
    }
  }, [_fetchPermissions])

  // ── Resolver helpers exposed to components ───────────────────

  /**
   * can(action, moduleId?)
   * The primary check used everywhere in the UI.
   * Reads from window.__erp_user__ so it always has the latest data.
   */
  const can = useCallback((action, moduleId = null) => {
    const user = window.__erp_user__
    return coreCan(user, action, moduleId)
  }, [permissions]) // re-memoize when permissions change

  /** True if the user can view a module at all */
  const canAccessModule = useCallback((moduleId) => {
    const user = window.__erp_user__
    return coreCanAccessModule(user, moduleId)
  }, [permissions])

  // Clean up realtime subscription when the provider unmounts
  useEffect(() => () => _unsubscribe(), [_unsubscribe])

  return (
    <PermissionContext.Provider value={{
      permissions,
      loading,
      can,
      canAccessModule,
      loadPermissions,
      clearPermissions,
      refreshPermissions,
      ACTIONS,
    }}>
      {children}
    </PermissionContext.Provider>
  )
}

/** usePermissions() — consume PermissionContext in any component */
export function usePermissions() {
  const ctx = useContext(PermissionContext)
  if (!ctx) throw new Error('usePermissions must be used inside <PermissionProvider>')
  return ctx
}

export default PermissionContext
