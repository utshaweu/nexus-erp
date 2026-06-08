import { Link } from 'react-router-dom'
import { DollarSign, FileText, Receipt, AlertCircle, Plus } from 'lucide-react'
import { StatCard, Card, CardHeader, CardTitle, CardContent, Badge, Table, Thead, Th, Tbody, Tr, Td, Button, PageHeader } from '@shared/components/ui'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const CASHFLOW = [
  { month:'Aug', income:82000, expenses:65000 }, { month:'Sep', income:91000, expenses:72000 },
  { month:'Oct', income:78000, expenses:68000 }, { month:'Nov', income:105000, expenses:84000 },
  { month:'Dec', income:118000, expenses:91000 }, { month:'Jan', income:98000, expenses:76000 },
]
const RECENT_INVOICES = [
  { id:'INV-001', customer:'Bright Corp', amount:18500, due:'2024-02-01', status:'unpaid' },
  { id:'INV-002', customer:'Summit Tech', amount:42000, due:'2024-01-28', status:'paid' },
  { id:'INV-003', customer:'Orbit Ltd', amount:7100, due:'2024-01-25', status:'overdue' },
  { id:'INV-004', customer:'Nova Retail', amount:9200, due:'2024-02-05', status:'unpaid' },
]
const STATUS = { paid:{ label:'Paid', color:'green' }, unpaid:{ label:'Unpaid', color:'yellow' }, overdue:{ label:'Overdue', color:'red' }}

export default function AccountsDashboard() {
  return (
    <div className="space-y-6">
      <PageHeader title="Accounts" subtitle="Financial management and reporting" breadcrumb="Finance / Accounts"
        actions={<Link to="/accounts/invoices"><Button size="sm"><Plus className="w-4 h-4"/>New Invoice</Button></Link>}/>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value="$492K" change={12.4} icon={DollarSign} color="#8b5cf6"/>
        <StatCard label="Outstanding" value="$68.5K" icon={AlertCircle} color="#f59e0b"/>
        <StatCard label="Invoices" value="47" icon={FileText} color="#6366f1"/>
        <StatCard label="Bills Due" value="12" icon={Receipt} color="#ec4899"/>
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Cash Flow — Income vs Expenses</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={CASHFLOW}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
                <XAxis dataKey="month" tick={{ fill:'#64748b', fontSize:11 }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fill:'#64748b', fontSize:11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v/1000}K`}/>
                <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8, fontSize:12 }} formatter={v => `$${v.toLocaleString()}`}/>
                <Line type="monotone" dataKey="income" stroke="#8b5cf6" strokeWidth={2} dot={false}/>
                <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="4 4"/>
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent Invoices</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {RECENT_INVOICES.map(inv => (
                <div key={inv.id} className="flex items-center justify-between py-2 border-b border-surface-800 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{inv.customer}</p>
                    <p className="text-xs text-slate-500">Due {inv.due}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">${inv.amount.toLocaleString()}</p>
                    <Badge color={STATUS[inv.status].color}>{STATUS[inv.status].label}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
