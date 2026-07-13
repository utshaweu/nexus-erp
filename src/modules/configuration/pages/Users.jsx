import { useState, useEffect, useCallback, Fragment } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Shield, UserX, UserCheck, Users, ChevronDown, ChevronRight } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td,
  PageHeader, Card, Modal, Input, Select, Spinner, EmptyState,
} from '@shared/components/ui'
import { useTenant } from '@core/tenant/TenantContext'
import { supabase } from '@/shared/api/supabase'
import PermissionGate from '@shared/components/PermissionGate'
import registry from '@core/registry/ModuleRegistry'
import { featuresForModule, ROLE_DEFAULTS } from '@core/permissions/permissions'
import toast from '@shared/lib/toast'

const ROLE_OPTIONS = ['owner', 'admin', 'manager', 'user', 'viewer']
const ROLE_COLOR   = { owner: 'purple', admin: 'blue', manager: 'cyan', user: 'green', viewer: 'default' }
const PERM_ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'export']

// Explicit true/false always wins. A null cell shows what it will actually
// resolve to (mirrors can()'s fallback chain) — faded ✓/✗ instead of a flat
// "—", so e.g. denying a module's View visually cascades to its feature rows
// as a faded ✗ too, not an ambiguous neutral dash.
function cellVisual(value, inherited) {
  if (value === true)  return { symbol: '✓', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25' }
  if (value === false) return { symbol: '✗', cls: 'bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25' }
  return inherited
    ? { symbol: '✓', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/15' }
    : { symbol: '✗', cls: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25 hover:bg-red-500/15' }
}

// ── Zod schemas ────────────────────────────────────────────────────────────
const addUserSchema = z.object({
  email:     z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  full_name: z.string().trim().optional(),
  role:      z.enum(['owner', 'admin', 'manager', 'user', 'viewer'], {
    errorMap: () => ({ message: 'Select a valid role' }),
  }),
})

// ── Permission Override Modal ───────────────────────────────────────────────
// Not a standard form (toggle buttons, no text inputs) — kept as plain state.
function PermissionModal({ user, tenantId, onClose }) {
  const installedModules = registry.getInstalled()
  // Owners/admins always have full access — same rule as the Users & Permissions
  // panel (src/app/admin/TenantUsersPanel.jsx): overrides cannot be set for them.
  const targetIsAdmin = ['owner', 'admin'].includes(user.role)
  const [overrides, setOverrides] = useState({})
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [expandedModules, setExpandedModules] = useState({})
  const toggleExpand = (moduleId) =>
    setExpandedModules(prev => ({ ...prev, [moduleId]: !prev[moduleId] }))

  useEffect(() => {
    supabase
      .from('tenant_user_permissions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.user_id)
      .then(({ data }) => {
        const map = {}
        for (const mod of installedModules) {
          map[mod.id] = PERM_ACTIONS.reduce((acc, a) => ({ ...acc, [a]: null }), {})
          map[mod.id].features = {}
          for (const f of featuresForModule(mod)) {
            map[mod.id].features[f.id] = PERM_ACTIONS.reduce((acc, a) => ({ ...acc, [a]: null }), {})
          }
        }
        for (const row of (data ?? [])) {
          const actions = {
            view:    row.can_view,
            create:  row.can_create,
            edit:    row.can_edit,
            delete:  row.can_delete,
            approve: row.can_approve,
            export:  row.can_export,
          }
          if (row.feature_id) {
            map[row.module_id] ??= { features: {} }
            map[row.module_id].features[row.feature_id] = actions
          } else {
            map[row.module_id] = { ...map[row.module_id], ...actions }
          }
        }
        setOverrides(map)
        setLoading(false)
      })
  }, [user.user_id, tenantId]) // eslint-disable-line react-hooks/exhaustive-deps

  // featureId omitted → toggles the module-wide cell; passed → toggles that one feature's cell.
  const toggle = (moduleId, action, featureId = null) => {
    if (targetIsAdmin) return
    setOverrides(prev => {
      if (featureId) {
        const cur  = prev[moduleId]?.features?.[featureId]?.[action]
        const next = cur === null ? true : cur === true ? false : null
        return {
          ...prev,
          [moduleId]: {
            ...prev[moduleId],
            features: {
              ...prev[moduleId]?.features,
              [featureId]: { ...prev[moduleId]?.features?.[featureId], [action]: next },
            },
          },
        }
      }
      const cur  = prev[moduleId]?.[action]
      const next = cur === null ? true : cur === true ? false : null
      return { ...prev, [moduleId]: { ...prev[moduleId], [action]: next } }
    })
  }

  const upsertOrClearRow = async (moduleId, featureId, perms) => {
    const hasOverride = PERM_ACTIONS.some(a => perms[a] !== null)
    if (hasOverride) {
      await supabase
        .from('tenant_user_permissions')
        .upsert(
          {
            tenant_id:   tenantId,
            user_id:     user.user_id,
            module_id:   moduleId,
            feature_id:  featureId,
            can_view:    perms.view,
            can_create:  perms.create,
            can_edit:    perms.edit,
            can_delete:  perms.delete,
            can_approve: perms.approve,
            can_export:  perms.export,
            updated_at:  new Date().toISOString(),
          },
          { onConflict: 'tenant_id,user_id,module_id,feature_id' }
        )
    } else {
      await supabase
        .from('tenant_user_permissions')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('user_id', user.user_id)
        .eq('module_id', moduleId)
        .eq('feature_id', featureId)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      for (const [moduleId, perms] of Object.entries(overrides)) {
        await upsertOrClearRow(moduleId, '', perms)
        for (const [featureId, fperms] of Object.entries(perms.features ?? {})) {
          await upsertOrClearRow(moduleId, featureId, fperms)
        }
      }
      toast.success(`Permissions saved for ${user.full_name ?? 'user'}.`)
      onClose()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Permissions — ${user.full_name ?? 'User'}`}
      size="xl"
    >
      {loading ? (
        <div className="flex justify-center py-10"><Spinner className="w-5 h-5" /></div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Click a cell to cycle:{' '}
            <span className="text-emerald-500 font-semibold">✓ allow</span> →{' '}
            <span className="text-red-500 font-semibold">✗ deny</span> →{' '}
            <span className="text-slate-500 font-semibold">faded inherit</span>.
            A faded ✓/✗ shows what the cell will actually resolve to without an explicit override —
            e.g. denying a module's View shows every feature underneath it as a faded ✗ too, until you
            explicitly allow one. Indented rows override a single menu item and win over the module row
            above it — e.g. deny every Configuration row except Company to show only that menu item.
          </p>

          <div className="overflow-x-auto overflow-y-auto max-h-[55vh] rounded-lg border border-surface-200 dark:border-surface-800">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-900">
                  <th className="text-left px-3 py-2.5 font-medium text-slate-500 uppercase tracking-wide">
                    Module
                  </th>
                  {PERM_ACTIONS.map(a => (
                    <th key={a} className="text-center px-3 py-2.5 font-medium text-slate-500 uppercase tracking-wide">
                      {a}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200 dark:divide-surface-800/70">
                {installedModules.map(mod => {
                  const features = featuresForModule(mod)
                  const isOpen   = !!expandedModules[mod.id]
                  return (
                    <Fragment key={mod.id}>
                      <tr className="hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors">
                        <td className="px-3 py-2.5 font-medium text-slate-700 dark:text-slate-300">
                          {features.length > 0 ? (
                            <button
                              onClick={() => toggleExpand(mod.id)}
                              className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white"
                            >
                              {isOpen
                                ? <ChevronDown  className="w-3.5 h-3.5 text-slate-400" />
                                : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                              {mod.name}
                            </button>
                          ) : (
                            <span className="pl-5">{mod.name}</span>
                          )}
                        </td>
                        {PERM_ACTIONS.map(action => {
                          const val = overrides[mod.id]?.[action]
                          const { symbol, cls } = cellVisual(val, ROLE_DEFAULTS[user.role]?.[action] ?? false)
                          return (
                            <td key={action} className="text-center px-3 py-2.5">
                              <button
                                onClick={() => toggle(mod.id, action)}
                                disabled={targetIsAdmin}
                                className={`w-7 h-7 rounded-md text-xs font-bold transition-all border ${cls} ${
                                  targetIsAdmin ? 'opacity-40 cursor-not-allowed' : ''
                                }`}
                              >
                                {symbol}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                      {isOpen && features.map(f => (
                        <tr key={`${mod.id}:${f.id}`} className="bg-surface-50/60 dark:bg-surface-900/40">
                          <td className="px-3 py-1.5 pl-8 text-slate-500 dark:text-slate-400">
                            ↳ {f.label}
                          </td>
                          {PERM_ACTIONS.map(action => {
                            const val = overrides[mod.id]?.features?.[f.id]?.[action]
                            // Inherits the module override if set, else the role default —
                            // mirrors the resolution order in permissions.js can().
                            const inherited = overrides[mod.id]?.[action] ?? ROLE_DEFAULTS[user.role]?.[action] ?? false
                            const { symbol, cls } = cellVisual(val, inherited)
                            return (
                              <td key={action} className="text-center px-3 py-1.5">
                                <button
                                  onClick={() => toggle(mod.id, action, f.id)}
                                  disabled={targetIsAdmin}
                                  className={`w-6 h-6 rounded-md text-xs font-bold transition-all border ${cls} ${
                                    targetIsAdmin ? 'opacity-40 cursor-not-allowed' : ''
                                  }`}
                                >
                                  {symbol}
                                </button>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {targetIsAdmin && (
            <p className="text-xs text-amber-600 dark:text-amber-400/80 bg-amber-500/10 border border-amber-500/20
                          px-3 py-2 rounded-lg">
              Owners and admins have full access to all modules. Overrides cannot be set for these roles.
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={onClose}>
              {targetIsAdmin ? 'Close' : 'Cancel'}
            </Button>
            {!targetIsAdmin && (
              <PermissionGate
                action="edit"
                moduleId="configuration"
                fallback={<Button className="flex-1" disabled>Save (no permission)</Button>}
              >
                <Button className="flex-1" loading={saving} onClick={handleSave}>
                  Save Permissions
                </Button>
              </PermissionGate>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── Add User Modal ─────────────────────────────────────────────────────────
function AddUserModal({ tenantId, onClose, onAdded }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(addUserSchema),
    defaultValues: { email: '', full_name: '', role: 'user' },
  })

  const onSubmit = async (data) => {
    const { data: result, error: rpcError } = await supabase.rpc('add_tenant_user_by_email', {
      p_email:     data.email.toLowerCase(),
      p_role:      data.role,
      p_full_name: data.full_name || null,
    })
    if (rpcError || !result?.success) {
      toast.error(result?.error ?? rpcError?.message ?? 'Failed to add user.')
    } else {
      toast.success(`${data.email} added to the tenant.`)
      onAdded()
      onClose()
    }
  }

  return (
    <Modal open onClose={onClose} title="Add User to Tenant" size="sm">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            The user must already have a NexusERP account. Enter their registered email address.
          </p>

          <Input
            label="Email Address"
            type="email"
            placeholder="user@example.com"
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Full Name (optional)"
            placeholder="Jane Smith"
            {...register('full_name')}
          />
          <Select
            label="Role"
            {...register('role')}
          >
            {ROLE_OPTIONS.map(r => (
              <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
            ))}
          </Select>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              <Plus className="w-4 h-4" />Add User
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function UsersPage() {
  const { tenantId } = useTenant()
  const [users,      setUsers]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [permTarget, setPermTarget] = useState(null)
  const [showAdd,    setShowAdd]    = useState(false)

  const fetchUsers = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_tenant_users_with_email')
    if (!rpcErr && rpcData) {
      setUsers(rpcData)
    } else {
      const { data } = await supabase
        .from('tenant_users')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('joined_at', { ascending: true })
      setUsers(data ?? [])
    }
    setLoading(false)
  }, [tenantId])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleRoleChange = async (user, newRole) => {
    const { error } = await supabase
      .from('tenant_users')
      .update({ role: newRole })
      .eq('tenant_id', tenantId)
      .eq('user_id', user.user_id)
    if (error) toast.error(error.message)
    else fetchUsers()
  }

  const handleToggleActive = async (user) => {
    const { error } = await supabase
      .from('tenant_users')
      .update({ is_active: !user.is_active })
      .eq('id', user.id)
    if (error) toast.error(error.message)
    else {
      toast.success(`${user.full_name ?? 'User'} ${user.is_active ? 'deactivated' : 'reactivated'}.`)
      fetchUsers()
    }
  }

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    return (
      (u.full_name ?? '').toLowerCase().includes(q) ||
      (u.email     ?? '').toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Roles"
        subtitle={`${users.length} member${users.length !== 1 ? 's' : ''}`}
        breadcrumb="Configuration / Users & Roles"
        actions={
          <PermissionGate action="create" moduleId="configuration">
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="w-4 h-4" />Add User
            </Button>
          </PermissionGate>
        }
      />

      <Card>
        <div className="flex items-center gap-3 p-4 border-b border-surface-200 dark:border-surface-800">
          <div className="flex items-center gap-2 max-w-sm px-3 py-1.5 rounded-lg
                          bg-surface-100 dark:bg-surface-800
                          border border-surface-200 dark:border-surface-700">
            <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email, or role…"
              className="bg-transparent text-sm text-slate-700 dark:text-slate-300
                         placeholder:text-slate-400 dark:placeholder:text-slate-600 flex-1 outline-none"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-14"><Spinner className="w-6 h-6" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No users found"
            description={search ? 'No members match your search.' : 'No team members in this tenant yet.'}
            action={
              !search && (
                <PermissionGate action="create" moduleId="configuration">
                  <Button size="sm" onClick={() => setShowAdd(true)}>
                    <Plus className="w-4 h-4" />Add User
                  </Button>
                </PermissionGate>
              )
            }
          />
        ) : (
          <Table>
            <Thead>
              <Th>Member</Th>
              <Th>Role</Th>
              <Th>Status</Th>
              <Th>Joined</Th>
              <Th></Th>
            </Thead>
            <Tbody>
              {filtered.map(u => (
                <Tr key={u.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-600/20 border border-brand-600/20
                                      flex items-center justify-center text-brand-400 text-xs font-bold shrink-0">
                        {(u.full_name ?? u.email ?? '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-sm text-slate-800 dark:text-slate-200">
                          {u.full_name ?? '—'}
                        </div>
                        {u.email && (
                          <div className="text-xs text-slate-500">{u.email}</div>
                        )}
                      </div>
                    </div>
                  </Td>

                  <Td>
                    <PermissionGate
                      action="edit"
                      moduleId="configuration"
                      fallback={<Badge color={ROLE_COLOR[u.role]}>{u.role}</Badge>}
                    >
                      <select
                        value={u.role}
                        disabled={u.role === 'owner'}
                        title={u.role === 'owner' ? "The tenant owner's role can't be changed here" : undefined}
                        onChange={e => handleRoleChange(u, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-md
                                   border border-surface-200 dark:border-surface-700
                                   bg-white dark:bg-surface-800
                                   text-slate-700 dark:text-slate-200
                                   focus:outline-none focus:ring-1 focus:ring-brand-500
                                   ${u.role === 'owner' ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        {ROLE_OPTIONS.map(r => (
                          <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                        ))}
                      </select>
                    </PermissionGate>
                  </Td>

                  <Td>
                    <Badge color={u.is_active ? 'green' : 'red'}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </Td>

                  <Td>
                    <span className="text-slate-500 text-xs">
                      {new Date(u.joined_at).toLocaleDateString()}
                    </span>
                  </Td>

                  <Td>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="xs"
                        title="Manage permission overrides"
                        onClick={() => setPermTarget(u)}
                      >
                        <Shield className="w-3.5 h-3.5" />
                      </Button>
                      <PermissionGate action="edit" moduleId="configuration">
                        <Button
                          variant="ghost"
                          size="xs"
                          title={u.is_active ? 'Deactivate user' : 'Reactivate user'}
                          onClick={() => handleToggleActive(u)}
                        >
                          {u.is_active
                            ? <UserX     className="w-3.5 h-3.5 text-red-400" />
                            : <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                          }
                        </Button>
                      </PermissionGate>
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>

      {permTarget && (
        <PermissionModal
          user={permTarget}
          tenantId={tenantId}
          onClose={() => setPermTarget(null)}
        />
      )}

      {showAdd && (
        <AddUserModal
          tenantId={tenantId}
          onClose={() => setShowAdd(false)}
          onAdded={fetchUsers}
        />
      )}
    </div>
  )
}
