import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, Users, FileText, DollarSign, Plus } from 'lucide-react'
import {
  StatCard, Card, CardHeader, CardTitle, CardContent,
  Badge, Table, Thead, Th, Tbody, Tr, Td, Button, PageHeader, Spinner,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import { SALES_ORDER_STATUS as STATUS } from '@shared/lib/constants'

function buildMonthBuckets() {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return {
      month:   d.toLocaleString('default', { month: 'short' }),
      year:    d.getFullYear(),
      m:       d.getMonth() + 1,
      revenue: 0,
      orders:  0,
    }
  })
}

export default function SalesDashboard() {
  const { tenantId } = useTenant()
  const [stats,    setStats]    = useState({ orders: 0, customers: 0, revenue: 0 })
  const [pipeline, setPipeline] = useState([])
  const [recent,   setRecent]   = useState([])
  const [chart,    setChart]    = useState(buildMonthBuckets().map(({ month }) => ({ month, revenue: 0, orders: 0 })))
  const [loading,  setLoading]  = useState(true)

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

      const [allOrdersRes, customersRes, recentRes, chartRes] = await Promise.all([
        supabase
          .from('sales_orders')
          .select('status, total_amount')
          .eq('tenant_id', tenantId),
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId),
        supabase
          .from('sales_orders')
          .select('id, order_number, status, order_date, total_amount, customer:customers(name)')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('sales_orders')
          .select('order_date, total_amount')
          .eq('tenant_id', tenantId)
          .gte('order_date', cutoff),
      ])

      const all     = allOrdersRes.data || []
      const revenue = all.reduce((s, o) => s + (Number(o.total_amount) || 0), 0)

      setStats({ orders: all.length, customers: customersRes.count || 0, revenue })

      const totalOrders = all.length || 1
      setPipeline([
        { label: 'Drafts',    value: all.filter(o => o.status === 'draft').length,     color: '#64748b', total: totalOrders },
        { label: 'Confirmed', value: all.filter(o => o.status === 'confirmed').length,  color: '#3b82f6', total: totalOrders },
        { label: 'Invoiced',  value: all.filter(o => o.status === 'invoiced').length,   color: '#8b5cf6', total: totalOrders },
        { label: 'Done',      value: all.filter(o => o.status === 'done').length,       color: '#10b981', total: totalOrders },
      ])

      setRecent(recentRes.data || [])

      const buckets = buildMonthBuckets()
      ;(chartRes.data || []).forEach(o => {
        if (!o.order_date) return
        const d   = new Date(o.order_date)
        const idx = buckets.findIndex(b => b.m === d.getMonth() + 1 && b.year === d.getFullYear())
        if (idx >= 0) {
          buckets[idx].revenue += Number(o.total_amount) || 0
          buckets[idx].orders  += 1
        }
      })
      setChart(buckets.map(({ month, revenue, orders }) => ({ month, revenue, orders })))
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
        title="Sales"
        subtitle="Track revenue, orders and customer relationships"
        breadcrumb="Operations / Sales"
        actions={
          <PermissionGate action="create" moduleId="sales">
            <Link to="/sales/orders">
              <Button size="sm">
                <Plus className="w-4 h-4" />New Sale Order
              </Button>
            </Link>
          </PermissionGate>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Sales Orders" value={stats.orders}                              icon={FileText}   color="#10b981" />
        <StatCard label="Customers"    value={stats.customers}                           icon={Users}      color="#3b82f6" />
        <StatCard label="Revenue"      value={`$${(stats.revenue / 1000).toFixed(0)}K`}  icon={DollarSign} color="#6366f1" />
        <StatCard label="This Month"   value={chart[chart.length - 1]?.orders ?? 0}      icon={TrendingUp} color="#f59e0b" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Revenue &amp; Orders — Last 6 Months</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chart} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left"  tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false}
                       tickFormatter={v => `$${v / 1000}K`} />
                <YAxis yAxisId="right" orientation="right"
                       tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                  formatter={(v, name) => [
                    name === 'revenue' ? `$${v.toLocaleString()}` : v,
                    name === 'revenue' ? 'Revenue' : 'Orders',
                  ]}
                />
                <Bar yAxisId="left"  dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.85} />
                <Bar yAxisId="right" dataKey="orders"  fill="#6366f1" radius={[4, 4, 0, 0]} opacity={0.6}  />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Pipeline Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pipeline.map(item => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">{item.label}</span>
                    <span className="text-slate-300 font-medium">{item.value}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(item.value / item.total) * 100}%`,
                        backgroundColor: item.color,
                      }}
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
            <Link to="/sales/orders" className="text-xs text-brand-400 hover:text-brand-300">
              View all →
            </Link>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {recent.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">No sales orders yet.</div>
          ) : (
            <Table>
              <Thead>
                <Th>Order #</Th><Th>Customer</Th><Th>Date</Th><Th>Amount</Th><Th>Status</Th>
              </Thead>
              <Tbody>
                {recent.map(order => {
                  const s = STATUS[order.status] || STATUS.draft
                  return (
                    <Tr key={order.id}>
                      <Td>
                        <Link to={`/sales/orders/${order.id}`}>
                          <span className="font-mono text-xs text-emerald-400 hover:text-emerald-300">
                            {order.order_number}
                          </span>
                        </Link>
                      </Td>
                      <Td><span className="font-medium text-slate-200">{order.customer?.name || '—'}</span></Td>
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
