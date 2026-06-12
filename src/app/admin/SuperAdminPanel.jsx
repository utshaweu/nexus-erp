import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/shared/api/supabase'
import {
  Building2, Plus, Users, Package, Settings,
  CheckCircle2, XCircle, AlertTriangle, RefreshCw,
  Trash2, ToggleLeft, ToggleRight,
} from 'lucide-react'
import {
  Button, Badge, Card, CardHeader, CardTitle, CardContent,
  Table, Thead, Th, Tbody, Tr, Td, Modal, Input, PageHeader, StatCard,
} from '@shared/components/ui'
import { clsx } from 'clsx'
import toast from '@shared/lib/toast'

// All available module IDs (must match manifest ids)
const ALL_MODULE_IDS = [
  'purchase', 'sales', 'inventory', 'accounts',
  'hr', 'configuration', 'reports', 'assets', 'approval',
]

const MODULE_META = {
  purchase:      { label: 'Purchase',      color: '#f59e0b', emoji: '🛒' },
  sales:         { label: 'Sales',         color: '#10b981', emoji: '📈' },
  inventory:     { label: 'Inventory',     color: '#3b82f6', emoji: '📦' },
  accounts:      { label: 'Accounts',      color: '#8b5cf6', emoji: '💰' },
  hr:            { label: 'HR',            color: '#ec4899', emoji: '👥' },
  configuration: { label: 'Configuration', color: '#64748b', emoji: '⚙️'  },
  reports:       { label: 'Reports',       color: '#a855f7', emoji: '📊' },
  assets:        { label: 'Assets',        color: '#f97316', emoji: '🖥️'  },
  approval:      { label: 'Approvals',     color: '#06b6d4', emoji: '✅' },
}

const PLAN_COLOR = { starter: 'default', growth: 'blue', enterprise: 'purple' }
const STATUS_COLOR = { active: 'green', suspended: 'red', trial: 'yellow' }

// ── Sub-components ────────────────────────────────────────────

function ModuleToggle({ moduleId, active, onChange, disabled }) {
  const meta = MODULE_META[moduleId]
  return (
    <button
      onClick={() => onChange(moduleId, !active)}
      disabled={disabled}
      className={clsx(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
        active
          ? 'border-opacity-40 text-white'
          : 'border-surface-200 dark:border-surface-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:border-surface-300 dark:hover:border-surface-600',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      style={active ? {
        backgroundColor: `${meta.color}20`,
        borderColor: `${meta.color}50`,
        color: meta.color,
      } : {}}
    >
      <span>{meta.emoji}</span>
      <span>{meta.label}</span>
      {active
        ? <CheckCircle2 className="w-3 h-3 ml-auto" />
        : <div className="w-3 h-3 rounded-full border border-surface-300 dark:border-surface-600 ml-auto" />
      }
    </button>
  )
}

function CreateTenantModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', slug: '', plan: 'starter',
    adminEmail: '', adminName: '', adminPassword: '',
    modules: [],
  })
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState(1)

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const toggleModule = (id, active) => {
    setForm(prev => ({
      ...prev,
      modules: active
        ? [...prev.modules, id]
        : prev.modules.filter(m => m !== id),
    }))
  }

  const handleNameChange = (name) => {
    update('name', name)
    update('slug', name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
  }

  const handleCreate = async () => {
    if (!form.name || !form.adminEmail || !form.adminPassword) {
      toast.error('Please fill all required fields')
      return
    }
    setSaving(true)
    try {
      // Save the super admin session tokens so we can restore them after signUp
      // switches the client session to the newly-created user.
      const { data: { session: adminSession } } = await supabase.auth.getSession()

      // 1. Create the tenant row — super admin session is still active here
      const { data: tenant, error: tenantErr } = await supabase
        .from('tenants')
        .insert({ name: form.name, slug: form.slug, plan: form.plan })
        .select()
        .single()
      if (tenantErr) throw tenantErr

      // 2. Create the auth user — session switches to new user after this call
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email:    form.adminEmail,
        password: form.adminPassword,
        options:  { data: { full_name: form.adminName, role: 'admin' } },
      })
      if (authErr) throw authErr

      const userId = authData.user?.id
      if (!userId) throw new Error('User creation failed — check Supabase Auth settings')

      // 3. Create membership + install modules via SECURITY DEFINER RPC.
      //    This bypasses RLS so it works even though the client is now in the
      //    new user's session. The function allows a freshly-created user with
      //    no existing memberships to link themselves to their first tenant.
      const { error: setupErr } = await supabase.rpc('setup_tenant_user', {
        p_tenant_id:  tenant.id,
        p_user_id:    userId,
        p_role:       'owner',
        p_full_name:  form.adminName || form.adminEmail,
        p_module_ids: form.modules,
      })
      if (setupErr) throw setupErr

      // 4. Restore super admin session so the UI stays on the admin panel
      if (adminSession) {
        await supabase.auth.setSession({
          access_token:  adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        })
      }

      toast.success(`Tenant "${form.name}" created successfully`)
      onCreated(tenant)
      onClose()
      setForm({ name:'', slug:'', plan:'starter', adminEmail:'', adminName:'', adminPassword:'', modules:[] })
      setStep(1)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const steps = ['Details', 'Modules', 'Admin User']

  return (
    <Modal open={open} onClose={onClose} title="New Client / Tenant" size="lg">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <button
              onClick={() => setStep(i + 1)}
              className={clsx(
                'w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-all',
                step === i + 1
                  ? 'bg-brand-600 text-white'
                  : step > i + 1
                  ? 'bg-emerald-600 text-white'
                  : 'bg-surface-200 dark:bg-surface-800 text-slate-500'
              )}
            >
              {step > i + 1 ? '✓' : i + 1}
            </button>
            <span className={clsx(
              'text-xs font-medium',
              step === i + 1 ? 'text-slate-800 dark:text-slate-200' : 'text-slate-500'
            )}>{s}</span>
            {i < steps.length - 1 && (
              <div className={clsx('h-px w-8 mx-1', step > i + 1 ? 'bg-emerald-600' : 'bg-surface-200 dark:bg-surface-700')} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1 — Tenant details */}
      {step === 1 && (
        <div className="space-y-4">
          <Input
            label="Client / Company Name *"
            placeholder="e.g. Prince Bazar"
            value={form.name}
            onChange={e => handleNameChange(e.target.value)}
          />
          <Input
            label="URL Slug *"
            placeholder="prince-bazar"
            value={form.slug}
            onChange={e => update('slug', e.target.value)}
          />
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1.5">
              Plan
            </label>
            <div className="flex gap-3">
              {['starter', 'growth', 'enterprise'].map(plan => (
                <button
                  key={plan}
                  onClick={() => update('plan', plan)}
                  className={clsx(
                    'flex-1 py-2 px-3 rounded-lg border text-xs font-semibold capitalize transition-all',
                    form.plan === plan
                      ? 'bg-brand-100 dark:bg-brand-600/20 border-brand-500 text-brand-700 dark:text-brand-300'
                      : 'border-surface-200 dark:border-surface-700 text-slate-500 dark:text-slate-400 hover:border-surface-300 dark:hover:border-surface-600'
                  )}
                >
                  {plan}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={() => setStep(2)} disabled={!form.name || !form.slug}>
              Next: Select Modules →
            </Button>
          </div>
        </div>
      )}

      {/* Step 2 — Module selection */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Choose which modules <strong className="text-slate-800 dark:text-slate-200">{form.name}</strong> will have access to.
            These can be changed later.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {ALL_MODULE_IDS.map(id => (
              <ModuleToggle
                key={id}
                moduleId={id}
                active={form.modules.includes(id)}
                onChange={toggleModule}
              />
            ))}
          </div>
          <p className="text-xs text-slate-500">
            {form.modules.length} module{form.modules.length !== 1 ? 's' : ''} selected
          </p>
          <div className="flex justify-between pt-2">
            <Button variant="secondary" onClick={() => setStep(1)}>← Back</Button>
            <Button onClick={() => setStep(3)}>Next: Admin User →</Button>
          </div>
        </div>
      )}

      {/* Step 3 — Admin user creation */}
      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Create the first admin user for <strong className="text-slate-800 dark:text-slate-200">{form.name}</strong>.
          </p>
          <Input
            label="Admin Full Name"
            placeholder="e.g. John Smith"
            value={form.adminName}
            onChange={e => update('adminName', e.target.value)}
          />
          <Input
            label="Admin Email *"
            type="email"
            placeholder="admin@company.com"
            value={form.adminEmail}
            onChange={e => update('adminEmail', e.target.value)}
          />
          <Input
            label="Temporary Password *"
            type="password"
            placeholder="min. 8 characters"
            value={form.adminPassword}
            onChange={e => update('adminPassword', e.target.value)}
          />

          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5" />
            A confirmation email will be sent. The user must confirm before logging in.
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="secondary" onClick={() => setStep(2)}>← Back</Button>
            <Button onClick={handleCreate} loading={saving}>
              Create Tenant
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function TenantModulesModal({ tenant, open, onClose }) {
  const [modules, setModules] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !tenant) return
    supabase
      .from('tenant_modules')
      .select('module_id')
      .eq('tenant_id', tenant.id)
      .then(({ data }) => setModules(data?.map(r => r.module_id) ?? []))
  }, [open, tenant])

  const toggleModule = (id, active) => {
    setModules(prev => active ? [...prev, id] : prev.filter(m => m !== id))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('tenant_modules').delete().eq('tenant_id', tenant.id)
      if (modules.length > 0) {
        await supabase.from('tenant_modules').insert(
          modules.map(module_id => ({
            tenant_id: tenant.id,
            module_id,
            installed_by: user?.id,
          }))
        )
      }
      toast.success('Modules updated')
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Modules — ${tenant?.name}`}
      size="md"
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Toggle modules on/off for this client. Changes take effect on their next login.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {ALL_MODULE_IDS.map(id => (
            <ModuleToggle
              key={id}
              moduleId={id}
              active={modules.includes(id)}
              onChange={toggleModule}
            />
          ))}
        </div>
        <div className="flex justify-between items-center pt-2">
          <span className="text-xs text-slate-500">
            {modules.length} module{modules.length !== 1 ? 's' : ''} active
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>Save Changes</Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ── Main Admin Panel ──────────────────────────────────────────

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
