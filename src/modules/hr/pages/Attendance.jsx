import { useState, useEffect, useCallback } from 'react'
import { Search, Clock, CheckCircle, XCircle, AlertCircle, Pencil } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card, Input, EmptyState,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import { useTenant } from '@core/tenant/TenantContext'
import { PAGE_SIZE_TABLE as PAGE_SIZE } from '@shared/lib/constants'
import { fetchActiveEmployeesForAttendance, fetchAttendanceForDate } from '../api/attendance'
import ListToolbar from '../components/ListToolbar'
import { ListLoading } from '../components/ListStates'
import AttendanceModal, { ATTENDANCE_STATUS } from '../components/AttendanceModal'
import BulkMarkModal from '../components/BulkMarkModal'

const ATTENDANCE_STATUS_TABS_LIST = ['all', 'present', 'absent', 'late', 'half_day', 'holiday', 'on_leave']
  .map(s => ({ value: s, label: s === 'all' ? 'All' : ATTENDANCE_STATUS[s]?.label }))

const STATUS_ICONS = {
  present:  CheckCircle,
  absent:   XCircle,
  late:     AlertCircle,
  half_day: AlertCircle,
  holiday:  Clock,
  on_leave: Clock,
}

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

  useEffect(() => {
    fetchActiveEmployeesForAttendance(tenantId).then(setEmployees)
  }, [tenantId])

  const fetchAttendance = useCallback(async () => {
    if (!tenantId || !date) return
    setLoading(true)
    setRecords(await fetchAttendanceForDate(tenantId, date))
    setLoading(false)
  }, [tenantId, date])

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
        <ListToolbar
          search={search} onSearchChange={setSearch} placeholder="Search by name or number…"
          tabs={ATTENDANCE_STATUS_TABS_LIST} activeTab={statusFilter} onTabChange={setStatusFilter}
        />

        {loading ? (
          <ListLoading icon={Clock} label="Loading attendance…" />
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
