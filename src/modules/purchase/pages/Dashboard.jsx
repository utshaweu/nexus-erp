import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingCart, TrendingUp, Clock, CheckCircle, Plus } from 'lucide-react'
import {
  StatCard, Card, CardHeader, CardTitle, CardContent,
  Badge, Table, Thead, Th, Tbody, Tr, Td, Button, PageHeader, Spinner,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import { PURCHASE_ORDER_STATUS as STATUS } from '@shared/lib/constants'

function buildMonthBuckets() {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return {
      month: d.toLocaleString('default', { month: 'short' }),
      year:  d.getFullYear(),
      m:     d.getMonth() + 1,
      spend: 0,
    }
  })
}

export default function PurchaseDashboard() {
  const { tenantId } = useTenant()
  const [stats,   setStats]   = useState({ total: 0, pending: 0, approved: 0, totalSpend: 0 })
  const [orders,  setOrders]  = useState([])
  const [chart,   setChart]   = useState(buildMonthBuckets().map(({ month }) => ({ month, spend: 0 })))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tenantId) return
    load()
  }, [tenantId])

  async function load() {
    setLoading(true)
    try {
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
      sixMonthsAgo.setDate(1)
      const cutoff = sixMonthsAgo.toISOString().split('T')[0]

      const [allRes, recentRes, chartRes] = await Promise.all([
        supabase
          .from('purchase_orders')
          .select('status, total_amount')
          .eq('tenant_id', tenantId),
        supabase
          .from('purchase_orders')
          .select('id, order_number, status, order_date, total_amount, vendor:vendors(name)')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('purchase_orders')
          .select('order_date, total_amount')
          .eq('tenant_id', tenantId)
          .gte('order_date', cutoff),
      ])

      const all = allRes.data || []
      setStats({
        total:      all.length,
        pending:    all.filter(o => o.status === 'pending').length,
        approved:   all.filter(o => o.status === 'approved').length,
        totalSpend: all.reduce((s, o) => s + (Number(o.total_amount) || 0), 0),
      })

      setOrders(recentRes.data || [])

      const buckets = buildMonthBuckets()
      ;(chartRes.data || []).forEach(o => {
        if (!o.order_date) return
        const d = new Date(o.order_date)
        const idx = buckets.findIndex(b => b.m === d.getMonth() + 1 && b.year === d.getFullYear())
        if (idx >= 0) buckets[idx].spend += Number(o.total_amount) || 0
      })
      setChart(buckets.map(({ month, spend }) => ({ month, spend })))
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="w-6 h-6" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase"
        subtitle="Manage procurement and vendor relationships"
        breadcrumb="Operations / Purchase"
        actions={
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
        <StatCard label="Total Orders"     value={stats.total}    icon={ShoppingCart} color="#f59e0b" />
        <StatCard label="Pending Approval" value={stats.pending}  icon={Clock}        color="#f97316" />
        <StatCard label="Approved"         value={stats.approved} icon={CheckCircle}  color="#10b981" />
        <StatCard
          label="Total Spend"
          value={`$${(stats.totalSpend / 1000).toFixed(0)}K`}
          icon={TrendingUp}
          color="#6366f1"
        />
      </div>

      <Card>
        <CardHeader><CardTitle>Monthly Spend Trend</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chart}>
              <defs>
                <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={v => `$${v / 1000}K`}
              />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                formatter={v => [`$${Number(v).toLocaleString()}`, 'Spend']}
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
          {orders.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">No purchase orders yet.</div>
          ) : (
            <Table>
              <Thead>
                <Th>Order #</Th><Th>Vendor</Th><Th>Date</Th><Th>Amount</Th><Th>Status</Th>
              </Thead>
              <Tbody>
                {orders.map(order => {
                  const s = STATUS[order.status] || STATUS.draft
                  return (
                    <Tr key={order.id}>
                      <Td>
                        <Link to={`/purchase/orders/${order.id}`}>
                          <span className="font-mono text-xs text-brand-400 hover:text-brand-300">
                            {order.order_number}
                          </span>
                        </Link>
                      </Td>
                      <Td>{order.vendor?.name || '—'}</Td>
                      <Td><span className="text-slate-500">{order.order_date}</span></Td>
                      <Td><span className="font-semibold">${(Number(order.total_amount) || 0).toLocaleString()}</span></Td>
                      <Td><Badge color={s.color}>{s.label}</Badge></Td>
                    </Tr>
                  )
                })}
              </Tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
