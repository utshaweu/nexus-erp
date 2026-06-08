import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/shared/api/supabase'
import {
  Users, Plus, Shield, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, RefreshCw, UserPlus, Save,
} from 'lucide-react'
import {
  Button, Badge, Card, CardHeader, CardTitle, CardContent,
  Table, Thead, Th, Tbody, Tr, Td, Modal, Input, PageHeader,
} from '@shared/components/ui'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'
import { useTenant } from '@core/tenant/TenantContext'
import { usePermissions } from '@core/permissions/PermissionContext'
import { ACTIONS, ROLE_DEFAULTS, buildPermissionMap } from '@core/permissions/permissions'
import registry from '@core/registry/ModuleRegistry'

// ── Constants ─────────────────────────────────────────────────

const ROLE_COLOR = {
  owner:   'purple',
  admin:   'blue',
  manager: 'cyan',
  user:    'default',
  viewer:  'default',
}

const ACTION_LABELS = {
  [ACTIONS.VIEW]:    { label: 'View',    short: 'V' },
  [ACTIONS.CREATE]:  { label: 'Create',  short: 'C' },
  [ACTIONS.EDIT]:    { label: 'Edit',    short: 'E' },
  [ACTIONS.DELETE]:  { label: 'Delete',  short: 'D' },
  [ACTIONS.APPROVE]: { label: 'Approve', short: 'A' },
  [ACTIONS.EXPORT]:  { label: 'Export',  short: 'X' },
}

const ALL_ACTIONS = Object.values(ACTIONS)

// ── PermissionCell ─────────────────────────────────────────────
function PermissionCell({ value, roleDefault, onChange, disabled }) {
  const effectiveValue = value ?? roleDefault

  const cycleState = () => {
    if (disabled) return
    if (value === null || value === undefined) onChange(true)
    else if (value === true)  onChange(false)
    else                      onChange(null)
  }

  return (
    <button
      onClick={cycleState}
      disabled={disabled}
      title={
        value === true  ? 'Explicitly ALLOWED (click to deny)'  :
        value === false ? 'Explicitly DENIED (click to reset)'  :
                          'Inheriting from role (click to allow)'
      }
      className={clsx(
        'w-8 h-8 rounded-lg flex items-center justify-center transition-all text-xs font-bold',
        disabled && 'opacity-40 cursor-not-allowed',
        !disabled && 'hover:scale-110 cursor-pointer',
        value === true  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400' :
        value === false ? 'bg-red-500/20 border border-red-500/40 text-red-600 dark:text-red-400'               :
        effectiveValue  ? 'bg-surface-200 dark:bg-surface-700 border border-surface-300 dark:border-surface-600 text-slate-500 dark:text-slate-400' :
                          'bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-slate-400 dark:text-slate-600'
      )}
    >
      {value === true  ? '✓' :
       value === false ? '✗' :
       effectiveValue  ? '~' : '–'}
    </button>
  )
}

// ── UserPermissionEditor ──────────────────────────────────────
function UserPermissionEditor({ user, tenantId, onSaved }) {
  const [matrix, setMatrix] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  const installedModules = registry.getInstalled()

  useEffect(() => {
    if (!user || !tenantId) return
    let active = true

    const load = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('tenant_user_permissions')
          .select('module_id, can_view, can_create, can_edit, can_delete, can_approve, can_export')
          .eq('tenant_id', tenantId)
          .eq('user_id',   user.user_id)

        if (error) throw error
        if (!active) return

        const loaded = {}
        for (const row of data ?? []) {
          loaded[row.module_id] = {
            [ACTIONS.VIEW]:    row.can_view,
            [ACTIONS.CREATE]:  row.can_create,
            [ACTIONS.EDIT]:    row.can_edit,
            [ACTIONS.DELETE]:  row.can_delete,
            [ACTIONS.APPROVE]: row.can_approve,
            [ACTIONS.EXPORT]:  row.can_export,
          }
        }

        const full = {}
        for (const mod of installedModules) {
          full[mod.id] = loaded[mod.id] ?? {
            [ACTIONS.VIEW]: null, [ACTIONS.CREATE]: null, [ACTIONS.EDIT]: null,
            [ACTIONS.DELETE]: null, [ACTIONS.APPROVE]: null, [ACTIONS.EXPORT]: null,
          }
        }
        setMatrix(full)
      } catch (err) {
        toast.error('Failed to load permissions: ' + err.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [user?.user_id, tenantId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCellChange = (moduleId, action, value) => {
    setMatrix(prev => ({
      ...prev,
      [moduleId]: { ...prev[moduleId], [action]: value },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const rows = Object.entries(matrix)
        .filter(([, actions]) => Object.values(actions).some(v => v !== null))
        .map(([module_id, actions]) => ({
          tenant_id:   tenantId,
          user_id:     user.user_id,
          module_id,
          can_view:    actions[ACTIONS.VIEW],
          can_create:  actions[ACTIONS.CREATE],
          can_edit:    actions[ACTIONS.EDIT],
          can_delete:  actions[ACTIONS.DELETE],
          can_approve: actions[ACTIONS.APPROVE],
          can_export:  actions[ACTIONS.EXPORT],
          updated_at:  new Date().toISOString(),
        }))

      const { error: delErr } = await supabase
        .from('tenant_user_permissions')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('user_id',   user.user_id)

      if (delErr) throw delErr

      if (rows.length > 0) {
        const { error: insErr } = await supabase
          .from('tenant_user_permissions')
          .insert(rows)
        if (insErr) throw insErr
      }

      toast.success(`Permissions saved for ${user.full_name}`)
      onSaved?.()
    } catch (err) {
      toast.error('Save failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="py-8 text-center text-slate-500 text-sm">
        Loading permissions…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-md bg-emerald-500/20 border border-emerald-500/40
                           text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">✓</span>
          Explicit allow
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-md bg-red-500/20 border border-red-500/40
                           text-red-600 dark:text-red-400 flex items-center justify-center font-bold text-xs">✗</span>
          Explicit deny
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-md bg-surface-200 dark:bg-surface-700 border border-surface-300 dark:border-surface-600
                           text-slate-500 dark:text-slate-400 flex items-center justify-center font-bold text-xs">~</span>
          Inherited (role default, allowed)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-md bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700
                           text-slate-400 dark:text-slate-600 flex items-center justify-center font-bold text-xs">–</span>
          Inherited (role default, denied)
        </span>
      </div>

      {/* Matrix */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left py-2 px-3 text-slate-500 font-medium w-36">Module</th>
              {ALL_ACTIONS.map(action => (
                <th key={action} className="py-2 px-1 text-center text-slate-500 font-medium w-10">
                  {ACTION_LABELS[action].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {installedModules.map(mod => {
              const roleDefaults = ROLE_DEFAULTS[user.role] ?? {}
              const modMatrix    = matrix[mod.id] ?? {}
              const Icon         = mod.icon

              return (
                <tr key={mod.id} className="border-t border-surface-200 dark:border-surface-800">
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor:`${mod.color}20`, border:`1px solid ${mod.color}30` }}
                      >
                        <Icon className="w-3 h-3" style={{ color: mod.color }} />
                      </div>
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{mod.name}</span>
                    </div>
                  </td>
                  {ALL_ACTIONS.map(action => (
                    <td key={action} className="py-2 px-1 text-center">
                      <div className="flex justify-center">
                        <PermissionCell
                          value={modMatrix[action] ?? null}
                          roleDefault={roleDefaults[action] ?? false}
                          onChange={(val) => handleCellChange(mod.id, action, val)}
                          disabled={['owner','admin'].includes(user.role)}
                        />
                      </div>
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {['owner','admin'].includes(user.role) && (
        <p className="text-xs text-amber-600 dark:text-amber-400/80 bg-amber-500/10 border border-amber-500/20
                      px-3 py-2 rounded-lg">
          Owners and admins have full access to all modules. Overrides cannot be set for these roles.
        </p>
      )}

      {!['owner','admin'].includes(user.role) && (
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} loading={saving}>
            <Save className="w-4 h-4" />
            Save Permissions
          </Button>
        </div>
      )}
    </div>
  )
}

// ── AddUserModal ──────────────────────────────────────────────
function AddUserModal({ open, onClose, tenantId, onAdded }) {
  const [form, setForm] = useState({
    email: '', fullName: '', password: '', role: 'user',
  })
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    if (!form.email || !form.password) {
      toast.error('Email and password are required')
      return
    }
    setSaving(true)
    try {
      const { data, error: authErr } = await supabase.auth.signUp({
        email:    form.email,
        password: form.password,
        options:  { data: { full_name: form.fullName } },
      })
      if (authErr) throw authErr

      const userId = data.user?.id
      if (!userId) throw new Error('User creation failed')

      const { error: memberErr } = await supabase.from('tenant_users').insert({
        tenant_id: tenantId,
        user_id:   userId,
        role:      form.role,
        full_name: form.fullName || form.email,
      })
      if (memberErr) throw memberErr

      toast.success(`User ${form.email} added`)
      onAdded()
      onClose()
      setForm({ email:'', fullName:'', password:'', role:'user' })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add New User" size="sm">
      <div className="space-y-4">
        <Input
          label="Full Name"
          placeholder="e.g. Alice Wang"
          value={form.fullName}
          onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
        />
        <Input
          label="Email *"
          type="email"
          placeholder="user@company.com"
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
        />
        <Input
          label="Temporary Password *"
          type="password"
          placeholder="min. 8 characters"
          value={form.password}
          onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
        />
        <div>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1.5">
            Role
          </label>
          <div className="grid grid-cols-3 gap-2">
            {['manager','user','viewer'].map(role => (
              <button
                key={role}
                onClick={() => setForm(f => ({ ...f, role }))}
                className={clsx(
                  'py-2 px-3 rounded-lg border text-xs font-semibold capitalize transition-all',
                  form.role === role
                    ? 'bg-brand-100 dark:bg-brand-600/20 border-brand-500 text-brand-700 dark:text-brand-300'
                    : 'border-surface-200 dark:border-surface-700 text-slate-500 dark:text-slate-400 hover:border-surface-300 dark:hover:border-surface-600'
                )}
              >
                {role}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleAdd} loading={saving}>Add User</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main panel ────────────────────────────────────────────────
export default function TenantUsersPanel() {
  const { tenantId, tenantName, isAdmin } = useTenant()
  const { refreshPermissions }            = usePermissions()

  const [users, setUsers]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [expandedUser, setExpanded]   = useState(null)
  const [showAdd, setShowAdd]         = useState(false)

  const loadUsers = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('tenant_users')
        .select('id, user_id, role, full_name, avatar_url, is_active, joined_at')
        .eq('tenant_id', tenantId)
        .order('joined_at', { ascending: true })

      if (error) throw error
      setUsers(data ?? [])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { loadUsers() }, [loadUsers])

  const handleRoleChange = async (userId, newRole) => {
    const { error } = await supabase
      .from('tenant_users')
      .update({ role: newRole })
      .eq('tenant_id', tenantId)
      .eq('user_id',   userId)

    if (error) { toast.error(error.message); return }
    toast.success('Role updated')
    loadUsers()
  }

  const handleToggleActive = async (user) => {
    const { error } = await supabase
      .from('tenant_users')
      .update({ is_active: !user.is_active })
      .eq('tenant_id', tenantId)
      .eq('user_id',   user.user_id)

    if (error) { toast.error(error.message); return }
    toast.success(user.is_active ? 'User deactivated' : 'User activated')
    loadUsers()
  }

  if (!isAdmin) {
    return (
      <div className="py-20 text-center">
        <Shield className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
        <p className="text-slate-500 font-medium">Admin access required</p>
        <p className="text-slate-400 dark:text-slate-600 text-sm mt-1">
          Only owners and admins can manage users and permissions.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Permissions"
        subtitle={`Manage team members and per-module access for ${tenantName}`}
        breadcrumb="Team"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={loadUsers}>
              <RefreshCw className="w-3.5 h-3.5" />Refresh
            </Button>
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <UserPlus className="w-4 h-4" />Add User
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Team Members ({users.length})</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="py-10 text-center text-slate-500 text-sm">Loading…</div>
          ) : (
            <div className="divide-y divide-surface-200 dark:divide-surface-800">
              {users.map(u => {
                const isExpanded = expandedUser === u.user_id

                return (
                  <div key={u.id}>
                    {/* User row */}
                    <div className={clsx(
                      'flex items-center gap-4 py-4 px-2 transition-colors',
                      isExpanded && 'bg-surface-50 dark:bg-surface-800/30 rounded-t-lg'
                    )}>
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-purple-600
                                      flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                        {(u.full_name ?? 'U')[0].toUpperCase()}
                      </div>

                      {/* Name + meta */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {u.full_name ?? '—'}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {u.is_active ? 'Active' : 'Inactive'} ·
                          Joined {new Date(u.joined_at).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Role selector */}
                      <select
                        value={u.role}
                        onChange={e => handleRoleChange(u.user_id, e.target.value)}
                        className="px-2 py-1 rounded-lg text-xs
                                   bg-white dark:bg-surface-800
                                   border border-surface-200 dark:border-surface-700
                                   text-slate-700 dark:text-slate-300
                                   focus:outline-none focus:ring-1 focus:ring-brand-500"
                      >
                        {['owner','admin','manager','user','viewer'].map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>

                      <Badge color={ROLE_COLOR[u.role]}>{u.role}</Badge>

                      {/* Active toggle */}
                      <button
                        onClick={() => handleToggleActive(u)}
                        className={clsx(
                          'px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
                          u.is_active
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 hover:border-red-500/20'
                            : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-400 hover:border-emerald-500/20'
                        )}
                      >
                        {u.is_active ? 'Active' : 'Inactive'}
                      </button>

                      {/* Expand permissions */}
                      <button
                        onClick={() => setExpanded(prev => prev === u.user_id ? null : u.user_id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                                   bg-surface-100 dark:bg-surface-800
                                   hover:bg-surface-200 dark:hover:bg-surface-700
                                   text-slate-600 dark:text-slate-400
                                   hover:text-slate-900 dark:hover:text-slate-200
                                   border border-surface-200 dark:border-surface-700"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        Permissions
                        {isExpanded
                          ? <ChevronUp   className="w-3 h-3" />
                          : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>

                    {/* Inline permission editor */}
                    {isExpanded && (
                      <div className="px-4 pb-5 pt-3
                                      bg-surface-50 dark:bg-surface-800/30
                                      rounded-b-lg border-t border-surface-200 dark:border-surface-800">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
                          Permission Matrix — {u.full_name}
                        </p>
                        <UserPermissionEditor
                          user={u}
                          tenantId={tenantId}
                          onSaved={() => {
                            const currentUser = window.__erp_user__
                            if (currentUser?.id === u.user_id) {
                              refreshPermissions()
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {!loading && users.length === 0 && (
            <div className="py-12 text-center">
              <Users className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No users yet. Add the first team member.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <AddUserModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        tenantId={tenantId}
        onAdded={loadUsers}
      />
    </div>
  )
}
