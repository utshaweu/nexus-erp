import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, User, Briefcase, Calendar, DollarSign,
  Mail, Phone, MapPin, Building, Award,
} from 'lucide-react'
import {
  Button, Badge, Card, CardHeader, CardTitle, CardContent,
  Table, Thead, Th, Tbody, Tr, Td, PageHeader,
} from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import {
  EMPLOYEE_STATUS,
  EMPLOYMENT_TYPES,
  GENDER_OPTIONS,
  LEAVE_REQUEST_STATUS,
  PAYROLL_RUN_STATUS,
} from '@shared/lib/constants'

const fmt = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const TABS = ['Overview', 'Leave History', 'Payroll History']

export default function EmployeeDetail() {
  const { id }         = useParams()
  const { tenantId }   = useTenant()
  const [employee,     setEmployee]   = useState(null)
  const [leaves,       setLeaves]     = useState([])
  const [payrolls,     setPayrolls]   = useState([])
  const [activeTab,    setActiveTab]  = useState('Overview')
  const [loading,      setLoading]    = useState(true)
  const [leavesLoaded, setLeavesLoaded] = useState(false)
  const [payLoaded,    setPayLoaded]  = useState(false)

  const fetchEmployee = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('hr_employees')
        .select('*, hr_departments(name), hr_positions(title)')
        .eq('id', id)
        .single()
      if (error) throw error
      setEmployee(data)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  const fetchLeaves = useCallback(async () => {
    if (!id || leavesLoaded) return
    const { data } = await supabase
      .from('hr_leave_requests')
      .select('*, hr_leave_types(name)')
      .eq('employee_id', id)
      .order('created_at', { ascending: false })
      .limit(50)
    setLeaves(data || [])
    setLeavesLoaded(true)
  }, [id, leavesLoaded])

  const fetchPayrolls = useCallback(async () => {
    if (!id || payLoaded) return
    const { data } = await supabase
      .from('hr_payroll_entries')
      .select('*, hr_payroll_runs(run_number, period_month, period_year, status)')
      .eq('employee_id', id)
      .order('created_at', { ascending: false })
      .limit(50)
    setPayrolls(data || [])
    setPayLoaded(true)
  }, [id, payLoaded])

  useEffect(() => { fetchEmployee() }, [fetchEmployee])

  useEffect(() => {
    if (activeTab === 'Leave History') fetchLeaves()
    if (activeTab === 'Payroll History') fetchPayrolls()
  }, [activeTab, fetchLeaves, fetchPayrolls])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
          <User className="w-5 h-5 text-pink-400 animate-pulse" />
        </div>
        <p className="text-sm text-slate-400">Loading employee…</p>
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="space-y-6">
        <PageHeader title="Employee Not Found" breadcrumb="HR / Employees" />
        <Card className="p-8 text-center text-slate-500 text-sm">
          The requested employee could not be found.{' '}
          <Link to="/hr/employees" className="text-brand-400 hover:underline">Back to Employees</Link>
        </Card>
      </div>
    )
  }

  const statusInfo = EMPLOYEE_STATUS[employee.status]

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${employee.first_name} ${employee.last_name}`}
        subtitle={employee.hr_positions?.title || 'No Position'}
        breadcrumb="HR / Employees"
        actions={
          <Link to="/hr/employees">
            <Button variant="secondary" size="sm">
              <ArrowLeft className="w-4 h-4" />Back
            </Button>
          </Link>
        }
      />

      {/* Identity strip */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-6 py-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500/30 to-pink-600/10
                          border border-pink-500/20 flex items-center justify-center flex-shrink-0">
            <User className="w-7 h-7 text-pink-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {employee.first_name} {employee.last_name}
              </h2>
              <Badge color={statusInfo?.color || 'default'}>{statusInfo?.label || employee.status}</Badge>
              <span className="font-mono text-xs text-pink-600 dark:text-pink-400
                               bg-pink-50 dark:bg-pink-500/10 px-2 py-0.5 rounded-md">
                {employee.employee_number}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-500">
              {employee.hr_departments?.name && (
                <span className="flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5" />{employee.hr_departments.name}
                </span>
              )}
              {employee.hr_positions?.title && (
                <span className="flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5" />{employee.hr_positions.title}
                </span>
              )}
              {employee.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />{employee.email}
                </span>
              )}
              {employee.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />{employee.phone}
                </span>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-slate-500 mb-0.5">Basic Salary</p>
            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">${fmt(employee.basic_salary)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-surface-800 w-fit">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-white dark:bg-surface-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === 'Overview' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-4 h-4 text-pink-400" />Personal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Row label="Gender"       value={GENDER_OPTIONS[employee.gender]   || '—'} />
              <Row label="Date of Birth" value={employee.date_of_birth           || '—'} />
              <Row label="Nationality"  value={employee.nationality              || '—'} />
              <Row label="Address"      value={employee.address                  || '—'} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-pink-400" />Employment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Row label="Join Date"       value={employee.join_date} />
              <Row label="Employment Type" value={EMPLOYMENT_TYPES[employee.employment_type] || employee.employment_type} />
              <Row label="Department"      value={employee.hr_departments?.name   || '—'} />
              <Row label="Position"        value={employee.hr_positions?.title    || '—'} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-pink-400" />Compensation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Row label="Basic Salary"    value={`$${fmt(employee.basic_salary)}`} />
              <Row label="Bank Name"       value={employee.bank_name           || '—'} />
              <Row label="Account Name"    value={employee.bank_account_name   || '—'} />
              <Row label="Account Number"  value={employee.bank_account_number || '—'} />
            </CardContent>
          </Card>

          {employee.notes && (
            <Card>
              <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{employee.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Tab: Leave History */}
      {activeTab === 'Leave History' && (
        <Card>
          <CardContent className="pt-0">
            {leaves.length === 0 ? (
              <div className="py-16 text-center">
                <Calendar className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No leave requests found.</p>
              </div>
            ) : (
              <Table>
                <Thead>
                  <Th>Leave Type</Th>
                  <Th>From</Th>
                  <Th>To</Th>
                  <Th>Days</Th>
                  <Th>Reason</Th>
                  <Th>Status</Th>
                </Thead>
                <Tbody>
                  {leaves.map(l => {
                    const s = LEAVE_REQUEST_STATUS[l.status]
                    return (
                      <Tr key={l.id}>
                        <Td><span className="font-medium text-slate-800 dark:text-slate-200">{l.hr_leave_types?.name || '—'}</span></Td>
                        <Td><span className="text-slate-600 dark:text-slate-400">{l.start_date}</span></Td>
                        <Td><span className="text-slate-600 dark:text-slate-400">{l.end_date}</span></Td>
                        <Td><span className="font-medium">{l.days_count}</span></Td>
                        <Td><span className="text-slate-500 text-sm truncate max-w-[180px] block">{l.reason || '—'}</span></Td>
                        <Td><Badge color={s?.color || 'default'}>{s?.label || l.status}</Badge></Td>
                      </Tr>
                    )
                  })}
                </Tbody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Payroll History */}
      {activeTab === 'Payroll History' && (
        <Card>
          <CardContent className="pt-0">
            {payrolls.length === 0 ? (
              <div className="py-16 text-center">
                <DollarSign className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No payroll entries found.</p>
              </div>
            ) : (
              <Table>
                <Thead>
                  <Th>Payroll Run</Th>
                  <Th>Period</Th>
                  <Th>Basic Salary</Th>
                  <Th>Allowances</Th>
                  <Th>Deductions</Th>
                  <Th>Net Salary</Th>
                  <Th>Status</Th>
                </Thead>
                <Tbody>
                  {payrolls.map(p => {
                    const run = p.hr_payroll_runs
                    const s   = PAYROLL_RUN_STATUS[run?.status]
                    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                    return (
                      <Tr key={p.id}>
                        <Td>
                          <span className="font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
                            {run?.run_number || '—'}
                          </span>
                        </Td>
                        <Td>
                          <span className="text-slate-600 dark:text-slate-400">
                            {run ? `${MONTHS[(run.period_month || 1) - 1]} ${run.period_year}` : '—'}
                          </span>
                        </Td>
                        <Td><span className="font-mono text-sm">${fmt(p.basic_salary)}</span></Td>
                        <Td><span className="font-mono text-sm text-green-600 dark:text-green-400">+${fmt(p.allowances)}</span></Td>
                        <Td><span className="font-mono text-sm text-red-600 dark:text-red-400">-${fmt(p.deductions)}</span></Td>
                        <Td><span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">${fmt(p.net_salary)}</span></Td>
                        <Td><Badge color={s?.color || 'default'}>{s?.label || run?.status}</Badge></Td>
                      </Tr>
                    )
                  })}
                </Tbody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between items-start gap-4 text-sm py-1
                    border-b border-surface-100 dark:border-surface-800 last:border-0">
      <span className="text-slate-500 dark:text-slate-400 flex-shrink-0">{label}</span>
      <span className="text-slate-900 dark:text-slate-100 font-medium text-right">{value}</span>
    </div>
  )
}
