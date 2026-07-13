import { useState, useEffect } from 'react'
import { NavLink, useLocation, Link } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  LayoutDashboard, FileText, ClipboardList, Building2, Users, Package,
  ArrowLeftRight, DollarSign, BookOpen, List, UserCog, Settings, BarChart2,
  Calendar, Cpu, TrendingDown, Tag, Wrench, CheckSquare, Clock, Send,
  GitBranch, History, Receipt, Building, Activity, CalendarDays, Puzzle,
  Warehouse, ChevronDown, ChevronRight, Store, LogOut, ShieldCheck,
} from 'lucide-react'
import registry from '@core/registry/ModuleRegistry'
import { useTenant } from '@core/tenant/TenantContext'
import { usePermissions } from '@core/permissions/PermissionContext'
import { useAuth } from '@shared/hooks/useAuth'
import useStore from '@core/store/useStore'
import toast from '@shared/lib/toast'

// Maps icon name strings (from manifests) to Lucide components.
// Adding a new icon = add one entry here. No other file changes needed.
const ICON_MAP = {
  LayoutDashboard, FileText, ClipboardList, Building2, Users, Package,
  ArrowLeftRight, DollarSign, BookOpen, List, UserCog, Settings, BarChart2,
  Calendar, Cpu, TrendingDown, Tag, Wrench, CheckSquare, Clock, Send,
  GitBranch, History, Receipt, Building, Activity, CalendarDays, Puzzle,
  Warehouse, Store,
}

// ── NavItem ───────────────────────────────────────────────────
function NavItem({ item }) {
  const Icon = ICON_MAP[item.icon] ?? LayoutDashboard
  const { pathname } = useLocation()

  // Section sub-pages (depth ≥ 2, e.g. /purchase/orders) stay active on their
  // detail routes (/purchase/orders/:id). Roots like '/' and the module
  // dashboard '/purchase' (depth ≤ 1) match exactly so they don't light up on
  // every child route.
  const depth = item.path.split('/').filter(Boolean).length
  const isActive =
    pathname === item.path ||
    (depth >= 2 && pathname.startsWith(item.path + '/'))

  return (
    <Link
      to={item.path}
      className={clsx(
        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium',
        'transition-all duration-150 border',
        isActive
          ? 'bg-brand-100 dark:bg-brand-600/20 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-600/30'
          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-surface-100 dark:hover:bg-surface-800 border-transparent'
      )}
    >
      <Icon className={clsx(
        'w-4 h-4 flex-shrink-0 transition-colors',
        isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 dark:text-slate-500'
      )} />
      <span className="truncate">{item.label}</span>
      {isActive && <div className="ml-auto w-1 h-1 rounded-full bg-brand-500 dark:bg-brand-400" />}
    </Link>
  )
}

// ── ModuleSection ─────────────────────────────────────────────
/**
 * Renders one installed module in the sidebar.
 * Filters its menuItems dynamically against the current user's permissions.
 *
 * Rules:
 *   - If a menuItem has no requiredPermission → always visible
 *   - If it has requiredPermission → call can(action, moduleId)
 *   - If ALL items are hidden → hide the whole module section
 *
 * No moduleId is hardcoded here — everything comes from the manifest.
 */
function ModuleSection({ manifest, canFn }) {
  const location = useLocation()
  const Icon = manifest.icon

  // Filter visible menu items using the permission function from context
  const visibleItems = (manifest.menuItems ?? []).filter(item => {
    if (!item.requiredPermission) return true
    const { action, moduleId, featureId } = item.requiredPermission
    return canFn(action, moduleId, featureId)
  })

  // Hide the whole section if nothing is visible
  if (visibleItems.length === 0) return null

  const isAnyActive = visibleItems.some(item =>
    location.pathname === item.path ||
    location.pathname.startsWith(item.path + '/')
  )

  const [expanded, setExpanded] = useState(isAnyActive)

  return (
    <div className="mb-0.5">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg
                   text-slate-700 dark:text-slate-300
                   hover:text-slate-900 dark:hover:text-white
                   hover:bg-surface-100 dark:hover:bg-surface-800
                   text-sm font-semibold transition-all"
      >
        <div
          className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: `${manifest.color}25`,
            border:          `1px solid ${manifest.color}40`,
          }}
        >
          <Icon className="w-3 h-3" style={{ color: manifest.color }} />
        </div>
        <span className="truncate text-xs uppercase tracking-widest">{manifest.name}</span>
        <div className="ml-auto">
          {expanded
            ? <ChevronDown  className="w-3 h-3 text-slate-400 dark:text-slate-500" />
            : <ChevronRight className="w-3 h-3 text-slate-400 dark:text-slate-500" />}
        </div>
      </button>

      {expanded && (
        <div className="mt-0.5 ml-2 space-y-0.5 border-l border-surface-200 dark:border-surface-800 pl-2">
          {visibleItems.map(item => (
            <NavItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Sidebar ──────────────────────────────────────────────
export default function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useStore()
  const { tenant, tenantUser, isAdmin, isManager } = useTenant()
  const { user, signOut }               = useAuth()
  // can() from PermissionContext — reactive, re-renders when permissions change
  const { can, canAccessModule }        = usePermissions()

  const [installedModules, setInstalledModules] = useState(registry.getInstalled())

  useEffect(() => {
    // registry.subscribe returns an unsubscribe function — no leak
    const unsub = registry.subscribe(modules => setInstalledModules([...modules]))
    return unsub
  }, [])

  const isSuperAdmin = user?.isSuperAdmin ?? false

  // Filter installed modules to those the user can access at the module level.
  // canAccessModule(id) = can('view', id) — defined in PermissionContext.
  const accessibleModules = installedModules.filter(m => canAccessModule(m.id))

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={clsx(
        'fixed left-0 top-0 h-full z-50 flex flex-col',
        'w-60 bg-white dark:bg-[#0a1120]',
        'border-r border-surface-200 dark:border-surface-800',
        'transition-transform duration-300 lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>

        {/* Logo + tenant — h-14 matches TopBar height so the dividers align */}
        <div className="h-14 flex items-center gap-3 px-4 border-b border-surface-200 dark:border-surface-800 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700
                          flex items-center justify-center flex-shrink-0">
            <span className="text-white font-display font-bold text-sm">N</span>
          </div>
          <div className="min-w-0">
            <p className="font-display font-bold text-slate-900 dark:text-white text-sm leading-none truncate">
              NexusERP
            </p>
            <p className="text-xs text-brand-600/70 dark:text-brand-400/70 mt-0.5 truncate">
              {tenant?.name ?? 'Loading…'}
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-0.5 scrollbar-thin">

          {/* Core links — always visible regardless of permissions */}
          <NavItem item={{ id:'home', label:'Dashboard', path:'/', icon:'LayoutDashboard' }} />

          {/* App Store — managers and above only */}
          {(isSuperAdmin || isManager) && (
            <NavItem item={{ id:'store', label:'App Store', path:'/apps', icon:'Store' }} />
          )}

          {/* Tenant user management — visible to admins */}
          {isAdmin && (
            <NavItem item={{ id:'users', label:'Users & Permissions', path:'/team', icon:'UserCog' }} />
          )}

          {/* Super-admin panel */}
          {isSuperAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) => clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all border',
                isActive
                  ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-surface-100 dark:hover:bg-surface-800 border-transparent'
              )}
            >
              <ShieldCheck className="w-4 h-4 text-amber-500" />
              <span>Admin Panel</span>
            </NavLink>
          )}

          {/* Module sections — filtered by permission */}
          {accessibleModules.length > 0 && (
            <div className="pt-3 pb-1">
              <p className="px-3 text-xs font-medium text-slate-400 dark:text-slate-600 uppercase tracking-widest">
                Modules
              </p>
            </div>
          )}

          {accessibleModules.map(manifest => (
            <ModuleSection key={manifest.id} manifest={manifest} canFn={can} />
          ))}

          {accessibleModules.length === 0 && installedModules.length > 0 && (
            <div className="px-3 py-4 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-600">No accessible modules.</p>
              <p className="text-xs text-slate-400 dark:text-slate-700 mt-1">Contact your admin.</p>
            </div>
          )}

          {installedModules.length === 0 && (
            <div className="px-3 py-4 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-600">No modules installed.</p>
              <Link to="/apps" className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-500 dark:hover:text-brand-300 mt-1 inline-block">
                Browse App Store →
              </Link>
            </div>
          )}
        </nav>

        {/* User footer */}
        <div className="border-t border-surface-200 dark:border-surface-800 p-3">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg
                          hover:bg-surface-100 dark:hover:bg-surface-800 cursor-pointer group">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-purple-600
                            flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {(tenantUser?.full_name ?? user?.name ?? 'U')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                {tenantUser?.full_name ?? user?.name ?? 'User'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-600 capitalize truncate">
                {tenantUser?.role ?? (user?.isSuperAdmin ? 'super admin' : 'member')}
              </p>
            </div>
            <button
              onClick={() => { toast.success('Signed out successfully'); signOut() }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1
                         rounded hover:bg-surface-200 dark:hover:bg-surface-700"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
