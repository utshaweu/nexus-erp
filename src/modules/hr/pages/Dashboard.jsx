import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Users, Building, Calendar, DollarSign, Plus, Clock, ArrowLeftRight } from 'lucide-react'
import {
  StatCard, Card, CardHeader, CardTitle, CardContent,
  Badge, Table, Thead, Th, Tbody, Tr, Td, Button, PageHeader,
} from '@shared/components/ui'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import toast from '@shared/lib/toast'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import { EMPLOYEE_STATUS, MOVEMENT_STATUS } from '@shared/lib/constants'

const DEPT_COLORS = [
  '#ec4899','#6366f1','#10b981','#f59e0b','#8b5cf6','#06b6d4','#ef4444','#84cc16',
]

const fmt = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

export default function HRDashboard() {
  const { tenantId } = useTenant()

  const [stats,            setStats]            = useState({ total: 0, departments: 0, onLeave: 0, payroll: 0 })
  const [deptData,         setDeptData]         = useState([])
  const [recentHires,      setRecentHires]      = useState([])
  const [pendingLeaves,    setPendingLeaves]     = useState([])
  const [pendingMovements, setPendingMovements] = useState([])
  const [loading,          setLoading]          = useState(true)

  const fetchDashboard = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const today = new Date().toISOString().slice(0, 10)

      const [
        { count: totalEmployees },
        { count: deptCount },
        { count: onLeaveCount },
        { data: employees },
        { data: depts },
        { data: pendingLeaveData },
        { data: pendingMovementData },
        { data: payrollData },
      ] = await Promise.all([
        // Total active employees
        supabase.from('hr_employees').select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId).eq('status', 'active'),

        // Total departments
        supabase.from('hr_departments').select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId).eq('is_active', true),

        // On leave today (approved leave requests that span today)
        supabase.from('hr_leave_requests').select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'approved')
          .lte('start_date', today)
          .gte('end_date', today),

        // Recent hires (last 5)
        supabase.from('hr_employees')
          .select('*, hr_departments(name), hr_positions(title)')
          .eq('tenant_id', tenantId)
          .order('join_date', { ascending: false })
          .limit(5),

        // Departments with employee counts
        supabase.from('hr_departments')
          .select('id, name')
          .eq('tenant_id', tenantId)
          .eq('is_active', true),

        // Pending leave requests (latest 5)
        supabase.from('hr_leave_requests')
          .select('*, hr_employees(first_name, last_name, employee_number), hr_leave_types(name)')
          .eq('tenant_id', tenantId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(5),

        // Pending movement requests (latest 5)
        supabase.from('hr_movements')
          .select('*, hr_employees(first_name, last_name, employee_number)')
          .eq('tenant_id', tenantId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(5),

        // Latest approved/paid payroll run net total
        supabase.from('hr_payroll_runs')
          .select('total_net')
          .eq('tenant_id', tenantId)
          .in('status', ['approved', 'paid'])
          .order('period_year', { ascending: false })
          .order('period_month', { ascending: false })
          .limit(1),
      ])

      // Compute dept distribution from employee list
      if (depts && employees) {
        const deptCounts = {}
        employees.forEach(e => {
          if (e.department_id) {
            deptCounts[e.department_id] = (deptCounts[e.department_id] || 0) + 1
          }
        })
        const chartData = depts
          .map((d, i) => ({
            name:  d.name,
            value: deptCounts[d.id] || 0,
            color: DEPT_COLORS[i % DEPT_COLORS.length],
          }))
          .filter(d => d.value > 0)
        setDeptData(chartData)
      }

      setStats({
        total:       totalEmployees || 0,
        departments: deptCount      || 0,
        onLeave:     onLeaveCount   || 0,
        payroll:     payrollData?.[0]?.total_net || 0,
      })
      setRecentHires(employees      || [])
      setPendingLeaves(pendingLeaveData    || [])
      setPendingMovements(pendingMovementData || [])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Human Resources"
        subtitle="Workforce overview"
        breadcrumb="HR"
        actions={
          <Link to="/hr/employees">
            <Button size="sm"><Plus className="w-4 h-4" />Add Employee</Button>
          </Link>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Employees"
          value={loading ? '—' : fmt(stats.total)}
          loading={loading}
          icon={Users}
          color="#ec4899"
        />
        <StatCard
          label="Departments"
          value={loading ? '—' : fmt(stats.departments)}
          loading={loading}
          icon={Building}
          color="#6366f1"
        />
        <StatCard
          label="On Leave Today"
          value={loading ? '—' : fmt(stats.onLeave)}
          loading={loading}
          icon={Calendar}
          color="#f59e0b"
        />
        <StatCard
          label="Last Payroll Net"
          value={loading ? '—' : `$${Number(stats.payroll).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
          loading={loading}
          icon={DollarSign}
          color="#10b981"
        />
      </div>

      {/* Dept chart + recent hires */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Dept pie chart */}
        <Card>
          <CardHeader><CardTitle>By Department</CardTitle></CardHeader>
          <CardContent>
            {deptData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[180px] text-slate-500 text-sm">
                No data yet
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={deptData}
                      cx="50%" cy="50%"
                      outerRadius={70}
                      dataKey="value"
                      stroke="none"
                    >
                      {deptData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {deptData.map(d => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                        {d.name}
                      </span>
                      <span className="font-medium text-slate-300">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Recent hires */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Hires</CardTitle>
              <Link to="/hr/employees" className="text-xs text-brand-400 hover:underline">View all →</Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {recentHires.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No employees yet.</p>
            ) : (
              <Table>
                <Thead>
                  <Th>Employee</Th>
                  <Th>Department</Th>
                  <Th>Position</Th>
                  <Th>Joined</Th>
                  <Th>Status</Th>
                </Thead>
                <Tbody>
                  {recentHires.map(e => {
                    const s = EMPLOYEE_STATUS[e.status]
                    return (
                      <Tr key={e.id}>
                        <Td>
                          <div>
                            <Link
                              to={`/hr/employees/${e.id}`}
                              className="font-medium text-slate-900 dark:text-slate-100 hover:text-brand-400"
                            >
                              {e.first_name} {e.last_name}
                            </Link>
                            <p className="text-xs font-mono text-slate-500">{e.employee_number}</p>
                          </div>
                        </Td>
                        <Td><span className="text-slate-500">{e.hr_departments?.name || '—'}</span></Td>
                        <Td><span className="text-slate-500 text-xs">{e.hr_positions?.title || '—'}</span></Td>
                        <Td><span className="text-slate-500">{e.join_date}</span></Td>
                        <Td><Badge color={s?.color || 'default'}>{s?.label || e.status}</Badge></Td>
                      </Tr>
                    )
                  })}
                </Tbody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending requests — Leave + Movement side by side */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Pending leave requests */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                Pending Leaves
                {pendingLeaves.length > 0 && (
                  <span className="px-1.5 py-0.5 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-500">
                    {pendingLeaves.length}
                  </span>
                )}
              </CardTitle>
              <Link to="/hr/leave" className="text-xs text-brand-400 hover:underline">Manage →</Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {pendingLeaves.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No pending leave requests.</p>
            ) : (
              <Table>
                <Thead>
                  <Th>Employee</Th>
                  <Th>Type</Th>
                  <Th>From</Th>
                  <Th>To</Th>
                  <Th>Days</Th>
                </Thead>
                <Tbody>
                  {pendingLeaves.map(l => {
                    const emp = l.hr_employees
                    return (
                      <Tr key={l.id}>
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
                        <Td><span className="text-slate-500 text-sm">{l.hr_leave_types?.name || '—'}</span></Td>
                        <Td><span className="text-slate-500 text-sm">{l.start_date}</span></Td>
                        <Td><span className="text-slate-500 text-sm">{l.end_date}</span></Td>
                        <Td><span className="font-medium">{l.days_count}</span></Td>
                      </Tr>
                    )
                  })}
                </Tbody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pending movement requests */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-pink-400" />
                Pending Movements
                {pendingMovements.length > 0 && (
                  <span className="px-1.5 py-0.5 text-xs font-semibold rounded-full bg-pink-500/20 text-pink-500">
                    {pendingMovements.length}
                  </span>
                )}
              </CardTitle>
              <Link to="/hr/movement" className="text-xs text-brand-400 hover:underline">Manage →</Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {pendingMovements.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No pending movement requests.</p>
            ) : (
              <Table>
                <Thead>
                  <Th>Employee</Th>
                  <Th>Type</Th>
                  <Th>From</Th>
                  <Th>To</Th>
                  <Th>Status</Th>
                </Thead>
                <Tbody>
                  {pendingMovements.map(mv => {
                    const emp = mv.hr_employees
                    const s   = MOVEMENT_STATUS[mv.status]
                    return (
                      <Tr key={mv.id}>
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
                        <Td><span className="text-slate-500 text-sm">{mv.movement_type}</span></Td>
                        <Td><span className="text-slate-500 text-sm">{mv.from_date}</span></Td>
                        <Td><span className="text-slate-500 text-sm">{mv.to_date}</span></Td>
                        <Td><Badge color={s?.color || 'yellow'}>{s?.label || mv.status}</Badge></Td>
                      </Tr>
                    )
                  })}
                </Tbody>
              </Table>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
