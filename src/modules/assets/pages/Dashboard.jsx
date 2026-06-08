import { Link } from 'react-router-dom'
import { Cpu, TrendingDown, Wrench, Tag, DollarSign, Plus } from 'lucide-react'
import { StatCard, Card, CardHeader, CardTitle, CardContent, Badge, Table, Thead, Th, Tbody, Tr, Td, Button, PageHeader } from '@shared/components/ui'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const DEPRECIATION_DATA = [
  { month: 'Aug', value: 980000 }, { month: 'Sep', value: 962000 }, { month: 'Oct', value: 944000 },
  { month: 'Nov', value: 926000 }, { month: 'Dec', value: 908000 }, { month: 'Jan', value: 891500 },
]

const RECENT_ASSETS = [
  { id: 'AST-001', name: 'Dell Server R740', category: 'IT Equipment', purchaseDate: '2023-06-15', cost: 18500, bookValue: 14800, status: 'active' },
  { id: 'AST-002', name: 'Office Building Unit 4A', category: 'Real Estate', purchaseDate: '2020-01-10', cost: 450000, bookValue: 390000, status: 'active' },
  { id: 'AST-003', name: 'Toyota Hilux Fleet #3', category: 'Vehicles', purchaseDate: '2022-03-20', cost: 42000, bookValue: 31500, status: 'active' },
  { id: 'AST-004', name: 'CNC Machine XR-200', category: 'Machinery', purchaseDate: '2021-07-05', cost: 85000, bookValue: 51000, status: 'maintenance' },
  { id: 'AST-005', name: 'MacBook Pro M3 (x10)', category: 'IT Equipment', purchaseDate: '2023-11-01', cost: 35000, bookValue: 32200, status: 'active' },
]

const STATUS = {
  active: { label: 'Active', color: 'green' },
  maintenance: { label: 'Maintenance', color: 'yellow' },
  disposed: { label: 'Disposed', color: 'red' },
  fully_depreciated: { label: 'Fully Depr.', color: 'default' },
}

export default function AssetDashboard() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Assets"
        subtitle="Fixed asset management and depreciation tracking"
        breadcrumb="Finance / Assets"
        actions={
          <Link to="/assets/list">
            <Button size="sm"><Plus className="w-4 h-4" />Add Asset</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Assets" value="124" icon={Cpu} color="#f97316" />
        <StatCard label="Total Value" value="$891K" change={-2.1} icon={DollarSign} color="#8b5cf6" />
        <StatCard label="Depreciated" value="14" icon={TrendingDown} color="#64748b" />
        <StatCard label="In Maintenance" value="6" icon={Wrench} color="#f59e0b" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Asset Book Value Over Time</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={DEPRECIATION_DATA}>
                <defs>
                  <linearGradient id="assetGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v / 1000}K`} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} formatter={v => [`$${v.toLocaleString()}`, 'Book Value']} />
                <Area type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} fill="url(#assetGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Assets by Category</CardTitle></CardHeader>
          <CardContent>
            {[
              { label: 'IT Equipment', count: 48, color: '#3b82f6' },
              { label: 'Vehicles', count: 22, color: '#10b981' },
              { label: 'Machinery', count: 31, color: '#f97316' },
              { label: 'Real Estate', count: 8, color: '#8b5cf6' },
              { label: 'Furniture', count: 15, color: '#64748b' },
            ].map(cat => (
              <div key={cat.label} className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">{cat.label}</span>
                  <span className="text-slate-300">{cat.count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-800">
                  <div className="h-full rounded-full" style={{ width: `${(cat.count / 124) * 100}%`, backgroundColor: cat.color }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Assets</CardTitle>
            <Link to="/assets/list" className="text-xs text-brand-400 hover:text-brand-300">View all →</Link>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <Thead>
              <Th>Asset ID</Th><Th>Name</Th><Th>Category</Th><Th>Purchase Date</Th>
              <Th>Cost</Th><Th>Book Value</Th><Th>Status</Th>
            </Thead>
            <Tbody>
              {RECENT_ASSETS.map(a => {
                const s = STATUS[a.status]
                const deprPct = Math.round(((a.cost - a.bookValue) / a.cost) * 100)
                return (
                  <Tr key={a.id}>
                    <Td><span className="font-mono text-xs text-orange-400">{a.id}</span></Td>
                    <Td><span className="font-medium text-slate-200">{a.name}</span></Td>
                    <Td><span className="text-slate-400">{a.category}</span></Td>
                    <Td><span className="text-slate-500">{a.purchaseDate}</span></Td>
                    <Td><span className="font-semibold">${a.cost.toLocaleString()}</span></Td>
                    <Td>
                      <div>
                        <span className="font-semibold text-orange-300">${a.bookValue.toLocaleString()}</span>
                        <span className="text-xs text-slate-500 ml-1">(-{deprPct}%)</span>
                      </div>
                    </Td>
                    <Td><Badge color={s.color}>{s.label}</Badge></Td>
                  </Tr>
                )
              })}
            </Tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
