import { useState } from 'react'
import { Plus, Tag, Pencil, Trash2 } from 'lucide-react'
import { Button, Badge, Table, Thead, Th, Tbody, Tr, Td, Card } from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import toast from '@shared/lib/toast'
import { EMPLOYMENT_TYPES } from '@shared/lib/constants'
import { deleteLeaveType } from '../api/leave'
import LeaveTypeModal from './LeaveTypeModal'

export default function LeaveTypesSection({ leaveTypes, onRefresh }) {
  const [showModal, setShowModal] = useState(false)
  const [editType,  setEditType]  = useState(null)

  const handleDelete = async (t) => {
    if (!window.confirm(`Delete leave type "${t.name}"?`)) return
    try {
      await deleteLeaveType(t)
      toast.success('Leave type deleted.')
      onRefresh()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-800">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <Tag className="w-4 h-4 text-pink-400" />Leave Types
        </h3>
        <PermissionGate action="create" moduleId="hr">
          <Button size="sm" onClick={() => { setEditType(null); setShowModal(true) }}>
            <Plus className="w-4 h-4" />New Type
          </Button>
        </PermissionGate>
      </div>
      {leaveTypes.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">No leave types yet.</div>
      ) : (
        <Table>
          <Thead><Th>Name</Th><Th>Days/Year</Th><Th>Employment Type</Th><Th>Paid</Th><Th>Status</Th><Th></Th></Thead>
          <Tbody>
            {leaveTypes.map(t => (
              <Tr key={t.id}>
                <Td><span className="font-medium text-slate-900 dark:text-slate-100">{t.name}</span></Td>
                <Td><span className="text-slate-600 dark:text-slate-400">{t.days_allowed}</span></Td>
                <Td><span className="text-slate-600 dark:text-slate-400">{EMPLOYMENT_TYPES[t.employment_type] || t.employment_type || '—'}</span></Td>
                <Td>
                  <Badge color={t.is_paid ? 'green' : 'default'}>{t.is_paid ? 'Paid' : 'Unpaid'}</Badge>
                </Td>
                <Td>
                  <Badge color={t.is_active ? 'green' : 'default'}>{t.is_active ? 'Active' : 'Inactive'}</Badge>
                </Td>
                <Td onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <PermissionGate action="edit" moduleId="hr">
                      <Button variant="ghost" size="xs" onClick={() => { setEditType(t); setShowModal(true) }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </PermissionGate>
                    <PermissionGate action="delete" moduleId="hr">
                      <Button variant="danger" size="xs" onClick={() => handleDelete(t)}>
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
      <LeaveTypeModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditType(null) }}
        onSaved={() => { setShowModal(false); setEditType(null); onRefresh() }}
        leaveType={editType}
      />
    </Card>
  )
}
