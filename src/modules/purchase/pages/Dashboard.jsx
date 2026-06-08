import { Link } from 'react-router-dom'
import { ShoppingCart, TrendingUp, Clock, CheckCircle, Plus } from 'lucide-react'
import {
  StatCard, Card, CardHeader, CardTitle, CardContent,
  Badge, Table, Thead, Th, Tbody, Tr, Td, Button, PageHeader,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const MOCK_STATS = { total: 48, pending: 12, approved: 31, totalSpend: 284500 }

const MOCK_ORDERS = [
  { id: 'PO-2024-001', vendor: 'Acme Supplies',    amount: 12500, status: 'approved', date: '2024-01-15' },
  { id: 'PO-2024-002', vendor: 'TechParts Ltd',    amount:  8900, status: 'pending',  date: '2024-01-16' },
  { id: 'PO-2024-003', vendor: 'Global Materials', amount: 34200, status: 'draft',    date: '2024-01-17' },
  { id: 'PO-2024-004', vendor: 'FastShip Co',      amount:  6750, status: 'received', date: '2024-01-18' },
]

const CHART = [
  { month: 'Aug', spend: 42000 }, { month: 'Sep', spend: 58000 },
  { month: 'Oct', spend: 51000 }, { month: 'Nov', spend: 67000 },
  { month: 'Dec', spend: 72000 }, { month: 'Jan', spend: 84500 },
]

const STATUS = {
  draft:     { label: 'Draft',    color: 'default' },
  pending:   { label: 'Pending',  color: 'yellow'  },
  approved:  { label: 'Approved', color: 'green'   },
  received:  { label: 'Received', color: 'blue'    },
  cancelled: { label: 'Cancelled',color: 'red'     },
}

export default function PurchaseDashboard() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase"
        subtitle="Manage procurement and vendor relationships"
        breadcrumb="Operations / Purchase"
        actions={
          // Only users with CREATE permission on purchase see this button
          <PermissionGate action="create" moduleId="purchase">
            <Link to="/purchase/orders">
              <Button size="sm">
                <Plus className="w-4 h-4" />
                New Purchase Order
              </Button>
            </Link>
          </PermissionGate>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Orders"    value={MOCK_STATS.total}    icon={ShoppingCart} color="#f59e0b" />
        <StatCard label="Pending Approval" value={MOCK_STATS.pending}  icon={Clock}       color="#f97316" />
        <StatCard label="Approved"        value={MOCK_STATS.approved}  icon={CheckCircle} color="#10b981" />
        <StatCard
          label="Total Spend"
          value={`$${(MOCK_STATS.totalSpend / 1000).toFixed(0)}K`}
          change={8.2}
          icon={TrendingUp}
          color="#6366f1"
        />
      </div>

      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Monthly Spend Trend</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={CHART}>
              <defs>
                <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" tick={{ fill:'#64748b', fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:'#64748b', fontSize:11 }} axisLine={false} tickLine={false}
                tickFormatter={v => `$${v/1000}K`} />
              <Tooltip
                contentStyle={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8, fontSize:12 }}
                formatter={v => [`$${v.toLocaleString()}`, 'Spend']}
              />
              <Area type="monotone" dataKey="spend" stroke="#f59e0b" strokeWidth={2} fill="url(#spendGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Purchase Orders</CardTitle>
            <Link to="/purchase/orders" className="text-xs text-brand-400 hover:text-brand-300">
              View all →
            </Link>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <Thead>
              <Th>Order #</Th><Th>Vendor</Th><Th>Date</Th><Th>Amount</Th><Th>Status</Th>
              {/* Actions column only shown if user can edit OR approve */}
              <PermissionGate action="edit" moduleId="purchase">
                <Th>Actions</Th>
              </PermissionGate>
            </Thead>
            <Tbody>
              {MOCK_ORDERS.map(order => {
                const s = STATUS[order.status]
                return (
                  <Tr key={order.id}>
                    <Td><span className="font-mono text-xs text-brand-400">{order.id}</span></Td>
                    <Td>{order.vendor}</Td>
                    <Td><span className="text-slate-500">{order.date}</span></Td>
                    <Td><span className="font-semibold">${order.amount.toLocaleString()}</span></Td>
                    <Td><Badge color={s.color}>{s.label}</Badge></Td>
                    <PermissionGate action="edit" moduleId="purchase">
                      <Td>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="xs">Edit</Button>
                          <PermissionGate action="approve" moduleId="purchase">
                            <Button variant="ghost" size="xs">Approve</Button>
                          </PermissionGate>
                          <PermissionGate action="delete" moduleId="purchase">
                            <Button variant="danger" size="xs">Delete</Button>
                          </PermissionGate>
                        </div>
                      </Td>
                    </PermissionGate>
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
