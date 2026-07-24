import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Users, Download, Save } from 'lucide-react'
import {
  PageHeader, Card, CardHeader, CardTitle, CardContent, Button, Input, Select, Spinner, EmptyState,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import { useTenant } from '@core/tenant/TenantContext'
import toast from '@shared/lib/toast'
import { EMPLOYEE_STATUS, EMPLOYMENT_TYPES, PAYROLL_RUN_STATUS, LEAVE_REQUEST_STATUS } from '@shared/lib/constants'
import { runHRReport, fetchReportDepartments } from '../api/hr'
import { fmt, startOfMonth, todayStr, exportCSV } from '../api/reportHelpers'
import { useSavedFilters } from '../hooks/useSavedFilters'
import ReportTabBar from '../components/ReportTabBar'
import SavedFiltersBar from '../components/SavedFiltersBar'
import SaveFilterModal from '../components/SaveFilterModal'
import { HeadcountTab, PayrollTab, LeaveTab, AttendanceTab, MONTHS } from '../components/HRReportTabs'

const filterSchema = z.object({
  date_from:     z.string().min(1, 'From date is required'),
  date_to:       z.string().min(1, 'To date is required'),
  department_id: z.string().optional(),
}).refine(d => new Date(d.date_to) >= new Date(d.date_from), {
  message: 'To date must be on or after From date',
  path: ['date_to'],
})

const TABS = [
  { id: 'headcount',  label: 'Headcount'  },
  { id: 'payroll',    label: 'Payroll'    },
  { id: 'leave',      label: 'Leave'      },
  { id: 'attendance', label: 'Attendance' },
]

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

  const form = useForm({
    resolver: zodResolver(filterSchema),
    defaultValues: { date_from: startOfMonth(), date_to: todayStr(), department_id: '' },
  })
  const { register, handleSubmit, formState: { errors } } = form

  useEffect(() => {
    if (!tenantId) return
    fetchReportDepartments(tenantId).then(setDepartments)
  }, [tenantId])

  const runReport = async (values) => {
    if (!tenantId) return
    setLoading(true)
    setHasRun(true)
    try {
      const { headcountData, payrollData, leaveData, attendanceData } = await runHRReport(tenantId, values)
      setHeadcountData(headcountData)
      setPayrollData(payrollData)
      setLeaveData(leaveData)
      setAttendanceData(attendanceData)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const {
    savedFilters, saveForm, showSave, setShowSave, closeSave, handleSaveFilter, applyFilter, deleteFilter,
  } = useSavedFilters(tenantId, 'hr', form, runReport)

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

      <SavedFiltersBar savedFilters={savedFilters} onApply={applyFilter} onDelete={deleteFilter} />

      <Card>
        <CardContent className="pt-5">
          <form onSubmit={handleSubmit(runReport)} noValidate>
            <div className="flex flex-wrap items-end gap-4">
              <Input label="From Date" type="date" error={errors.date_from?.message} {...register('date_from')} />
              <Input label="To Date"   type="date" error={errors.date_to?.message}   {...register('date_to')} />
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

      <ReportTabBar tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

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

      <SaveFilterModal
        open={showSave}
        onClose={closeSave}
        form={saveForm}
        onSubmit={handleSaveFilter}
        placeholder="e.g. June 2026 — HR Report"
        description="Saves the current date range and department filter for quick re-use."
      />
    </div>
  )
}
