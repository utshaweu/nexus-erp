import { Suspense, lazy, useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import registry from '@core/registry/ModuleRegistry'
import { usePermissions } from '@core/permissions/PermissionContext'
import { ACTIONS } from '@core/permissions/permissions'
import { Spinner } from '@shared/components/ui'

// ── Core pages — always bundled ───────────────────────────────
const Home             = lazy(() => import('@/app/Home'))
const ModuleStore      = lazy(() => import('@/app/ModuleStore'))
const NotFound         = lazy(() => import('@/app/NotFound'))
const SuperAdminPanel  = lazy(() => import('@/app/admin/SuperAdminPanel'))
const TenantUsersPanel = lazy(() => import('@/app/admin/TenantUsersPanel'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner className="w-6 h-6" />
    </div>
  )
}

// ── Route guards ──────────────────────────────────────────────

/** Blocks non-super-admins from /admin */
function AdminRoute({ children }) {
  const user = window.__erp_user__
  if (!user?.isSuperAdmin) return <Navigate to="/" replace />
  return children
}

/**
 * PermissionRoute
 * ───────────────
 * Wraps a module page route. Checks can(VIEW, moduleId) before
 * rendering. If the user has no view permission, redirects to /
 * instead of showing a blank or error page.
 *
 * Every module route automatically gets this guard — no per-page
 * code needed. The moduleId is passed from the manifest route config.
 */
function PermissionRoute({ moduleId, children }) {
  const { can } = usePermissions()

  // Super admins always pass
  const user = window.__erp_user__
  if (user?.isSuperAdmin) return children

  // Must be able to VIEW the module to access any of its pages
  if (!can(ACTIONS.VIEW, moduleId)) {
    return <Navigate to="/" replace />
  }

  return children
}

// ── DynamicRouter ─────────────────────────────────────────────
/**
 * Builds the route tree from:
 *   1. Core routes — always present
 *   2. Module routes — injected dynamically from installed manifests
 *
 * Each module route is wrapped in PermissionRoute so a user with
 * no VIEW permission on that module can never reach those pages,
 * even by typing the URL directly.
 *
 * Memory-leak safety: the registry.subscribe cleanup is returned
 * from useEffect so the listener is removed on unmount.
 */
export default function DynamicRouter() {
  const [installedModules, setInstalledModules] = useState(
    registry.getInstalled()
  )

  useEffect(() => {
    // Returns the unsubscribe function — React calls it on unmount
    return registry.subscribe(modules => setInstalledModules([...modules]))
  }, [])

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>

        {/* ── Always-available core routes ────────────────── */}
        <Route path="/"     element={<Home />} />
        <Route path="/apps" element={<ModuleStore />} />

        {/* Team / user management (tenant admins only — guard is inside the component) */}
        <Route path="/team" element={<TenantUsersPanel />} />

        {/* Super-admin panel */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <SuperAdminPanel />
            </AdminRoute>
          }
        />

        {/* ── Dynamically injected module routes ──────────── */}
        {installedModules.flatMap(manifest =>
          (manifest.routes ?? []).map(routeCfg => {
            const Page = lazy(routeCfg.component)

            return (
              <Route
                key={`${manifest.id}::${routeCfg.path}`}
                path={routeCfg.path}
                element={
                  // Permission guard — checks VIEW on the module before rendering
                  <PermissionRoute moduleId={manifest.id}>
                    <Suspense fallback={<PageLoader />}>
                      <Page />
                    </Suspense>
                  </PermissionRoute>
                }
              />
            )
          })
        )}

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
