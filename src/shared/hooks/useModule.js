import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import registry from '@core/registry/ModuleRegistry'
import { useTenant } from '@core/tenant/TenantContext'

/**
 * useModule
 * ─────────
 * React hook wrapping the ModuleRegistry for the active tenant.
 * Provides install / uninstall with optimistic UI and toast feedback.
 *
 * Usage:
 *   const { allModules, installedIds, install, uninstall, isLoading } = useModule()
 */
export function useModule() {
  const { tenantId, isAdmin } = useTenant()

  // Keep a React-state snapshot of installed IDs so components re-render
  const [installedIds, setInstalledIds] = useState(
    () => registry.getInstalled().map(m => m.id)
  )

  // Per-module loading spinner state  { [moduleId]: boolean }
  const [loadingMap, setLoadingMap] = useState({})

  // Sync with registry whenever it changes (install / uninstall elsewhere)
  useEffect(() => {
    const unsub = registry.subscribe((installedManifests) => {
      setInstalledIds(installedManifests.map(m => m.id))
    })
    return unsub
  }, [])

  const install = useCallback(async (moduleId) => {
    if (!isAdmin) {
      toast.error('Only admins can install modules')
      return { success: false }
    }

    setLoadingMap(prev => ({ ...prev, [moduleId]: true }))

    try {
      const result = await registry.install(moduleId, tenantId)

      if (result.success) {
        const names = result.installed
          .map(id => registry.get(id)?.name ?? id)
          .join(', ')
        toast.success(`Installed: ${names}`)
      } else {
        toast.error(result.error ?? 'Installation failed')
      }

      return result
    } finally {
      setLoadingMap(prev => ({ ...prev, [moduleId]: false }))
    }
  }, [tenantId, isAdmin])

  const uninstall = useCallback(async (moduleId) => {
    if (!isAdmin) {
      toast.error('Only admins can uninstall modules')
      return { success: false }
    }

    setLoadingMap(prev => ({ ...prev, [moduleId]: true }))

    try {
      const result = await registry.uninstall(moduleId, tenantId)

      if (result.success) {
        toast.success(`Uninstalled: ${registry.get(moduleId)?.name ?? moduleId}`)
      } else {
        toast.error(result.error ?? 'Uninstall failed')
      }

      return result
    } finally {
      setLoadingMap(prev => ({ ...prev, [moduleId]: false }))
    }
  }, [tenantId, isAdmin])

  return {
    allModules:       registry.getAll(),
    installedModules: registry.getInstalled(),
    installedIds,
    isInstalled:  (id) => installedIds.includes(id),
    install,
    uninstall,
    isLoading:    (id) => !!loadingMap[id],
    canManage:    isAdmin,
  }
}
