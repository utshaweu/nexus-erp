import { useState } from 'react'
import { Button, Modal, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import useStore from '@core/store/useStore'
import { bulkMarkAttendance } from '../api/attendance'
import { ATTENDANCE_STATUS } from './AttendanceModal'

export default function BulkMarkModal({ open, onClose, onSaved, employees, date, tenantId, existingRecords }) {
  const session = useStore(s => s.session)
  const [busy,   setBusy]   = useState(false)
  const [status, setStatus] = useState('present')

  const unmarkedEmployees = employees.filter(
    e => !existingRecords.some(r => r.employee_id === e.id)
  )

  const handleConfirm = async () => {
    if (unmarkedEmployees.length === 0) { onClose(); return }
    setBusy(true)
    try {
      const count = await bulkMarkAttendance(tenantId, unmarkedEmployees, date, status, session?.user?.id)
      toast.success(`Marked ${count} employees as ${ATTENDANCE_STATUS[status]?.label}.`)
      onSaved(); onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Bulk Mark Attendance" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Mark <span className="font-semibold">{unmarkedEmployees.length}</span> unmarked employee(s) for{' '}
          <span className="font-semibold">{date}</span>.
        </p>
        <Select label="Status" value={status} onChange={e => setStatus(e.target.value)}>
          {Object.entries(ATTENDANCE_STATUS).map(([v, { label }]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </Select>
        {unmarkedEmployees.length === 0 && (
          <p className="text-sm text-amber-500">All employees are already marked for this date.</p>
        )}
        <div className="flex gap-3 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            className="flex-1"
            loading={busy}
            onClick={handleConfirm}
            disabled={unmarkedEmployees.length === 0}
          >
            Mark All
          </Button>
        </div>
      </div>
    </Modal>
  )
}
