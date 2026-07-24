import { useCallback } from 'react'
import { Plus, Pencil, Trash2, Building } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, Card, EmptyState,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { PAGE_SIZE_TABLE as PAGE_SIZE } from '@shared/lib/constants'
import { fetchDepartments, deleteDepartment, toggleDepartmentActive } from '../api/departments'
import { useResourceList } from '@shared/hooks/useResourceList'
import ListToolbar from './ListToolbar'
import { ListLoading } from './ListStates'
import DeptModal from './DeptModal'

export default function DepartmentsTab() {
  const { tenantId } = useTenant()

  const fetchFn = useCallback(
    ({ page, search }) => fetchDepartments(tenantId, { page, search }),
    [tenantId]
  )
  const {
    items: depts, total, page, setPage, search, setSearch,
    loading, refetch, showModal, editItem: editDept, openNew, openEdit, closeModal,
  } = useResourceList(fetchFn, [tenantId])
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const handleDelete = async (d) => {
    if (!window.confirm(`Delete department "${d.name}"? Employees linked to it will lose their department.`)) return
    try {
      await deleteDepartment(d)
      toast.success('Department deleted.')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleToggleActive = async (d) => {
    try {
      await toggleDepartmentActive(d)
      toast.success(d.is_active ? 'Deactivated.' : 'Activated.')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <Card>
      <ListToolbar
        search={search} onSearchChange={setSearch} placeholder="Search departments…"
        tabs={[]} activeTab={null} onTabChange={() => {}}
      >
        <PermissionGate action="create" moduleId="hr">
          <Button size="sm" onClick={openNew}><Plus className="w-4 h-4" />New Department</Button>
        </PermissionGate>
      </ListToolbar>

      {loading ? (
        <ListLoading icon={Building} label="Loading departments…" />
      ) : depts.length === 0 ? (
        <EmptyState
          icon={Building}
          title={search ? 'No departments match' : 'No departments yet'}
          description={search ? 'Try adjusting your search.' : 'Create your first department.'}
          action={!search && (
            <PermissionGate action="create" moduleId="hr">
              <Button size="sm" onClick={openNew}><Plus className="w-4 h-4" />New Department</Button>
            </PermissionGate>
          )}
        />
      ) : (
        <Table>
          <Thead>
            <Th>Name</Th>
            <Th>Description</Th>
            <Th>Status</Th>
            <Th></Th>
          </Thead>
          <Tbody>
            {depts.map(d => (
              <Tr key={d.id}>
                <Td>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{d.name}</span>
                </Td>
                <Td>
                  <span className="text-slate-500 text-sm truncate max-w-[260px] block">
                    {d.description || '—'}
                  </span>
                </Td>
                <Td>
                  <Badge color={d.is_active ? 'green' : 'default'}>
                    {d.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </Td>
                <Td onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <PermissionGate action="edit" moduleId="hr">
                      <Button variant="ghost" size="xs" onClick={() => openEdit(d)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </PermissionGate>
                    <PermissionGate action="edit" moduleId="hr">
                      <Button
                        variant={d.is_active ? 'outline' : 'success'}
                        size="xs"
                        onClick={() => handleToggleActive(d)}
                      >
                        {d.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </PermissionGate>
                    <PermissionGate action="delete" moduleId="hr">
                      <Button variant="danger" size="xs" onClick={() => handleDelete(d)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </PermissionGate>
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <Pagination
        page={page} totalPages={totalPages} onPageChange={setPage}
        total={total} pageSize={PAGE_SIZE} label="departments"
        className="border-t border-surface-200 dark:border-surface-800"
      />

      <DeptModal open={showModal} onClose={closeModal} onSaved={refetch} tenantId={tenantId} dept={editDept} />
    </Card>
  )
}
