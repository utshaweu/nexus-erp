import { Link } from 'react-router-dom'
import { Users, Building, Calendar, DollarSign, TrendingUp, Plus } from 'lucide-react'
import { StatCard, Card, CardHeader, CardTitle, CardContent, Badge, Table, Thead, Th, Tbody, Tr, Td, Button, PageHeader } from '@shared/components/ui'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const DEPT_DATA = [
  { name:'Engineering', value:28, color:'#6366f1' },
  { name:'Sales', value:18, color:'#10b981' },
  { name:'Finance', value:12, color:'#8b5cf6' },
  { name:'HR', value:8, color:'#ec4899' },
  { name:'Operations', value:22, color:'#f59e0b' },
]

const RECENT_EMPLOYEES = [
  { id:'EMP-001', name:'Alice Wang', dept:'Engineering', position:'Senior Developer', joined:'2024-01-10', status:'active' },
  { id:'EMP-002', name:'Bob Chen', dept:'Sales', position:'Account Manager', joined:'2024-01-08', status:'active' },
  { id:'EMP-003', name:'Sarah Kim', dept:'Finance', position:'Financial Analyst', joined:'2024-01-05', status:'active' },
  { id:'EMP-004', name:'Carlos M.', dept:'Operations', position:'Ops Manager', joined:'2023-12-20', status:'active' },
]

export default function HRDashboard() {
  return (
    <div className="space-y-6">
      <PageHeader title="Human Resources" subtitle="Manage your workforce" breadcrumb="HR"
        actions={<Link to="/hr/employees"><Button size="sm"><Plus className="w-4 h-4"/>Add Employee</Button></Link>}/>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Employees" value="88" change={4.5} icon={Users} color="#ec4899"/>
        <StatCard label="Departments" value="6" icon={Building} color="#6366f1"/>
        <StatCard label="On Leave Today" value="7" icon={Calendar} color="#f59e0b"/>
        <StatCard label="Payroll/Month" value="$284K" icon={DollarSign} color="#10b981"/>
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle>By Department</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={DEPT_DATA} cx="50%" cy="50%" outerRadius={70} dataKey="value" stroke="none">
                  {DEPT_DATA.map((d, i) => <Cell key={i} fill={d.color}/>)}
                </Pie>
                <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8, fontSize:12 }}/>
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-2">
              {DEPT_DATA.map(d => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }}/>
                    {d.name}
                  </span>
                  <span className="font-medium text-slate-300">{d.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Hires</CardTitle>
              <Link to="/hr/employees" className="text-xs text-brand-400">View all →</Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <Thead><Th>Employee</Th><Th>Department</Th><Th>Position</Th><Th>Joined</Th><Th>Status</Th></Thead>
              <Tbody>
                {RECENT_EMPLOYEES.map(e => (
                  <Tr key={e.id}>
                    <Td><span className="font-medium text-slate-200">{e.name}</span></Td>
                    <Td><span className="text-slate-400">{e.dept}</span></Td>
                    <Td><span className="text-slate-400 text-xs">{e.position}</span></Td>
                    <Td><span className="text-slate-500">{e.joined}</span></Td>
                    <Td><Badge color="green">{e.status}</Badge></Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
