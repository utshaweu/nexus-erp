import { supabase } from '@/shared/api/supabase'
import EventBus from '@core/eventbus/EventBus'

/**
 * ModuleRegistry
 * ──────────────
 * Central plug-in engine.  Tenant-aware: every install/uninstall
 * is scoped to a tenantId so different clients have independent
 * module sets.
 *
 * Public API
 *   registry.register(manifest)           — add a module to the catalogue
 *   registry.install(moduleId, tenantId)  — install for a tenant
 *   registry.uninstall(moduleId, tenantId)— uninstall for a tenant
 *   registry.loadForTenant(tenantId)      — boot from Supabase on login
 *   registry.isInstalled(moduleId)        — check against active tenant
 *   registry.getInstalled()               — manifests for active tenant
 *   registry.getAll()                     — full catalogue
 *   registry.subscribe(fn)                — listen to changes
 */
class ModuleRegistry {
  constructor() {
    /** Map<moduleId, manifest>  — the full catalogue (code-level) */
    this._catalogue = new Map()

    /**
     * Map<tenantId, Set<moduleId>>
     * Each tenant has its own install set.
     * We keep them all in memory so switching tenants is instant.
     */
    this._tenantInstalls = new Map()

    /** Currently active tenantId (set after login) */
    this._activeTenantId = null

    /** Change listeners */
    this._listeners = []
  }

  // ─────────────────────────────────────────────────────────────
  // Registration (happens once at app startup, before any login)
  // ─────────────────────────────────────────────────────────────

  /** Add a module manifest to the catalogue */
  register(manifest) {
    if (!manifest?.id) throw new Error('Module manifest must have an id')
    this._catalogue.set(manifest.id, manifest)
  }

  // ─────────────────────────────────────────────────────────────
  // Tenant activation
  // ─────────────────────────────────────────────────────────────

  /**
   * Set the active tenant.
   * Called by useAuth after a successful login.
   * Loads that tenant's installed modules from Supabase (or localStorage fallback).
   */
  async loadForTenant(tenantId) {
    if (!tenantId) return

    this._activeTenantId = tenantId

    // Initialise the Set for this tenant if needed
    if (!this._tenantInstalls.has(tenantId)) {
      this._tenantInstalls.set(tenantId, new Set())
    }

    try {
      const { data, error } = await supabase
        .from('tenant_modules')
        .select('module_id')
        .eq('tenant_id', tenantId)

      if (error) throw error

      const installSet = this._tenantInstalls.get(tenantId)
      installSet.clear()
      data.forEach(row => installSet.add(row.module_id))

    } catch {
      // Supabase not configured yet — fall back to localStorage
      const key = `erp_modules_${tenantId}`
      const saved = JSON.parse(localStorage.getItem(key) || '[]')
      const installSet = this._tenantInstalls.get(tenantId)
      saved.forEach(id => installSet.add(id))
    }

    this._notifyListeners()
  }

  /** Clear the active tenant (called on sign-out) */
  clearActiveTenant() {
    this._activeTenantId = null
    this._notifyListeners()
  }

  // ─────────────────────────────────────────────────────────────
  // Read helpers (always relative to the active tenant)
  // ─────────────────────────────────────────────────────────────

  /** Full catalogue — all available modules regardless of tenant */
  getAll() {
    return Array.from(this._catalogue.values())
  }

  /** Single manifest by id */
  get(id) {
    return this._catalogue.get(id)
  }

  /** Is a module installed for the active tenant? */
  isInstalled(moduleId) {
    return this._getActiveInstalls().has(moduleId)
  }

  /** All installed manifests for the active tenant */
  getInstalled() {
    return Array.from(this._getActiveInstalls())
      .map(id => this._catalogue.get(id))
      .filter(Boolean)
  }

  // ─────────────────────────────────────────────────────────────
  // Install / Uninstall
  // ─────────────────────────────────────────────────────────────

  /**
   * Install a module (+ its uninstalled dependencies) for a tenant.
   * Returns { success: boolean, installed: string[], error?: string }
   */
  async install(moduleId, tenantId = this._activeTenantId) {
    if (!tenantId) return { success: false, error: 'No active tenant' }

    const manifest = this._catalogue.get(moduleId)
    if (!manifest) return { success: false, error: `Module "${moduleId}" not found` }

    const installs = this._ensureInstallSet(tenantId)
    if (installs.has(moduleId)) {
      return { success: false, error: `"${manifest.name}" is already installed` }
    }

    // Resolve all uninstalled dependencies first
    const depsToInstall = this._resolveDeps(moduleId, installs)
    const newlyInstalled = []

    for (const depId of depsToInstall) {
      const res = await this._installOne(depId, tenantId, installs)
      if (!res.success) return res
      newlyInstalled.push(depId)
    }

    // Install the requested module itself
    const res = await this._installOne(moduleId, tenantId, installs)
    if (!res.success) return res
    newlyInstalled.push(moduleId)

    this._notifyListeners()
    return { success: true, installed: newlyInstalled }
  }

  /**
   * Uninstall a module for a tenant.
   * Blocked if other installed modules depend on it.
   */
  async uninstall(moduleId, tenantId = this._activeTenantId) {
    if (!tenantId) return { success: false, error: 'No active tenant' }

    const installs = this._ensureInstallSet(tenantId)
    if (!installs.has(moduleId)) {
      return { success: false, error: `"${moduleId}" is not installed` }
    }

    // Reverse-dependency check
    const blockers = this._getInstalledDependents(moduleId, installs)
    if (blockers.length > 0) {
      const names = blockers
        .map(id => this._catalogue.get(id)?.name ?? id)
        .join(', ')
      return { success: false, error: `Cannot uninstall — "${names}" depends on this module` }
    }

    const manifest = this._catalogue.get(moduleId)

    try {
      if (manifest?.onUninstall) await manifest.onUninstall()

      installs.delete(moduleId)
      await this._persistForTenant(tenantId)

      EventBus.emit('module:uninstalled', { moduleId, tenantId })
      this._notifyListeners()
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Subscriptions
  // ─────────────────────────────────────────────────────────────

  /** Subscribe to registry changes. Returns an unsubscribe function. */
  subscribe(listener) {
    this._listeners.push(listener)
    return () => {
      this._listeners = this._listeners.filter(l => l !== listener)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────

  _getActiveInstalls() {
    if (!this._activeTenantId) return new Set()
    return this._ensureInstallSet(this._activeTenantId)
  }

  _ensureInstallSet(tenantId) {
    if (!this._tenantInstalls.has(tenantId)) {
      this._tenantInstalls.set(tenantId, new Set())
    }
    return this._tenantInstalls.get(tenantId)
  }

  async _installOne(moduleId, tenantId, installs) {
    const manifest = this._catalogue.get(moduleId)
    if (!manifest) return { success: false, error: `Module "${moduleId}" not found` }

    try {
      if (manifest.onInstall) await manifest.onInstall()

      installs.add(moduleId)
      await this._persistForTenant(tenantId)

      EventBus.emit('module:installed', { moduleId, tenantId })
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  /**
   * Topological sort of uninstalled dependencies.
   * Returns them in the correct install order (deepest dep first).
   */
  _resolveDeps(moduleId, installedSet) {
    const manifest = this._catalogue.get(moduleId)
    if (!manifest?.dependencies?.length) return []

    const order   = []
    const visited = new Set()

    const visit = (id) => {
      if (visited.has(id)) return
      visited.add(id)
      const m = this._catalogue.get(id)
      m?.dependencies?.forEach(dep => visit(dep))
      if (!installedSet.has(id)) order.push(id)
    }

    manifest.dependencies.forEach(dep => visit(dep))
    return order
  }

  /** Which installed modules declare moduleId as a dependency? */
  _getInstalledDependents(moduleId, installedSet) {
    return Array.from(installedSet).filter(id => {
      const m = this._catalogue.get(id)
      return m?.dependencies?.includes(moduleId)
    })
  }

  /** Persist installed set to Supabase + localStorage fallback */
  async _persistForTenant(tenantId) {
    const ids = Array.from(this._ensureInstallSet(tenantId))

    // Always keep localStorage in sync as an offline fallback
    localStorage.setItem(`erp_modules_${tenantId}`, JSON.stringify(ids))

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Full replace: delete existing then insert fresh
      await supabase.from('tenant_modules').delete().eq('tenant_id', tenantId)
      if (ids.length > 0) {
        await supabase.from('tenant_modules').insert(
          ids.map(module_id => ({
            tenant_id:    tenantId,
            module_id,
            installed_by: user.id,
          }))
        )
      }
    } catch { /* silent — localStorage already updated */ }
  }

  _notifyListeners() {
    const installed = this.getInstalled()
    this._listeners.forEach(fn => fn(installed))
  }
}

// ── Singleton ────────────────────────────────────────────────
const registry = new ModuleRegistry()
export default registry
