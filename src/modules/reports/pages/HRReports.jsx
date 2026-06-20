import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Users, Download, Save, Trash2 } from 'lucide-react'
import {
  PageHeader, Card, CardHeader, CardTitle, CardContent,
  Table, Thead, Th, Tbody, Tr, Td, Badge, Button, Input, Select, Modal, Spinner, EmptyState,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import toast from '@shared/lib/toast'
import {
  EMPLOYEE_STATUS,
  EMPLOYMENT_TYPES,
  PAYROLL_RUN_STATUS,
  LEAVE_REQUEST_STATUS,
} from '@shared/lib/constants'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const startOfMonth = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
const todayStr = () => new Date().toISOString().slice(0, 10)

function exportCSV(rows, columns, filename) {
  const header = columns.map(c => c.label).join(',')
  const body   = rows.map(row =>
    columns.map(c => {
      const val = typeof c.key === 'function' ? c.key(row) : (row[c.key] ?? '')
      return `"${String(val).replace(/"/g, '""')}"`
    }).join(',')
  )
  const blob = new Blob([[header, ...body].join('\n')], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  Object.assign(document.createElement('a'), { href: url, download: filename }).click()
  URL.revokeObjectURL(url)
}

// ── Validation ────────────────────────────────────────────────────────────────

const filterSchema = z.object({
  date_from:     z.string().min(1, 'From date is required'),
  date_to:       z.string().min(1, 'To date is required'),
  department_id: z.string().optional(),
}).refine(d => new Date(d.date_to) >= new Date(d.date_from), {
  message: 'To date must be on or after From date',
  path: ['date_to'],
})

const saveSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60, 'Max 60 characters'),
})

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'headcount',  label: 'Headcount'  },
  { id: 'payroll',    label: 'Payroll'    },
  { id: 'leave',      label: 'Leave'      },
  { id: 'attendance', label: 'Attendance' },
]

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const ATTENDANCE_STATUS_COLORS = {
  present:  'green',
  absent:   'red',
  late:     'yellow',
  half_day: 'orange',
  holiday:  'blue',
  on_leave: 'purple',
}

// ── Tab: Headcount ────────────────────────────────────────────────────────────

function HeadcountTab({ data }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-500 py-10 text-center">No employee records found.</p>
  }

  const byStatus = Object.entries(EMPLOYEE_STATUS).map(([key, cfg]) => ({
    ...cfg, key, count: data.filter(e => e.status === key).length,
  })).filter(s => s.count > 0)

  const byDept = data.reduce((acc, e) => {
    const dept = e.department?.name || 'Unassigned'
    if (!acc[dept]) acc[dept] = []
    acc[dept].push(e)
    return acc
  }, {})

  return (
    <>
      {/* Status summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {byStatus.map(s => (
          <div key={s.key} className="rounded-xl border border-surface-200 dark:border-surface-700 p-3 text-center">
            <Badge color={s.color} className="mb-2">{s.label}</Badge>
            <p className="text-2xl font-bold font-display text-slate-900 dark:text-slate-100">{s.count}</p>
          </div>
        ))}
      </div>

      {/* Department breakdown */}
      <div className="space-y-3">
        {Object.entries(byDept).sort((a, b) => b[1].length - a[1].length).map(([dept, emps]) => (
          <div key={dept} className="rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5
                            bg-slate-50 dark:bg-surface-800
                            border-b border-surface-200 dark:border-surface-700">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{dept}</span>
              <span className="text-xs font-medium text-slate-500">{emps.length} employee{emps.length !== 1 ? 's' : ''}</span>
            </div>
            <Table>
              <Thead>
                <Th>Employee #</Th>
                <Th>Name</Th>
                <Th>Employment Type</Th>
                <Th>Status</Th>
                <Th>Join Date</Th>
                <Th className="text-right">Basic Salary</Th>
              </Thead>
              <Tbody>
                {emps.map(e => (
                  <Tr key={e.id}>
                    <Td><span className="font-mono text-xs text-slate-500">{e.employee_number}</span></Td>
                    <Td className="font-medium text-slate-900 dark:text-slate-100">
                      {e.first_name} {e.last_name}
                    </Td>
                    <Td>
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {EMPLOYMENT_TYPES[e.employment_type] || e.employment_type}
                      </span>
                    </Td>
                    <Td>
                      <Badge color={EMPLOYEE_STATUS[e.status]?.color || 'default'}>
                        {EMPLOYEE_STATUS[e.status]?.label || e.status}
                      </Badge>
                    </Td>
                    <Td><span className="text-sm text-slate-500">{e.join_date || '—'}</span></Td>
                    <Td className="text-right">
                      <span className="font-mono text-sm">${fmt(e.basic_salary)}</span>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Tab: Payroll ──────────────────────────────────────────────────────────────

function PayrollTab({ data }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-500 py-10 text-center">No payroll runs found for the selected period.</p>
  }

  const totals = data.reduce((acc, r) => ({
    gross:      acc.gross      + Number(r.total_gross      || 0),
    deductions: acc.deductions + Number(r.total_deductions || 0),
    net:        acc.net        + Number(r.total_net        || 0),
  }), { gross: 0, deductions: 0, net: 0 })

  return (
    <>
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: 'Total Gross',      value: totals.gross,      color: 'text-blue-600 dark:text-blue-400'    },
          { label: 'Total Deductions', value: totals.deductions, color: 'text-red-500 dark:text-red-400'      },
          { label: 'Total Net Pay',    value: totals.net,        color: 'text-emerald-600 dark:text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-surface-200 dark:border-surface-700 p-4 text-center">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">{s.label}</p>
            <p className={`text-xl font-bold font-mono ${s.color}`}>${fmt(s.value)}</p>
          </div>
        ))}
      </div>

      <Table>
        <Thead>
          <Th>Run #</Th>
          <Th>Period</Th>
          <Th>Status</Th>
          <Th className="text-right">Gross</Th>
          <Th className="text-right">Deductions</Th>
          <Th className="text-right">Net Pay</Th>
        </Thead>
        <Tbody>
          {data.map(r => (
            <Tr key={r.id}>
              <Td>
                <span className="font-mono text-xs font-medium text-purple-600 dark:text-purple-400
                                 bg-purple-50 dark:bg-purple-500/10 px-1.5 py-0.5 rounded">
                  {r.run_number}
                </span>
              </Td>
              <Td className="font-medium text-slate-700 dark:text-slate-300">
                {MONTHS[(r.period_month || 1) - 1]} {r.period_year}
              </Td>
              <Td>
                <Badge color={PAYROLL_RUN_STATUS[r.status]?.color || 'default'}>
                  {PAYROLL_RUN_STATUS[r.status]?.label || r.status}
                </Badge>
              </Td>
              <Td className="text-right">
                <span className="font-mono text-sm text-blue-600 dark:text-blue-400">${fmt(r.total_gross)}</span>
              </Td>
              <Td className="text-right">
                <span className="font-mono text-sm text-red-500 dark:text-red-400">${fmt(r.total_deductions)}</span>
              </Td>
              <Td className="text-right">
                <span className="font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400">${fmt(r.total_net)}</span>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </>
  )
}

// ── Tab: Leave ────────────────────────────────────────────────────────────────

function LeaveTab({ data }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-500 py-10 text-center">No leave requests found for the selected period.</p>
  }

  const byStatus = Object.entries(LEAVE_REQUEST_STATUS).map(([key, cfg]) => ({
    ...cfg, key,
    count: data.filter(r => r.status === key).length,
    days:  data.filter(r => r.status === key).reduce((s, r) => s + Number(r.days_count || 0), 0),
  })).filter(s => s.count > 0)

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {byStatus.map(s => (
          <div key={s.key} className="rounded-xl border border-surface-200 dark:border-surface-700 p-3">
            <div className="flex items-center justify-between mb-1">
              <Badge color={s.color}>{s.label}</Badge>
              <span className="text-xs font-medium text-slate-500">{s.count} req.</span>
            </div>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{s.days} days</p>
          </div>
        ))}
      </div>

      <Table>
        <Thead>
          <Th>Employee</Th>
          <Th>Leave Type</Th>
          <Th>From</Th>
          <Th>To</Th>
          <Th className="text-right">Days</Th>
          <Th>Status</Th>
        </Thead>
        <Tbody>
          {data.map(r => (
            <Tr key={r.id}>
              <Td className="font-medium text-slate-900 dark:text-slate-100">
                {r.employee?.first_name} {r.employee?.last_name}
                <span className="ml-1.5 text-xs text-slate-400 font-mono">{r.employee?.employee_number}</span>
              </Td>
              <Td><span className="text-sm text-slate-600 dark:text-slate-400">{r.leave_type?.name || '—'}</span></Td>
              <Td><span className="text-sm text-slate-500">{r.start_date}</span></Td>
              <Td><span className="text-sm text-slate-500">{r.end_date}</span></Td>
              <Td className="text-right">
                <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">{r.days_count}</span>
              </Td>
              <Td>
                <Badge color={LEAVE_REQUEST_STATUS[r.status]?.color || 'default'}>
                  {LEAVE_REQUEST_STATUS[r.status]?.label || r.status}
                </Badge>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </>
  )
}

// ── Tab: Attendance ───────────────────────────────────────────────────────────

function AttendanceTab({ data }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-500 py-10 text-center">No attendance records found for the selected period.</p>
  }

  const statusCounts = ['present','absent','late','half_day','holiday','on_leave'].reduce((acc, s) => {
    acc[s] = data.filter(r => r.status === s).length
    return acc
  }, {})

  const summaryItems = [
    { key: 'present',  label: 'Present',  color: 'green'  },
    { key: 'absent',   label: 'Absent',   color: 'red'    },
    { key: 'late',     label: 'Late',     color: 'yellow' },
    { key: 'half_day', label: 'Half Day', color: 'orange' },
    { key: 'holiday',  label: 'Holiday',  color: 'blue'   },
    { key: 'on_leave', label: 'On Leave', color: 'purple' },
  ].filter(s => statusCounts[s.key] > 0)

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        {summaryItems.map(s => (
          <div key={s.key} className="rounded-xl border border-surface-200 dark:border-surface-700 p-3 text-center">
            <Badge color={s.color} className="mb-2">{s.label}</Badge>
            <p className="text-2xl font-bold font-display text-slate-900 dark:text-slate-100">{statusCounts[s.key]}</p>
          </div>
        ))}
      </div>

      <Table>
        <Thead>
          <Th>Employee</Th>
          <Th>Date</Th>
          <Th>Status</Th>
          <Th>Check In</Th>
          <Th>Check Out</Th>
        </Thead>
        <Tbody>
          {data.map(r => (
            <Tr key={r.id}>
              <Td className="font-medium text-slate-900 dark:text-slate-100">
                {r.employee?.first_name} {r.employee?.last_name}
                <span className="ml-1.5 text-xs text-slate-400 font-mono">{r.employee?.employee_number}</span>
              </Td>
              <Td><span className="text-sm text-slate-500">{r.date}</span></Td>
              <Td>
                <Badge color={ATTENDANCE_STATUS_COLORS[r.status] || 'default'}>
                  {r.status?.replace('_', ' ') || '—'}
                </Badge>
              </Td>
              <Td><span className="font-mono text-sm text-slate-600 dark:text-slate-400">{r.check_in_time || '—'}</span></Td>
              <Td><span className="font-mono text-sm text-slate-600 dark:text-slate-400">{r.check_out_time || '—'}</span></Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HRReports() {
  const { tenantId }  = useTenant()
  const [activeTab,      setActiveTab]      = useState('headcount')
  const [loading,        setLoading]        = useState(false)
  const [hasRun,         setHasRun]         = useState(false)
  const [headcountData,  setHeadcountData]  = useState([])
  const [payrollData,    setPayrollData]    = useState([])
  const [leaveData,      setLeaveData]      = useState([])
  const [attendanceData, setAttendanceData] = useState([])
  const [departments,    setDepartments]    = useState([])
  const [savedFilters,   setSavedFilters]   = useState([])
  const [showSave,       setShowSave]       = useState(false)

  const { register, handleSubmit, getValues, reset, formState: { errors } } = useForm({
    resolver: zodResolver(filterSchema),
    defaultValues: { date_from: startOfMonth(), date_to: todayStr(), department_id: '' },
  })

  const saveForm = useForm({ resolver: zodResolver(saveSchema), defaultValues: { name: '' } })

  const fetchDepartments = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase
      .from('hr_departments')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name')
    setDepartments(data || [])
  }, [tenantId])

  const fetchSavedFilters = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase
      .from('report_saved_filters')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('report_page', 'hr')
      .order('created_at', { ascending: false })
    setSavedFilters(data || [])
  }, [tenantId])

  useEffect(() => {
    fetchDepartments()
    fetchSavedFilters()
  }, [fetchDepartments, fetchSavedFilters])

  const runReport = async (values) => {
    if (!tenantId) return
    setLoading(true)
    setHasRun(true)
    try {
      const { date_from, date_to, department_id } = values

      // Headcount: all employees (current snapshot, filtered by department if provided)
      let empQuery = supabase
        .from('hr_employees')
        .select('id, employee_number, first_name, last_name, employment_type, status, join_date, basic_salary, department:department_id(name)')
        .eq('tenant_id', tenantId)
        .order('first_name')
      if (department_id) empQuery = empQuery.eq('department_id', department_id)

      // Payroll: runs created in the date range
      const payrollQuery = supabase
        .from('hr_payroll_runs')
        .select('id, run_number, period_month, period_year, status, total_gross, total_deductions, total_net')
        .eq('tenant_id', tenantId)
        .gte('created_at', date_from)
        .lte('created_at', date_to + 'T23:59:59')
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false })

      // Leave: requests with start_date in range
      let leaveQuery = supabase
        .from('hr_leave_requests')
        .select('id, start_date, end_date, days_count, status, reason, employee:employee_id(first_name, last_name, employee_number, department_id), leave_type:leave_type_id(name)')
        .eq('tenant_id', tenantId)
        .gte('start_date', date_from)
        .lte('start_date', date_to)
        .order('start_date', { ascending: false })

      // Attendance: records in date range
      let attendanceQuery = supabase
        .from('hr_attendance')
        .select('id, date, status, check_in_time, check_out_time, employee:employee_id(first_name, last_name, employee_number)')
        .eq('tenant_id', tenantId)
        .gte('date', date_from)
        .lte('date', date_to)
        .order('date', { ascending: false })

      const [empRes, payrollRes, leaveRes, attRes] = await Promise.all([
        empQuery, payrollQuery, leaveQuery, attendanceQuery,
      ])

      if (empRes.error)     throw empRes.error
      if (payrollRes.error) throw payrollRes.error
      if (leaveRes.error)   throw leaveRes.error
      if (attRes.error)     throw attRes.error

      setHeadcountData(empRes.data     || [])
      setPayrollData(payrollRes.data   || [])
      setLeaveData(leaveRes.data       || [])
      setAttendanceData(attRes.data    || [])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveFilter = async (data) => {
    const { error } = await supabase.from('report_saved_filters').insert({
      tenant_id:   tenantId,
      report_page: 'hr',
      name:        data.name,
      filters:     getValues(),
    })
    if (error) { toast.error(error.message); return }
    toast.success('Filter saved.')
    saveForm.reset()
    setShowSave(false)
    fetchSavedFilters()
  }

  const applyFilter = (sf) => {
    reset(sf.filters)
    handleSubmit(runReport)()
  }

  const deleteFilter = async (id) => {
    const { error } = await supabase.from('report_saved_filters').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Filter deleted.')
    fetchSavedFilters()
  }

  const handleExport = () => {
    if (activeTab === 'headcount') {
      exportCSV(headcountData, [
        { label: 'Employee #',   key: 'employee_number' },
        { label: 'First Name',   key: 'first_name' },
        { label: 'Last Name',    key: 'last_name' },
        { label: 'Department',   key: r => r.department?.name || 'Unassigned' },
        { label: 'Type',         key: r => EMPLOYMENT_TYPES[r.employment_type] || r.employment_type },
        { label: 'Status',       key: r => EMPLOYEE_STATUS[r.status]?.label || r.status },
        { label: 'Join Date',    key: 'join_date' },
        { label: 'Basic Salary', key: r => fmt(r.basic_salary) },
      ], 'headcount.csv')
    } else if (activeTab === 'payroll') {
      exportCSV(payrollData, [
        { label: 'Run #',       key: 'run_number' },
        { label: 'Period',      key: r => `${MONTHS[(r.period_month || 1) - 1]} ${r.period_year}` },
        { label: 'Status',      key: r => PAYROLL_RUN_STATUS[r.status]?.label || r.status },
        { label: 'Gross',       key: r => fmt(r.total_gross) },
        { label: 'Deductions',  key: r => fmt(r.total_deductions) },
        { label: 'Net Pay',     key: r => fmt(r.total_net) },
      ], 'payroll_summary.csv')
    } else if (activeTab === 'leave') {
      exportCSV(leaveData, [
        { label: 'Employee',   key: r => `${r.employee?.first_name || ''} ${r.employee?.last_name || ''}`.trim() },
        { label: 'Leave Type', key: r => r.leave_type?.name || '—' },
        { label: 'From',       key: 'start_date' },
        { label: 'To',         key: 'end_date' },
        { label: 'Days',       key: 'days_count' },
        { label: 'Status',     key: r => LEAVE_REQUEST_STATUS[r.status]?.label || r.status },
      ], 'leave_summary.csv')
    } else if (activeTab === 'attendance') {
      exportCSV(attendanceData, [
        { label: 'Employee',    key: r => `${r.employee?.first_name || ''} ${r.employee?.last_name || ''}`.trim() },
        { label: 'Date',        key: 'date' },
        { label: 'Status',      key: r => r.status?.replace('_', ' ') || '—' },
        { label: 'Check In',    key: r => r.check_in_time  || '—' },
        { label: 'Check Out',   key: r => r.check_out_time || '—' },
      ], 'attendance.csv')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="HR Reports"
        subtitle="Headcount, payroll, leave, and attendance analytics"
        breadcrumb="Reports / HR Reports"
        actions={
          <PermissionGate action="export" moduleId="reports">
            <Button variant="secondary" size="sm" onClick={handleExport} disabled={!hasRun} className="gap-1.5">
              <Download className="w-4 h-4" />Export CSV
            </Button>
          </PermissionGate>
        }
      />

      {/* Saved Filters */}
      {savedFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Saved:</span>
          {savedFilters.map(sf => (
            <span key={sf.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full
                                          text-xs font-medium
                                          bg-purple-50 dark:bg-purple-500/10
                                          border border-purple-200 dark:border-purple-500/30
                                          text-purple-700 dark:text-purple-300">
              <button onClick={() => applyFilter(sf)} className="hover:underline">{sf.name}</button>
              <button onClick={() => deleteFilter(sf.id)} className="ml-0.5 hover:text-red-500 transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Filter Form */}
      <Card>
        <CardContent className="pt-5">
          <form onSubmit={handleSubmit(runReport)} noValidate>
            <div className="flex flex-wrap items-end gap-4">
              <Input
                label="From Date"
                type="date"
                error={errors.date_from?.message}
                {...register('date_from')}
              />
              <Input
                label="To Date"
                type="date"
                error={errors.date_to?.message}
                {...register('date_to')}
              />
              <Select label="Department" {...register('department_id')}>
                <option value="">All Departments</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
              <div className="flex gap-2 pb-px">
                <Button type="submit" loading={loading} className="gap-1.5">
                  <Users className="w-4 h-4" />Run Report
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowSave(true)} className="gap-1.5">
                  <Save className="w-4 h-4" />Save Filter
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-surface-800 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === t.id
                ? 'bg-white dark:bg-surface-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Report Output */}
      {!hasRun ? (
        <Card>
          <EmptyState
            icon={Users}
            title="Configure and run your report"
            description="Set a date range above and click Run Report to see HR analytics."
          />
        </Card>
      ) : loading ? (
        <Card className="flex items-center justify-center py-20">
          <Spinner className="w-8 h-8" />
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{TABS.find(t => t.id === activeTab)?.label}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {activeTab === 'headcount'  && <HeadcountTab  data={headcountData}  />}
            {activeTab === 'payroll'    && <PayrollTab    data={payrollData}    />}
            {activeTab === 'leave'      && <LeaveTab      data={leaveData}      />}
            {activeTab === 'attendance' && <AttendanceTab data={attendanceData} />}
          </CardContent>
        </Card>
      )}

      {/* Save Filter Modal */}
      <Modal open={showSave} onClose={() => { setShowSave(false); saveForm.reset() }} title="Save Filter" size="sm">
        <form onSubmit={saveForm.handleSubmit(handleSaveFilter)} noValidate className="space-y-4">
          <Input
            label="Filter Name"
            placeholder="e.g. June 2026 — HR Report"
            error={saveForm.formState.errors.name?.message}
            {...saveForm.register('name')}
          />
          <p className="text-xs text-slate-500">
            Saves the current date range and department filter for quick re-use.
          </p>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" className="flex-1"
              onClick={() => { setShowSave(false); saveForm.reset() }}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={saveForm.formState.isSubmitting}>Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
