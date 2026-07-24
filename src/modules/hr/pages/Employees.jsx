import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, Eye, Users, Link as LinkIcon } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card, EmptyState,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import {
  PAGE_SIZE_TABLE as PAGE_SIZE,
  EMPLOYEE_STATUS,
  EMPLOYEE_STATUS_TABS,
  EMPLOYMENT_TYPES,
} from '@shared/lib/constants'
import {
  fetchEmployees, fetchActiveEmployeeOptions, fetchTenantUsersForLink, deleteEmployee,
} from '../api/employees'
import { fetchDepartmentOptions } from '../api/departments'
import { fetchPositionOptions } from '../api/positions'
import { useResourceList } from '../hooks/useResourceList'
import ListToolbar from '../components/ListToolbar'
import { ListLoading } from '../components/ListStates'
import EmployeeModal from '../components/EmployeeModal'

const STATUS_TABS = EMPLOYEE_STATUS_TABS.map(s => ({ value: s, label: s === 'all' ? 'All' : EMPLOYEE_STATUS[s]?.label }))

export default function Employees() {
  const { tenantId }    = useTenant()
  const [allEmployees, setAllEmployees] = useState([])
  const [departments,  setDepartments]  = useState([])
  const [positions,    setPositions]    = useState([])
  const [tenantUsers,  setTenantUsers]  = useState([])

  const fetchFn = useCallback(
    ({ page, search, filter }) => fetchEmployees(tenantId, { page, search, filter }),
    [tenantId]
  )
  const {
    items: employees, total, page, setPage, search, setSearch, filter: statusFilter, setFilter: setStatusFilter,
    loading, refetch, showModal, editItem: editEmployee, openNew, openEdit, closeModal,
  } = useResourceList(fetchFn, [tenantId])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const refreshAllEmployees = useCallback(() => {
    fetchActiveEmployeeOptions(tenantId).then(setAllEmployees)
  }, [tenantId])

  useEffect(() => { refreshAllEmployees() }, [refreshAllEmployees])
  useEffect(() => { fetchDepartmentOptions(tenantId).then(setDepartments) }, [tenantId])
  useEffect(() => { fetchPositionOptions(tenantId).then(setPositions) }, [tenantId])
  useEffect(() => { fetchTenantUsersForLink(tenantId).then(setTenantUsers) }, [tenantId])

  const handleDelete = async (emp) => {
    if (!window.confirm(`Delete employee ${emp.employee_number} — ${emp.first_name} ${emp.last_name}? This cannot be undone.`)) return
    try {
      await deleteEmployee(emp)
      toast.success('Employee deleted.')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        subtitle="Manage your workforce"
        breadcrumb="HR / Employees"
        actions={
          <PermissionGate action="create" moduleId="hr">
            <Button size="sm" onClick={openNew}>
              <Plus className="w-4 h-4" />New Employee
            </Button>
          </PermissionGate>
        }
      />

      <Card>
        <ListToolbar
          search={search} onSearchChange={setSearch} placeholder="Search by name, number, email…"
          tabs={STATUS_TABS} activeTab={statusFilter} onTabChange={setStatusFilter}
        />

        {loading ? (
          <ListLoading icon={Users} label="Loading employees…" boxed />
        ) : employees.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search || statusFilter !== 'all' ? 'No employees match' : 'No employees yet'}
            description={
              search || statusFilter !== 'all'
                ? 'Try adjusting your search or filter.'
                : 'Add your first employee to get started.'
            }
            action={!search && statusFilter === 'all' && (
              <PermissionGate action="create" moduleId="hr">
                <Button size="sm" onClick={openNew}><Plus className="w-4 h-4" />New Employee</Button>
              </PermissionGate>
            )}
          />
        ) : (
          <Table>
            <Thead>
              <Th>Employee #</Th>
              <Th>Name</Th>
              <Th>Department</Th>
              <Th>Position</Th>
              <Th>Type</Th>
              <Th>Join Date</Th>
              <Th>Status</Th>
              <Th></Th>
            </Thead>
            <Tbody>
              {employees.map(emp => {
                const s = EMPLOYEE_STATUS[emp.status]
                return (
                  <Tr key={emp.id}>
                    <Td>
                      <span className="font-mono text-xs font-medium
                                       text-pink-600 dark:text-pink-400
                                       bg-pink-50 dark:bg-pink-500/10
                                       px-2 py-0.5 rounded-md">
                        {emp.employee_number}
                      </span>
                    </Td>
                    <Td>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {emp.first_name} {emp.last_name}
                          </span>
                          {emp.user_id && (
                            <span title="Linked to a user account" className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-500/20">
                              <LinkIcon className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                            </span>
                          )}
                        </div>
                        {emp.email && (
                          <p className="text-xs text-slate-500 mt-0.5">{emp.email}</p>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <span className="text-slate-500 dark:text-slate-400 text-sm">
                        {emp.hr_departments?.name || '—'}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-slate-500 dark:text-slate-400 text-sm">
                        {emp.hr_positions?.title || '—'}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-slate-500 dark:text-slate-400 text-sm">
                        {EMPLOYMENT_TYPES[emp.employment_type] || emp.employment_type}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-sm text-slate-600 dark:text-slate-400">{emp.join_date}</span>
                    </Td>
                    <Td>
                      <Badge color={s?.color || 'default'}>{s?.label || emp.status}</Badge>
                    </Td>
                    <Td onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Link to={`/hr/employees/${emp.id}`}>
                          <Button variant="ghost" size="xs">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                        <PermissionGate action="edit" moduleId="hr">
                          <Button variant="ghost" size="xs" onClick={() => openEdit(emp)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate action="delete" moduleId="hr">
                          <Button variant="danger" size="xs" onClick={() => handleDelete(emp)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </PermissionGate>
                      </div>
                    </Td>
                  </Tr>
                )
              })}
            </Tbody>
          </Table>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          total={total}
          pageSize={PAGE_SIZE}
          label="employees"
          className="border-t border-surface-200 dark:border-surface-800"
        />
      </Card>

      <EmployeeModal
        open={showModal}
        onClose={closeModal}
        onSaved={() => { refetch(); refreshAllEmployees() }}
        tenantId={tenantId}
        employee={editEmployee}
        departments={departments}
        positions={positions}
        allEmployees={allEmployees}
        tenantUsers={tenantUsers}
      />
    </div>
  )
}
