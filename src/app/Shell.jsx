import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { clsx } from 'clsx'
import useStore from '@core/store/useStore'
import { TenantProvider } from '@core/tenant/TenantContext'
import { PermissionProvider } from '@core/permissions/PermissionContext'
import DynamicRouter from '@core/router/DynamicRouter'
import registry from '@core/registry/ModuleRegistry'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import AuthGuard from './AuthGuard'

// ── Register all module manifests (once, before any login) ────
import purchaseModule      from '@modules/purchase'
import salesModule         from '@modules/sales'
import inventoryModule     from '@modules/inventory'
import accountsModule      from '@modules/accounts'
import hrModule            from '@modules/hr'
import configurationModule from '@modules/configuration'
import reportsModule       from '@modules/reports'
import assetsModule        from '@modules/assets'
import approvalModule      from '@modules/approval'

;[
  purchaseModule, salesModule, inventoryModule, accountsModule,
  hrModule, configurationModule, reportsModule, assetsModule, approvalModule,
].forEach(m => registry.register(m))

/**
 * Shell — Root component
 *
 * Provider nesting order matters:
 *   BrowserRouter               → routing available everywhere
 *     TenantProvider            → tenant data available
 *       PermissionProvider      → permissions available (needs tenant)
 *         AuthGuard             → drives bootstrap after login
 *           layout              → sidebar + main content
 */
export default function Shell() {
  const { sidebarOpen, theme } = useStore()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const isDark = theme === 'dark'
  const toastStyle = isDark
    ? { background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' }
    : { background: '#ffffff', color: '#1e293b', border: '1px solid #e2e8f0' }
  const toastIconBg = isDark ? '#1e293b' : '#ffffff'

  return (
    <BrowserRouter>
      <TenantProvider>
        <PermissionProvider>
          <AuthGuard>
            <div className="flex h-screen bg-slate-50 dark:bg-surface-950 font-sans text-slate-800 dark:text-slate-200 overflow-hidden">

              <Sidebar />

              <div className={clsx(
                'flex-1 flex flex-col min-w-0 transition-all duration-300 lg:ml-60'
              )}>
                <TopBar />
                <main className="flex-1 overflow-y-auto">
                  <div className="px-6 py-6 max-w-screen-2xl mx-auto">
                    <DynamicRouter />
                  </div>
                </main>
              </div>

            </div>

            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  ...toastStyle,
                  borderRadius: '12px',
                  fontSize:     '13px',
                },
                success: { iconTheme: { primary: '#10b981', secondary: toastIconBg } },
                error:   { iconTheme: { primary: '#ef4444', secondary: toastIconBg } },
              }}
            />
          </AuthGuard>
        </PermissionProvider>
      </TenantProvider>
    </BrowserRouter>
  )
}
