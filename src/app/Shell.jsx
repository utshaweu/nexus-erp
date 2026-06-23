import { useEffect, useState } from 'react'
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
import { AuthProvider } from '@shared/hooks/useAuth'

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
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  )

  useEffect(() => {
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = (e) => {
        document.documentElement.classList.toggle('dark', e.matches)
        setSystemDark(e.matches)
      }
      document.documentElement.classList.toggle('dark', mq.matches)
      setSystemDark(mq.matches)
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    } else {
      document.documentElement.classList.toggle('dark', theme === 'dark')
    }
  }, [theme])

  const isDark = theme === 'dark' || (theme === 'system' && systemDark)
  const toastStyle = isDark
    ? { background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' }
    : { background: '#ffffff', color: '#1e293b', border: '1px solid #e2e8f0' }
  const toastIconBg = isDark ? '#1e293b' : '#ffffff'

  return (
    <BrowserRouter>
      <TenantProvider>
        <PermissionProvider>
          <AuthProvider>
            <AuthGuard>
              <div className="flex h-screen bg-slate-50 dark:bg-surface-950 font-sans text-slate-800 dark:text-slate-200 overflow-hidden print:h-auto print:overflow-visible print:bg-white">

                <Sidebar />

                <div className={clsx(
                  'flex-1 flex flex-col min-w-0 transition-all duration-300 lg:ml-60 print:ml-0'
                )}>
                  <TopBar />
                  <main className="flex-1 overflow-y-auto">
                    <div className="px-6 py-6 max-w-screen-2xl mx-auto">
                      <DynamicRouter />
                    </div>
                  </main>
                </div>

              </div>
            </AuthGuard>
          </AuthProvider>

          {/* Toaster lives outside AuthGuard so toasts work on the login page too */}
          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 3500,
              style: {
                ...toastStyle,
                borderRadius: '12px',
                fontSize:     '13px',
                padding:      '10px 14px',
                maxWidth:     '320px',
              },
              success: { iconTheme: { primary: '#10b981', secondary: toastIconBg } },
              error:   { iconTheme: { primary: '#ef4444', secondary: toastIconBg } },
              loading: { iconTheme: { primary: '#6366f1', secondary: toastIconBg } },
            }}
          />
        </PermissionProvider>
      </TenantProvider>
    </BrowserRouter>
  )
}
