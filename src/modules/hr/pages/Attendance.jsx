import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Search, Clock, CheckCircle, XCircle, AlertCircle, Pencil, Download } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card,
  Modal, Input, Select, EmptyState,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import toast from '@shared/lib/toast'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import useStore from '@core/store/useStore'
import { PAGE_SIZE_TABLE as PAGE_SIZE } from '@shared/lib/constants'
import Pagination from '@shared/components/Pagination'

// ── Constants ─────────────────────────────────────────────────────────────────

const ATTENDANCE_STATUS = {
  present:  { label: 'Present',   color: 'green'   },
  absent:   { label: 'Absent',    color: 'red'     },
  late:     { label: 'Late',      color: 'yellow'  },
  half_day: { label: 'Half Day',  color: 'orange'  },
  holiday:  { label: 'Holiday',   color: 'blue'    },
  on_leave: { label: 'On Leave',  color: 'purple'  },
}

const ATTENDANCE_STATUS_TABS = ['all', 'present', 'absent', 'late', 'half_day', 'holiday', 'on_leave']

const STATUS_ICONS = {
  present:  CheckCircle,
  absent:   XCircle,
  late:     AlertCircle,
  half_day: AlertCircle,
  holiday:  Clock,
  on_leave: Clock,
}

// ── Validation ────────────────────────────────────────────────────────────────

const attendanceSchema = z.object({
  status:         z.enum(['present', 'absent', 'late', 'half_day', 'holiday', 'on_leave']),
  check_in_time:  z.string().optional(),
  check_out_time: z.string().optional(),
  notes:          z.string().optional(),
})

// ── Attendance Entry Modal ────────────────────────────────────────────────────

function AttendanceModal({ open, onClose, onSaved, record, employee, date }) {
  const { tenantId } = useTenant()
  const session      = useStore(s => s.session)
  const isEdit       = Boolean(record)

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } =
    useForm({
      resolver: zodResolver(attendanceSchema),
      defaultValues: { status: 'present', check_in_time: '', check_out_time: '', notes: '' },
    })

  const status = watch('status')
  const showTimes = ['present', 'late', 'half_day'].includes(status)

  useEffect(() => {
    if (!open) return
    reset(record
      ? {
          status:         record.status,
          check_in_time:  record.check_in_time  || '',
          check_out_time: record.check_out_time || '',
          notes:          record.notes           || '',
        }
      : { status: 'present', check_in_time: '', check_out_time: '', notes: '' }
    )
  }, [open, record, reset])

  const onSubmit = async (data) => {
    const payload = {
      status:         data.status,
      check_in_time:  showTimes && data.check_in_time  ? data.check_in_time  : null,
      check_out_time: showTimes && data.check_out_time ? data.check_out_time : null,
      notes:          data.notes || null,
      updated_at:     new Date().toISOString(),
    }

    if (isEdit) {
      const { error } = await supabase.from('hr_attendance').update(payload).eq('id', record.id)
      if (error) { toast.error(error.message); return }
      toast.success('Attendance updated.')
    } else {
      const { error } = await supabase.from('hr_attendance').insert({
        ...payload,
        tenant_id:   tenantId,
        employee_id: employee.id,
        date,
        created_by:  session?.user?.id || null,
      })
      if (error) { toast.error(error.message); return }
      toast.success('Attendance marked.')
    }
    onSaved(); onClose()
  }

  const empName = employee ? `${employee.first_name} ${employee.last_name}` : ''

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit Attendance — ${empName}` : `Mark Attendance — ${empName}`}
      size="sm"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-surface-800 text-sm">
          <span className="text-slate-500">Date: </span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">{date}</span>
          {employee && (
            <>
              <span className="text-slate-400 mx-2">·</span>
              <span className="font-mono text-xs text-pink-500">{employee.employee_number}</span>
            </>
          )}
        </div>

        <Select label="Status" error={errors.status?.message} {...register('status')}>
          {Object.entries(ATTENDANCE_STATUS).map(([v, { label }]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </Select>

        {showTimes && (
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Check-In Time"
              type="time"
              {...register('check_in_time')}
            />
            <Input
              label="Check-Out Time"
              type="time"
              {...register('check_out_time')}
            />
          </div>
        )}

        <Input
          label="Notes (optional)"
          placeholder="Any remarks"
          {...register('notes')}
        />

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isSubmitting}>
            {isEdit ? 'Update' : 'Mark Attendance'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Bulk Quick-Mark Modal ─────────────────────────────────────────────────────

function BulkMarkModal({ open, onClose, onSaved, employees, date, tenantId, existingRecords }) {
  const session = useStore(s => s.session)
  const [busy,   setBusy]   = useState(false)
  const [status, setStatus] = useState('present')

  const unmarkedEmployees = employees.filter(
    e => !existingRecords.some(r => r.employee_id === e.id)
  )

  const handleConfirm = async () => {
    if (unmarkedEmployees.length === 0) { onClose(); return }
    setBusy(true)
    const records = unmarkedEmployees.map(e => ({
      tenant_id:   tenantId,
      employee_id: e.id,
      date,
      status,
      created_by:  session?.user?.id || null,
      updated_at:  new Date().toISOString(),
    }))
    const { error } = await supabase.from('hr_attendance').insert(records)
    if (error) { toast.error(error.message); setBusy(false); return }
    toast.success(`Marked ${records.length} employees as ${ATTENDANCE_STATUS[status]?.label}.`)
    setBusy(false)
    onSaved(); onClose()
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Attendance() {
  const { tenantId }   = useTenant()
  const today          = new Date().toISOString().slice(0, 10)
  const [date,         setDate]        = useState(today)
  const [search,       setSearch]      = useState('')
  const [statusFilter, setStatusFilter]= useState('all')
  const [employees,    setEmployees]   = useState([])
  const [records,      setRecords]     = useState([])
  const [page,         setPage]        = useState(1)
  const [loading,      setLoading]     = useState(true)
  const [showModal,    setShowModal]   = useState(false)
  const [showBulk,     setShowBulk]   = useState(false)
  const [editRecord,   setEditRecord]  = useState(null)
  const [editEmployee, setEditEmployee]= useState(null)

  const fetchEmployees = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase
      .from('hr_employees')
      .select('id, first_name, last_name, employee_number, hr_departments(name)')
      .eq('tenant_id', tenantId)
      .in('status', ['active', 'on_leave'])
      .order('first_name')
    setEmployees(data || [])
  }, [tenantId])

  const fetchAttendance = useCallback(async () => {
    if (!tenantId || !date) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('hr_attendance')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('date', date)
      if (error) throw error
      setRecords(data || [])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId, date])

  useEffect(() => { fetchEmployees()  }, [fetchEmployees])
  useEffect(() => { fetchAttendance() }, [fetchAttendance])
  useEffect(() => { setPage(1) }, [search, statusFilter, date])

  // Merge employees with their attendance record for this date
  const merged = employees.map(emp => ({
    ...emp,
    record: records.find(r => r.employee_id === emp.id) || null,
  }))

  // Filter by status and search
  const filtered = merged.filter(row => {
    const matchStatus = statusFilter === 'all'
      ? true
      : statusFilter === 'absent'
        ? !row.record   // not marked = effectively absent
        : row.record?.status === statusFilter
    const matchSearch = !search.trim()
      || `${row.first_name} ${row.last_name} ${row.employee_number}`.toLowerCase()
          .includes(search.trim().toLowerCase())
    return matchStatus && matchSearch
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged      = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Summary counts
  const summary = {
    present:  records.filter(r => r.status === 'present').length,
    absent:   employees.length - records.length,
    late:     records.filter(r => r.status === 'late').length,
    on_leave: records.filter(r => r.status === 'on_leave').length,
    half_day: records.filter(r => r.status === 'half_day').length,
  }

  const openMark = (emp, rec) => {
    setEditEmployee(emp)
    setEditRecord(rec || null)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditRecord(null)
    setEditEmployee(null)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        subtitle="Daily employee movement and attendance tracking"
        breadcrumb="HR / Attendance"
        actions={
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="text-sm"
            />
            <PermissionGate action="create" moduleId="hr">
              <Button size="sm" variant="secondary" onClick={() => setShowBulk(true)}>
                <Clock className="w-4 h-4" />Bulk Mark
              </Button>
            </PermissionGate>
          </div>
        }
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { key: 'present',  label: 'Present',   color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
          { key: 'absent',   label: 'Absent',    color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' },
          { key: 'late',     label: 'Late',      color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
          { key: 'half_day', label: 'Half Day',  color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' },
          { key: 'on_leave', label: 'On Leave',  color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
        ].map(({ key, label, color }) => (
          <div
            key={key}
            className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center cursor-pointer
                        transition-all hover:scale-[1.02] ${color}
                        ${statusFilter === key ? 'ring-2 ring-offset-1 ring-brand-500' : ''}`}
            onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
          >
            <span className="text-2xl font-bold font-display">{summary[key] || 0}</span>
            <span className="text-xs font-medium mt-0.5">{label}</span>
          </div>
        ))}
      </div>

      {/* Main table */}
      <Card>
        <div className="flex items-center gap-3 p-4 border-b border-surface-200 dark:border-surface-800 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-xs
                          px-3 py-2 rounded-lg bg-slate-50 dark:bg-surface-800
                          border border-surface-200 dark:border-surface-700">
            <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or number…"
              className="bg-transparent text-sm text-slate-700 dark:text-slate-300
                         placeholder:text-slate-400 dark:placeholder:text-slate-600 flex-1 outline-none"
            />
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-surface-800 flex-wrap">
            {ATTENDANCE_STATUS_TABS.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  statusFilter === s
                    ? 'bg-white dark:bg-surface-700 text-slate-800 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {s === 'all' ? 'All' : ATTENDANCE_STATUS[s]?.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Clock className="w-8 h-8 text-pink-400 animate-pulse" />
            <p className="text-sm text-slate-400">Loading attendance…</p>
          </div>
        ) : employees.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No active employees"
            description="Add employees first to track their attendance."
          />
        ) : paged.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No records match"
            description="Try adjusting your search or filter."
          />
        ) : (
          <Table>
            <Thead>
              <Th>Employee</Th>
              <Th>Department</Th>
              <Th>Status</Th>
              <Th>Check In</Th>
              <Th>Check Out</Th>
              <Th>Notes</Th>
              <Th></Th>
            </Thead>
            <Tbody>
              {paged.map(row => {
                const rec = row.record
                const s   = rec ? ATTENDANCE_STATUS[rec.status] : null
                const StatusIcon = rec ? (STATUS_ICONS[rec.status] || Clock) : null

                return (
                  <Tr key={row.id}>
                    <Td>
                      <div>
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {row.first_name} {row.last_name}
                        </span>
                        <p className="text-xs font-mono text-pink-500">{row.employee_number}</p>
                      </div>
                    </Td>
                    <Td>
                      <span className="text-slate-500 dark:text-slate-400 text-sm">
                        {row.hr_departments?.name || '—'}
                      </span>
                    </Td>
                    <Td>
                      {rec ? (
                        <Badge color={s?.color || 'default'}>
                          {s?.label || rec.status}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Not marked</span>
                      )}
                    </Td>
                    <Td>
                      <span className="font-mono text-sm text-slate-600 dark:text-slate-400">
                        {rec?.check_in_time || '—'}
                      </span>
                    </Td>
                    <Td>
                      <span className="font-mono text-sm text-slate-600 dark:text-slate-400">
                        {rec?.check_out_time || '—'}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-xs text-slate-500 truncate max-w-[150px] block">
                        {rec?.notes || '—'}
                      </span>
                    </Td>
                    <Td onClick={e => e.stopPropagation()}>
                      <PermissionGate action="create" moduleId="hr">
                        <Button
                          variant={rec ? 'ghost' : 'outline'}
                          size="xs"
                          onClick={() => openMark(row, rec)}
                        >
                          {rec
                            ? <><Pencil className="w-3.5 h-3.5" /></>
                            : <><Clock className="w-3.5 h-3.5" />Mark</>}
                        </Button>
                      </PermissionGate>
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
          total={filtered.length}
          pageSize={PAGE_SIZE}
          label="employees"
          className="border-t border-surface-200 dark:border-surface-800"
        />
      </Card>

      <AttendanceModal
        open={showModal}
        onClose={closeModal}
        onSaved={() => { closeModal(); fetchAttendance() }}
        record={editRecord}
        employee={editEmployee}
        date={date}
      />

      <BulkMarkModal
        open={showBulk}
        onClose={() => setShowBulk(false)}
        onSaved={fetchAttendance}
        employees={employees}
        date={date}
        tenantId={tenantId}
        existingRecords={records}
      />
    </div>
  )
}
