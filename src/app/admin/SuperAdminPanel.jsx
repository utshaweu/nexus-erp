import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/shared/api/supabase'
import {
  Building2, Plus, Package,
  CheckCircle2, XCircle, RefreshCw,
  ToggleLeft, ToggleRight,
} from 'lucide-react'
import {
  Button, Badge, Card, CardHeader, CardTitle, CardContent,
  Table, Thead, Th, Tbody, Tr, Td, PageHeader, StatCard,
} from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { MODULE_META } from './components/moduleMeta'
import CreateTenantModal from './components/CreateTenantModal'
import TenantModulesModal from './components/TenantModulesModal'

const PLAN_COLOR = { starter: 'default', growth: 'blue', enterprise: 'purple' }
const STATUS_COLOR = { active: 'green', suspended: 'red', trial: 'yellow' }

export default function SuperAdminPanel() {
  const [tenants, setTenants]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [showCreate, setShowCreate]   = useState(false)
  const [editModules, setEditModules] = useState(null)

  const loadTenants = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select(`
          *,
          tenant_users(count),
          tenant_modules(module_id)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setTenants(data ?? [])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTenants() }, [loadTenants])

  const toggleStatus = async (tenant) => {
    const next = tenant.status === 'active' ? 'suspended' : 'active'
    const { error } = await supabase
      .from('tenants')
      .update({ status: next })
      .eq('id', tenant.id)
    if (error) { toast.error(error.message); return }
    toast.success(`${tenant.name} ${next}`)
    loadTenants()
  }

  const stats = {
    total:     tenants.length,
    active:    tenants.filter(t => t.status === 'active').length,
    suspended: tenants.filter(t => t.status === 'suspended').length,
    modules:   tenants.reduce((s, t) => s + (t.tenant_modules?.length ?? 0), 0),
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Super Admin — Tenants"
        subtitle="Create and manage all client accounts from one place"
        breadcrumb="Admin Panel"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={loadTenants}>
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" />
              New Client
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Clients"   value={stats.total}     icon={Building2} color="#6366f1" />
        <StatCard label="Active"          value={stats.active}    icon={CheckCircle2} color="#10b981" />
        <StatCard label="Suspended"       value={stats.suspended} icon={XCircle}   color="#ef4444" />
        <StatCard label="Modules In Use"  value={stats.modules}   icon={Package}   color="#f59e0b" />
      </div>

      {/* Tenant table */}
      <Card>
        <CardHeader>
          <CardTitle>All Clients ({tenants.length})</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-sm">Loading...</div>
          ) : (
            <Table>
              <Thead>
                <Th>Client Name</Th>
                <Th>Slug</Th>
                <Th>Plan</Th>
                <Th>Modules</Th>
                <Th>Users</Th>
                <Th>Status</Th>
                <Th>Created</Th>
                <Th>Actions</Th>
              </Thead>
              <Tbody>
                {tenants.map(t => (
                  <Tr key={t.id}>
                    <Td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-brand-600/20 border border-brand-600/30 flex items-center justify-center text-xs font-bold text-brand-600 dark:text-brand-400">
                          {t.name[0]}
                        </div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{t.name}</span>
                      </div>
                    </Td>
                    <Td>
                      <span className="font-mono text-xs text-slate-500">{t.slug}</span>
                    </Td>
                    <Td>
                      <Badge color={PLAN_COLOR[t.plan]}>{t.plan}</Badge>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {(t.tenant_modules ?? []).map(m => {
                          const meta = MODULE_META[m.module_id]
                          return meta ? (
                            <span
                              key={m.module_id}
                              title={meta.label}
                              className="text-sm"
                            >
                              {meta.emoji}
                            </span>
                          ) : null
                        })}
                        {(!t.tenant_modules || t.tenant_modules.length === 0) && (
                          <span className="text-xs text-slate-400 italic">None</span>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <span className="text-slate-500">
                        {Array.isArray(t.tenant_users)
                          ? t.tenant_users[0]?.count ?? 0
                          : 0}
                      </span>
                    </Td>
                    <Td>
                      <Badge color={STATUS_COLOR[t.status]}>{t.status}</Badge>
                    </Td>
                    <Td>
                      <span className="text-slate-500 text-xs">
                        {new Date(t.created_at).toLocaleDateString()}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setEditModules(t)}
                          title="Manage modules"
                        >
                          <Package className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => toggleStatus(t)}
                          title={t.status === 'active' ? 'Suspend' : 'Activate'}
                        >
                          {t.status === 'active'
                            ? <ToggleRight className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                            : <ToggleLeft  className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                          }
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}

          {!loading && tenants.length === 0 && (
            <div className="py-16 text-center">
              <Building2 className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No clients yet</p>
              <p className="text-slate-400 dark:text-slate-600 text-sm mt-1">
                Click "New Client" to create your first tenant.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateTenantModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={loadTenants}
      />

      <TenantModulesModal
        tenant={editModules}
        open={!!editModules}
        onClose={() => { setEditModules(null); loadTenants() }}
      />
    </div>
  )
}
