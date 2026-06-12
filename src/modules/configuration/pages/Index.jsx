import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Users, Package, CalendarDays, Building2, Settings, ChevronRight } from 'lucide-react'
import { StatCard, Card, PageHeader, Badge } from '@shared/components/ui'
import { useTenant } from '@core/tenant/TenantContext'
import { supabase } from '@/shared/api/supabase'
import registry from '@core/registry/ModuleRegistry'

const STATUS_COLOR = { active: 'green', suspended: 'red', trial: 'yellow' }
const PLAN_COLOR   = { starter: 'default', growth: 'blue', enterprise: 'purple' }

const QUICK_LINKS = [
  {
    label: 'Company Settings',
    path:  '/configuration/company',
    icon:  Building2,
    desc:  'Company name, branding, contact info, plan and timezone.',
  },
  {
    label: 'Users & Roles',
    path:  '/configuration/users',
    icon:  Users,
    desc:  'Manage team members, roles, and per-user permission overrides.',
  },
  {
    label: 'Module Settings',
    path:  '/configuration/modules',
    icon:  Package,
    desc:  'Install or uninstall ERP modules for this tenant.',
  },
  {
    label: 'Fiscal Periods',
    path:  '/configuration/fiscal',
    icon:  CalendarDays,
    desc:  'Define accounting periods and lock historical data.',
  },
]

export default function ConfigurationIndex() {
  const { tenant, tenantId, tenantUser } = useTenant()
  const [stats, setStats]     = useState({ users: 0, modules: 0, periods: 0, openPeriods: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tenantId) return
    Promise.all([
      supabase
        .from('tenant_users')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('is_active', true),
      supabase
        .from('fiscal_periods')
        .select('id, status')
        .eq('tenant_id', tenantId),
    ]).then(([usersRes, periodsRes]) => {
      const all = periodsRes.data ?? []
      setStats({
        users:       usersRes.count ?? 0,
        modules:     registry.getInstalled().length,
        periods:     all.length,
        openPeriods: all.filter(p => p.status === 'open').length,
      })
      setLoading(false)
    })
  }, [tenantId])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuration"
        subtitle={tenant?.name ?? ''}
        breadcrumb="Configuration"
      />

      {/* Tenant info banner */}
      {tenant && (
        <Card className="px-5 py-4 flex items-center gap-4 flex-wrap">
          {tenant.logo_url ? (
            <img
              src={tenant.logo_url}
              alt={tenant.name}
              className="h-8 w-8 rounded object-contain"
            />
          ) : (
            <div className="h-8 w-8 rounded bg-brand-600/20 flex items-center justify-center text-brand-400 font-bold text-sm shrink-0">
              {tenant.name?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-slate-900 dark:text-slate-200">{tenant.name}</div>
            <div className="text-xs text-slate-500">{tenant.slug}</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge color={PLAN_COLOR[tenant.plan] ?? 'default'}>{tenant.plan}</Badge>
            <Badge color={STATUS_COLOR[tenant.status] ?? 'default'}>{tenant.status}</Badge>
            {tenantUser && <Badge color="purple">{tenantUser.role}</Badge>}
          </div>
        </Card>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Users"      value={loading ? '—' : stats.users}       icon={Users}        color="#6366f1" loading={loading} />
        <StatCard label="Installed Modules" value={loading ? '—' : stats.modules}     icon={Package}      color="#0ea5e9" loading={loading} />
        <StatCard label="Fiscal Periods"    value={loading ? '—' : stats.periods}     icon={CalendarDays} color="#10b981" loading={loading} />
        <StatCard label="Open Periods"      value={loading ? '—' : stats.openPeriods} icon={Settings}     color="#f59e0b" loading={loading} />
      </div>

      {/* Quick navigation */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
          Quick Navigation
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {QUICK_LINKS.map(link => (
            <Link key={link.path} to={link.path}>
              <Card className="p-4 hover:border-brand-500/40 transition-colors cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-lg bg-brand-600/10 border border-brand-600/20 shrink-0">
                    <link.icon className="w-5 h-5 text-brand-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-slate-900 dark:text-slate-200 group-hover:text-brand-600 dark:group-hover:text-white transition-colors">
                      {link.label}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{link.desc}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-600 group-hover:text-brand-400 shrink-0" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
