import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/shared/api/supabase'
import useStore from '@core/store/useStore'
import { Users, Shield, ChevronDown, ChevronUp, RefreshCw, UserPlus } from 'lucide-react'
import { Button, Badge, Card, CardHeader, CardTitle, CardContent, PageHeader } from '@shared/components/ui'
import { clsx } from 'clsx'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { usePermissions } from '@core/permissions/PermissionContext'
import UserPermissionEditor from './components/UserPermissionEditor'
import AddUserModal from './components/AddUserModal'

const ROLE_COLOR = {
  owner:   'purple',
  admin:   'blue',
  manager: 'cyan',
  user:    'default',
  viewer:  'default',
}

export default function TenantUsersPanel() {
  const { tenantId, tenantName, isAdmin } = useTenant()
  const { refreshPermissions }            = usePermissions()
  const { user: currentUser }             = useStore()

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
    // Update local state — avoids a re-fetch that can trip RLS after mutations
    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role: newRole } : u))
    toast.success('Role updated')
  }

  const handleToggleActive = async (u) => {
    const next = !u.is_active
    const { error } = await supabase
      .from('tenant_users')
      .update({ is_active: next })
      .eq('tenant_id', tenantId)
      .eq('user_id',   u.user_id)

    if (error) { toast.error(error.message); return }
    // Update local state directly so inactive users stay visible in the table
    setUsers(prev => prev.map(usr => usr.user_id === u.user_id ? { ...usr, is_active: next } : usr))
    toast.success(next ? 'User activated' : 'User deactivated')
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
                const isSelf     = u.user_id === currentUser?.id

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
                          {isSelf && (
                            <span className="ml-1.5 text-xs font-normal text-brand-500 dark:text-brand-400">(you)</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {u.is_active ? 'Active' : 'Inactive'} ·
                          Joined {new Date(u.joined_at).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Role selector — disabled for own row */}
                      <select
                        value={u.role}
                        disabled={isSelf}
                        onChange={e => handleRoleChange(u.user_id, e.target.value)}
                        className={clsx(
                          'px-2 py-1 rounded-lg text-xs',
                          'bg-white dark:bg-surface-800',
                          'border border-surface-200 dark:border-surface-700',
                          'text-slate-700 dark:text-slate-300',
                          'focus:outline-none focus:ring-1 focus:ring-brand-500',
                          isSelf && 'opacity-40 cursor-not-allowed'
                        )}
                      >
                        {['owner','admin','manager','user','viewer'].map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>

                      <Badge color={ROLE_COLOR[u.role]}>{u.role}</Badge>

                      {/* Active toggle — hidden for own row so admins can't lock themselves out */}
                      {!isSelf && (
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
                      )}

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
                            if (window.__erp_user__?.id === u.user_id) {
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
