import { Link } from 'react-router-dom'
import { TrendingUp, Users, FileText, DollarSign, Plus, Target, CheckCircle } from 'lucide-react'
import { StatCard, Card, CardHeader, CardTitle, CardContent, Badge, Table, Thead, Th, Tbody, Tr, Td, Button, PageHeader } from '@shared/components/ui'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts'

const MOCK_STATS = { orders: 64, customers: 128, revenue: 492800, growth: 12.4 }

const MOCK_ORDERS = [
  { id: 'SO-2024-001', customer: 'Bright Corp', amount: 18500, status: 'confirmed', date: '2024-01-15' },
  { id: 'SO-2024-002', customer: 'Nova Retail', amount: 9200, status: 'draft', date: '2024-01-16' },
  { id: 'SO-2024-003', customer: 'Summit Tech', amount: 42000, status: 'invoiced', date: '2024-01-17' },
  { id: 'SO-2024-004', customer: 'Orbit Ltd', amount: 7100, status: 'confirmed', date: '2024-01-18' },
  { id: 'SO-2024-005', customer: 'Zenith Group', amount: 31500, status: 'done', date: '2024-01-19' },
]

const MONTHLY_DATA = [
  { month: 'Aug', revenue: 62000, orders: 38 },
  { month: 'Sep', revenue: 74000, orders: 45 },
  { month: 'Oct', revenue: 68000, orders: 41 },
  { month: 'Nov', revenue: 89000, orders: 54 },
  { month: 'Dec', revenue: 105000, orders: 63 },
  { month: 'Jan', revenue: 92800, orders: 64 },
]

const STATUS = {
  draft: { label: 'Draft', color: 'default' },
  confirmed: { label: 'Confirmed', color: 'blue' },
  invoiced: { label: 'Invoiced', color: 'purple' },
  done: { label: 'Done', color: 'green' },
  cancelled: { label: 'Cancelled', color: 'red' },
}

export default function SalesDashboard() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales"
        subtitle="Track revenue, orders and customer relationships"
        breadcrumb="Operations / Sales"
        actions={
          <Link to="/sales/orders">
            <Button size="sm">
              <Plus className="w-4 h-4" /> New Sale Order
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Sales Orders" value={MOCK_STATS.orders} icon={FileText} color="#10b981" />
        <StatCard label="Customers" value={MOCK_STATS.customers} icon={Users} color="#3b82f6" />
        <StatCard label="Revenue" value={`$${(MOCK_STATS.revenue / 1000).toFixed(0)}K`} change={MOCK_STATS.growth} icon={DollarSign} color="#6366f1" />
        <StatCard label="Growth" value={`+${MOCK_STATS.growth}%`} icon={TrendingUp} color="#f59e0b" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Revenue & Orders — Last 6 Months</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={MONTHLY_DATA} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v / 1000}K`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                  formatter={(v, name) => [name === 'revenue' ? `$${v.toLocaleString()}` : v, name === 'revenue' ? 'Revenue' : 'Orders']}
                />
                <Bar yAxisId="left" dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.85} />
                <Bar yAxisId="right" dataKey="orders" fill="#6366f1" radius={[4, 4, 0, 0]} opacity={0.6} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Pipeline Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: 'Drafts', value: 8, color: '#64748b' },
                { label: 'Confirmed', value: 24, color: '#3b82f6' },
                { label: 'Invoiced', value: 18, color: '#8b5cf6' },
                { label: 'Done', value: 14, color: '#10b981' },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">{item.label}</span>
                    <span className="text-slate-300 font-medium">{item.value}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${(item.value / 64) * 100}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Sales Orders</CardTitle>
            <Link to="/sales/orders" className="text-xs text-brand-400 hover:text-brand-300">View all →</Link>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <Thead>
              <Th>Order #</Th>
              <Th>Customer</Th>
              <Th>Date</Th>
              <Th>Amount</Th>
              <Th>Status</Th>
            </Thead>
            <Tbody>
              {MOCK_ORDERS.map(order => {
                const s = STATUS[order.status]
                return (
                  <Tr key={order.id}>
                    <Td><span className="font-mono text-xs text-emerald-400">{order.id}</span></Td>
                    <Td><span className="font-medium text-slate-200">{order.customer}</span></Td>
                    <Td><span className="text-slate-500">{order.date}</span></Td>
                    <Td><span className="font-semibold">${order.amount.toLocaleString()}</span></Td>
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
