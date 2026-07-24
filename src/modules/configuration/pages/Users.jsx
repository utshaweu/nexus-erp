import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Shield, UserX, UserCheck, Users } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td,
  PageHeader, Card, Spinner, EmptyState,
} from '@shared/components/ui'
import { useTenant } from '@core/tenant/TenantContext'
import PermissionGate from '@shared/components/PermissionGate'
import toast from '@shared/lib/toast'
import { fetchTenantUsers, updateUserRole, toggleUserActive, ROLE_OPTIONS, ROLE_COLOR } from '../api/users'
import PermissionModal from '../components/PermissionModal'
import AddUserModal from '../components/AddUserModal'

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
    setUsers(await fetchTenantUsers(tenantId))
    setLoading(false)
  }, [tenantId])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleRoleChange = async (user, newRole) => {
    try {
      await updateUserRole(tenantId, user, newRole)
      fetchUsers()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleToggleActive = async (user) => {
    try {
      await toggleUserActive(user)
      toast.success(`${user.full_name ?? 'User'} ${user.is_active ? 'deactivated' : 'reactivated'}.`)
      fetchUsers()
    } catch (err) {
      toast.error(err.message)
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
          onClose={() => setShowAdd(false)}
          onAdded={fetchUsers}
        />
      )}
    </div>
  )
}
