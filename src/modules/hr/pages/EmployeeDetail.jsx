import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, User, Building, Award, Mail, Phone } from 'lucide-react'
import { Button, Badge, Card, CardContent, PageHeader } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { EMPLOYEE_STATUS } from '@shared/lib/constants'
import { fetchEmployeeDetail, fetchEmployeeLeaves, fetchEmployeePayrolls } from '../api/employees'
import EmployeeOverviewTab from '../components/EmployeeOverviewTab'
import EmployeeLeaveHistoryTab from '../components/EmployeeLeaveHistoryTab'
import EmployeePayrollHistoryTab from '../components/EmployeePayrollHistoryTab'

const fmt = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const TABS = ['Overview', 'Leave History', 'Payroll History']

export default function EmployeeDetail() {
  const { id }         = useParams()
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
      setEmployee(await fetchEmployeeDetail(id))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  const fetchLeaves = useCallback(async () => {
    if (!id || leavesLoaded) return
    setLeaves(await fetchEmployeeLeaves(id))
    setLeavesLoaded(true)
  }, [id, leavesLoaded])

  const fetchPayrolls = useCallback(async () => {
    if (!id || payLoaded) return
    setPayrolls(await fetchEmployeePayrolls(id))
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

      {activeTab === 'Overview' && <EmployeeOverviewTab employee={employee} />}
      {activeTab === 'Leave History' && <EmployeeLeaveHistoryTab leaves={leaves} />}
      {activeTab === 'Payroll History' && <EmployeePayrollHistoryTab payrolls={payrolls} />}
    </div>
  )
}
