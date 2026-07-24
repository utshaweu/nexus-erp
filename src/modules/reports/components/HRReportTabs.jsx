import { Table, Thead, Th, Tbody, Tr, Td, Badge } from '@shared/components/ui'
import { EMPLOYEE_STATUS, EMPLOYMENT_TYPES, PAYROLL_RUN_STATUS, LEAVE_REQUEST_STATUS } from '@shared/lib/constants'
import { fmt } from '../api/reportHelpers'

export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const ATTENDANCE_STATUS_COLORS = {
  present:  'green',
  absent:   'red',
  late:     'yellow',
  half_day: 'orange',
  holiday:  'blue',
  on_leave: 'purple',
}

export function HeadcountTab({ data }) {
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {byStatus.map(s => (
          <div key={s.key} className="rounded-xl border border-surface-200 dark:border-surface-700 p-3 text-center">
            <Badge color={s.color} className="mb-2">{s.label}</Badge>
            <p className="text-2xl font-bold font-display text-slate-900 dark:text-slate-100">{s.count}</p>
          </div>
        ))}
      </div>

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

export function PayrollTab({ data }) {
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

export function LeaveTab({ data }) {
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

export function AttendanceTab({ data }) {
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
