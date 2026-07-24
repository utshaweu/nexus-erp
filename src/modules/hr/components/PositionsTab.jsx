import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Award } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, Card, EmptyState,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { PAGE_SIZE_TABLE as PAGE_SIZE } from '@shared/lib/constants'
import { fetchDepartmentOptions } from '../api/departments'
import { fetchPositions, deletePosition, togglePositionActive } from '../api/positions'
import { useResourceList } from '../hooks/useResourceList'
import ListToolbar from './ListToolbar'
import { ListLoading } from './ListStates'
import PositionModal from './PositionModal'

export default function PositionsTab() {
  const { tenantId }  = useTenant()
  const [departments, setDepartments] = useState([])

  const fetchFn = useCallback(
    ({ page, search }) => fetchPositions(tenantId, { page, search }),
    [tenantId]
  )
  const {
    items: positions, total, page, setPage, search, setSearch,
    loading, refetch, showModal, editItem: editPosition, openNew, openEdit, closeModal,
  } = useResourceList(fetchFn, [tenantId])
  const totalPages = Math.ceil(total / PAGE_SIZE)

  useEffect(() => { fetchDepartmentOptions(tenantId).then(setDepartments) }, [tenantId])

  const handleDelete = async (p) => {
    if (!window.confirm(`Delete position "${p.title}"?`)) return
    try {
      await deletePosition(p)
      toast.success('Position deleted.')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleToggleActive = async (p) => {
    try {
      await togglePositionActive(p)
      toast.success(p.is_active ? 'Deactivated.' : 'Activated.')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <Card>
      <ListToolbar
        search={search} onSearchChange={setSearch} placeholder="Search positions…"
        tabs={[]} activeTab={null} onTabChange={() => {}}
      >
        <PermissionGate action="create" moduleId="hr">
          <Button size="sm" onClick={openNew}><Plus className="w-4 h-4" />New Position</Button>
        </PermissionGate>
      </ListToolbar>

      {loading ? (
        <ListLoading icon={Award} label="Loading positions…" />
      ) : positions.length === 0 ? (
        <EmptyState
          icon={Award}
          title={search ? 'No positions match' : 'No positions yet'}
          description={search ? 'Try adjusting your search.' : 'Create your first job position.'}
          action={!search && (
            <PermissionGate action="create" moduleId="hr">
              <Button size="sm" onClick={openNew}><Plus className="w-4 h-4" />New Position</Button>
            </PermissionGate>
          )}
        />
      ) : (
        <Table>
          <Thead>
            <Th>Title</Th>
            <Th>Department</Th>
            <Th>Description</Th>
            <Th>Status</Th>
            <Th></Th>
          </Thead>
          <Tbody>
            {positions.map(p => (
              <Tr key={p.id}>
                <Td>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{p.title}</span>
                </Td>
                <Td>
                  <span className="text-slate-500 dark:text-slate-400 text-sm">
                    {p.hr_departments?.name || '—'}
                  </span>
                </Td>
                <Td>
                  <span className="text-slate-500 text-sm truncate max-w-[200px] block">
                    {p.description || '—'}
                  </span>
                </Td>
                <Td>
                  <Badge color={p.is_active ? 'green' : 'default'}>
                    {p.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </Td>
                <Td onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <PermissionGate action="edit" moduleId="hr">
                      <Button variant="ghost" size="xs" onClick={() => openEdit(p)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </PermissionGate>
                    <PermissionGate action="edit" moduleId="hr">
                      <Button
                        variant={p.is_active ? 'outline' : 'success'}
                        size="xs"
                        onClick={() => handleToggleActive(p)}
                      >
                        {p.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </PermissionGate>
                    <PermissionGate action="delete" moduleId="hr">
                      <Button variant="danger" size="xs" onClick={() => handleDelete(p)}>
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
        total={total} pageSize={PAGE_SIZE} label="positions"
        className="border-t border-surface-200 dark:border-surface-800"
      />

      <PositionModal
        open={showModal}
        onClose={closeModal}
        onSaved={refetch}
        tenantId={tenantId}
        position={editPosition}
        departments={departments}
      />
    </Card>
  )
}
