import { Bell, Menu, ChevronRight, Sun, Moon } from 'lucide-react'
import { clsx } from 'clsx'
import { useLocation, useNavigate } from 'react-router-dom'
import useStore from '@core/store/useStore'
import { useTenant } from '@core/tenant/TenantContext'

// Build breadcrumb segments from the current URL path
function useBreadcrumb() {
  const { pathname } = useLocation()
  const parts = pathname.split('/').filter(Boolean)
  if (!parts.length) return [{ label: 'Dashboard', path: '/' }]
  return parts.map((part, i) => ({
    label: part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' '),
    path:  '/' + parts.slice(0, i + 1).join('/'),
  }))
}

export default function TopBar() {
  const { setSidebarOpen, sidebarOpen, notifications, theme, setTheme } = useStore()
  const { tenantName, userRole } = useTenant()
  const navigate    = useNavigate()
  const breadcrumb  = useBreadcrumb()
  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <header className="h-14 flex items-center gap-4 px-6
                       border-b border-surface-200 dark:border-surface-800
                       bg-white/80 dark:bg-surface-950/80
                       backdrop-blur-sm sticky top-0 z-30 flex-shrink-0">

      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800
                   text-slate-500 dark:text-slate-400"
        aria-label="Toggle sidebar"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs text-slate-500 min-w-0">
        {breadcrumb.map((crumb, i) => (
          <span key={crumb.path} className="flex items-center gap-1 min-w-0">
            {i > 0 && <ChevronRight className="w-3 h-3 flex-shrink-0 text-slate-300 dark:text-slate-700" />}
            <button
              onClick={() => navigate(crumb.path)}
              className={clsx(
                'transition-colors truncate',
                i === breadcrumb.length - 1
                  ? 'text-slate-700 dark:text-slate-300 font-medium'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              {crumb.label}
            </button>
          </span>
        ))}
      </nav>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-2">

        {/* Tenant name pill */}
        {tenantName && (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-lg
                          bg-brand-50 dark:bg-brand-600/10
                          border border-brand-200 dark:border-brand-600/20">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-500 dark:bg-brand-400" />
            <span className="text-xs font-medium text-brand-700 dark:text-brand-300">{tenantName}</span>
            {userRole && (
              <span className="text-xs text-brand-600/70 dark:text-brand-400/60 capitalize">· {userRole}</span>
            )}
          </div>
        )}

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800
                     text-slate-500 dark:text-slate-400
                     hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark'
            ? <Sun  className="w-4 h-4" />
            : <Moon className="w-4 h-4" />}
        </button>

        {/* Notification bell */}
        <button
          className="relative p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800
                     text-slate-500 dark:text-slate-400
                     hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-brand-500" />
          )}
        </button>

        {/* Date */}
        <div className="hidden sm:flex items-center px-3 py-1.5 rounded-lg
                        bg-surface-100 dark:bg-surface-800
                        border border-surface-200 dark:border-surface-700">
          <span className="text-xs text-slate-500 font-mono">
            {new Date().toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            })}
          </span>
        </div>
      </div>
    </header>
  )
}
