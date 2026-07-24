import { useState, useEffect, useCallback } from 'react'
import { Plus, Check, DollarSign, Pencil, Trash2 } from 'lucide-react'
import {
  Button, Badge, Card, Table, Thead, Th, Tbody, Tr, Td, Modal,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import toast from '@shared/lib/toast'
import useStore from '@core/store/useStore'
import { PAYROLL_RUN_STATUS } from '@shared/lib/constants'
import {
  fetchRunEntries, fetchEmployeeOptionsForPayroll,
  deletePayrollEntry, approvePayrollRun, markPayrollRunPaid,
} from '../api/payroll'
import PayrollEntryModal from './PayrollEntryModal'
import { MONTHS } from './PayrollRunModal'

const fmt = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function RunDetailModal({ open, onClose, run, tenantId }) {
  const [entries,      setEntries]   = useState([])
  const [employees,    setEmployees] = useState([])
  const [loading,      setLoading]   = useState(true)
  const [showAddEntry, setShowAdd]   = useState(false)
  const [editEntry,    setEditEntry] = useState(null)
  const session                      = useStore(s => s.session)

  const fetchEntries = useCallback(async () => {
    if (!run?.id) return
    setLoading(true)
    setEntries(await fetchRunEntries(run.id))
    setLoading(false)
  }, [run?.id])

  useEffect(() => {
    if (open) {
      fetchEntries()
      fetchEmployeeOptionsForPayroll(tenantId).then(setEmployees)
    }
  }, [open, fetchEntries, tenantId])

  const handleDeleteEntry = async (entry) => {
    if (!window.confirm('Remove this employee from payroll?')) return
    try {
      await deletePayrollEntry(entry, run.id)
      toast.success('Entry removed.')
      fetchEntries()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleApprove = async () => {
    if (!window.confirm('Approve this payroll run? This confirms all entries.')) return
    try {
      await approvePayrollRun(run, session?.user?.id)
      toast.success('Payroll run approved.')
      onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleMarkPaid = async () => {
    if (!window.confirm('Mark this payroll run as paid?')) return
    try {
      await markPayrollRunPaid(run)
      toast.success('Payroll run marked as paid.')
      onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (!run) return null

  const s = PAYROLL_RUN_STATUS[run.status]
  const isDraft    = run.status === 'draft'
  const isApproved = run.status === 'approved'

  const existingEmployeeIds = new Set(entries.map(e => e.employee_id))
  const availableEmployees = employees.filter(e => !existingEmployeeIds.has(e.id))

  return (
    <Modal open={open} onClose={onClose} title={`Payroll Run — ${run.run_number}`} size="xl">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-surface-800">
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Period</p>
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              {MONTHS[(run.period_month || 1) - 1]} {run.period_year}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Status</p>
            <Badge color={s?.color || 'default'}>{s?.label || run.status}</Badge>
          </div>
          <div className="ml-auto grid grid-cols-3 gap-6 text-right">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Gross</p>
              <p className="font-bold text-slate-900 dark:text-slate-100">${fmt(run.total_gross)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Deductions</p>
              <p className="font-bold text-red-600 dark:text-red-400">-${fmt(run.total_deductions)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Net</p>
              <p className="font-bold text-pink-600 dark:text-pink-400">${fmt(run.total_net)}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Payroll Entries ({entries.length})
          </h4>
          {isDraft && availableEmployees.length > 0 && (
            <PermissionGate action="create" moduleId="hr">
              <Button size="sm" onClick={() => setShowAdd(true)}>
                <Plus className="w-4 h-4" />Add Employee
              </Button>
            </PermissionGate>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400">Loading entries…</div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            No employees in this payroll run yet.{isDraft && ' Click "Add Employee" to begin.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <Thead>
                <Th>Employee</Th>
                <Th>Department</Th>
                <Th>Basic</Th>
                <Th>Allowances</Th>
                <Th>Deductions</Th>
                <Th>Gross</Th>
                <Th>Net</Th>
                {isDraft && <Th></Th>}
              </Thead>
              <Tbody>
                {entries.map(e => {
                  const emp = e.hr_employees
                  return (
                    <Tr key={e.id}>
                      <Td>
                        <div>
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {emp ? `${emp.first_name} ${emp.last_name}` : '—'}
                          </span>
                          {emp?.employee_number && (
                            <p className="text-xs font-mono text-slate-500">{emp.employee_number}</p>
                          )}
                        </div>
                      </Td>
                      <Td>
                        <span className="text-slate-500 dark:text-slate-400 text-sm">
                          {emp?.hr_departments?.name || '—'}
                        </span>
                      </Td>
                      <Td><span className="font-mono text-sm">${fmt(e.basic_salary)}</span></Td>
                      <Td><span className="font-mono text-sm text-green-600 dark:text-green-400">+${fmt(e.allowances)}</span></Td>
                      <Td><span className="font-mono text-sm text-red-600 dark:text-red-400">-${fmt(e.deductions)}</span></Td>
                      <Td><span className="font-mono text-sm">${fmt(e.gross_salary)}</span></Td>
                      <Td><span className="font-mono text-sm font-bold text-pink-600 dark:text-pink-400">${fmt(e.net_salary)}</span></Td>
                      {isDraft && (
                        <Td onClick={ev => ev.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <PermissionGate action="edit" moduleId="hr">
                              <Button variant="ghost" size="xs" onClick={() => setEditEntry(e)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            </PermissionGate>
                            <PermissionGate action="delete" moduleId="hr">
                              <Button variant="danger" size="xs" onClick={() => handleDeleteEntry(e)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </PermissionGate>
                          </div>
                        </Td>
                      )}
                    </Tr>
                  )
                })}
              </Tbody>
            </Table>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-surface-200 dark:border-surface-800">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {isDraft && entries.length > 0 && (
            <PermissionGate action="approve" moduleId="hr">
              <Button onClick={handleApprove}>
                <Check className="w-4 h-4" />Approve Run
              </Button>
            </PermissionGate>
          )}
          {isApproved && (
            <PermissionGate action="approve" moduleId="hr">
              <Button onClick={handleMarkPaid}>
                <DollarSign className="w-4 h-4" />Mark as Paid
              </Button>
            </PermissionGate>
          )}
        </div>
      </div>

      <PayrollEntryModal
        open={showAddEntry}
        onClose={() => setShowAdd(false)}
        onSaved={() => { setShowAdd(false); fetchEntries() }}
        runId={run.id}
        tenantId={tenantId}
        employees={availableEmployees}
        entry={null}
      />

      <PayrollEntryModal
        open={Boolean(editEntry)}
        onClose={() => setEditEntry(null)}
        onSaved={() => { setEditEntry(null); fetchEntries() }}
        runId={run.id}
        tenantId={tenantId}
        employees={employees}
        entry={editEntry}
      />
    </Modal>
  )
}
