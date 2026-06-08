import { Link } from 'react-router-dom'
import { Store, Package, Activity, ArrowRight, ShieldCheck } from 'lucide-react'
import { useModule } from '@shared/hooks/useModule'
import { useTenant } from '@core/tenant/TenantContext'
import { Card, StatCard } from '@shared/components/ui'

// ── Welcome screen shown when no modules are installed ────────
function EmptyState({ isAdmin }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
        style={{
          background: 'linear-gradient(135deg,rgba(99,102,241,.2),rgba(139,92,246,.2))',
          border:     '1.5px solid rgba(99,102,241,.3)',
        }}>
        <Store className="w-8 h-8 text-brand-500 dark:text-brand-400" />
      </div>
      <h2 className="font-display font-bold text-xl text-slate-900 dark:text-slate-100 mb-2">
        Welcome to NexusERP
      </h2>
      <p className="text-slate-500 max-w-sm text-sm mb-6 leading-relaxed">
        {isAdmin
          ? 'Install modules from the App Store to activate features for your workspace.'
          : 'Your workspace has no active modules yet. Contact your administrator.'}
      </p>
      {isAdmin && (
        <Link
          to="/apps"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl
                     bg-brand-600 hover:bg-brand-500 text-white text-sm
                     font-medium transition-colors"
        >
          <Store className="w-4 h-4" />
          Browse App Store
          <ArrowRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  )
}

// ── Installed-module shortcut card ────────────────────────────
function ModuleCard({ manifest }) {
  const Icon = manifest.icon
  return (
    <Link
      to={manifest.menuItems?.[0]?.path ?? '#'}
      className="group flex items-center gap-3 p-3.5 rounded-xl border transition-all
                 border-surface-200 hover:border-surface-300
                 dark:border-surface-800 dark:hover:border-surface-700
                 bg-white hover:bg-surface-50
                 dark:bg-surface-900/50 dark:hover:bg-surface-900"
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${manifest.color}18`, border: `1.5px solid ${manifest.color}35` }}
      >
        <Icon className="w-4.5 h-4.5" style={{ color: manifest.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{manifest.name}</p>
        <p className="text-xs text-slate-500">{manifest.menuItems?.length ?? 0} sections</p>
      </div>
      <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-600
                             group-hover:text-slate-700 dark:group-hover:text-slate-400 transition-colors" />
    </Link>
  )
}

// ── Main Home page ────────────────────────────────────────────
export default function Home() {
  const { installedModules, allModules } = useModule()
  const { tenant, tenantName, isAdmin }  = useTenant()
  const user = window.__erp_user__
  const isSuperAdmin = user?.isSuperAdmin ?? false

  const userName    = window.__erp_tenant_user__?.full_name ?? user?.name ?? 'Admin'
  const firstName   = userName.split(' ')[0]
  const hasModules  = installedModules.length > 0

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-slate-100">
          Good morning, {firstName} 👋
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })}
        </p>
      </div>

      {/* Super-admin shortcut */}
      {isSuperAdmin && (
        <Link
          to="/admin"
          className="flex items-center gap-3 p-4 mb-6 rounded-xl border
                     border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10
                     transition-all group"
        >
          <ShieldCheck className="w-5 h-5 text-amber-500 dark:text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Super Admin Panel</p>
            <p className="text-xs text-amber-600/70 dark:text-amber-400/60">Manage all tenants, create new clients</p>
          </div>
          <ArrowRight className="w-4 h-4 text-amber-500/50 dark:text-amber-400/40
                                 group-hover:text-amber-600 dark:group-hover:text-amber-400
                                 ml-auto transition-colors" />
        </Link>
      )}

      {!hasModules ? (
        <EmptyState isAdmin={isAdmin} />
      ) : (
        <div className="space-y-8">
          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Active Modules"    value={installedModules.length} icon={Package}  color="#6366f1" />
            <StatCard label="Available Modules" value={allModules.length - installedModules.length} icon={Store} color="#8b5cf6" />
            <StatCard label="System Status"     value="Online"                  icon={Activity} color="#10b981" />
            <StatCard
              label="Workspace"
              value={tenant?.plan ?? '—'}
              icon={ShieldCheck}
              color="#f59e0b"
            />
          </div>

          {/* Installed modules grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100">Active Modules</h2>
              {isAdmin && (
                <Link to="/apps" className="text-xs text-brand-600 dark:text-brand-400
                                            hover:text-brand-500 dark:hover:text-brand-300
                                            flex items-center gap-1">
                  Manage <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {installedModules.map(m => <ModuleCard key={m.id} manifest={m} />)}
            </div>
          </div>

          {/* Quick navigation */}
          <Card className="p-5">
            <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100 mb-4">Quick Navigation</h2>
            <div className="flex flex-wrap gap-2">
              {installedModules.flatMap(m =>
                (m.menuItems ?? []).slice(0, 2).map(item => (
                  <Link
                    key={item.id}
                    to={item.path}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                               text-slate-600 dark:text-slate-400
                               bg-surface-100 dark:bg-surface-800
                               hover:bg-surface-200 dark:hover:bg-surface-700
                               hover:text-slate-900 dark:hover:text-slate-200
                               border border-surface-200 dark:border-surface-700"
                  >
                    <span style={{ color: m.color }}>{m.name}</span>
                    <span className="text-slate-400 dark:text-slate-600">→</span>
                    {item.label}
                  </Link>
                ))
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
