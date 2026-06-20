import { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, DollarSign, Users, ShoppingCart, Package,
} from 'lucide-react'
import {
  PageHeader, Card, CardHeader, CardTitle, CardContent,
  StatCard, Table, Thead, Th, Tbody, Tr, Td, Badge, Select, Spinner,
} from '@shared/components/ui'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import toast from '@shared/lib/toast'
import { INVOICE_STATUS, SALES_ORDER_STATUS } from '@shared/lib/constants'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const PERIODS = [
  { value: 'this_month',   label: 'This Month'    },
  { value: 'last_month',   label: 'Last Month'    },
  { value: 'last_3months', label: 'Last 3 Months' },
  { value: 'this_year',    label: 'This Year'     },
]

function getRange(period) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()

  if (period === 'this_month') {
    return {
      from:     new Date(y, m, 1).toISOString().slice(0, 10),
      to:       new Date(y, m + 1, 0).toISOString().slice(0, 10),
      prevFrom: new Date(y, m - 1, 1).toISOString().slice(0, 10),
      prevTo:   new Date(y, m, 0).toISOString().slice(0, 10),
    }
  }
  if (period === 'last_month') {
    return {
      from:     new Date(y, m - 1, 1).toISOString().slice(0, 10),
      to:       new Date(y, m, 0).toISOString().slice(0, 10),
      prevFrom: new Date(y, m - 2, 1).toISOString().slice(0, 10),
      prevTo:   new Date(y, m - 1, 0).toISOString().slice(0, 10),
    }
  }
  if (period === 'last_3months') {
    return {
      from:     new Date(y, m - 2, 1).toISOString().slice(0, 10),
      to:       new Date(y, m + 1, 0).toISOString().slice(0, 10),
      prevFrom: new Date(y, m - 5, 1).toISOString().slice(0, 10),
      prevTo:   new Date(y, m - 2, 0).toISOString().slice(0, 10),
    }
  }
  // this_year
  return {
    from:     new Date(y, 0, 1).toISOString().slice(0, 10),
    to:       new Date(y, 11, 31).toISOString().slice(0, 10),
    prevFrom: new Date(y - 1, 0, 1).toISOString().slice(0, 10),
    prevTo:   new Date(y - 1, 11, 31).toISOString().slice(0, 10),
  }
}

function pctChange(curr, prev) {
  if (prev === 0) return curr > 0 ? 100 : 0
  return Math.round(((curr - prev) / prev) * 100)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Overview() {
  const { tenantId } = useTenant()
  const [period, setPeriod] = useState('this_month')
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({
    revenue: 0, prevRevenue: 0,
    expenses: 0, prevExpenses: 0,
    employees: 0, openOrders: 0, products: 0,
  })
  const [recentInvoices, setRecentInvoices] = useState([])
  const [recentOrders,   setRecentOrders]   = useState([])

  const fetchData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const { from, to, prevFrom, prevTo } = getRange(period)

      const [
        revRes, prevRevRes, expRes, prevExpRes,
        empRes, orderRes, prodRes,
        invRes, soRes,
      ] = await Promise.all([
        supabase.from('invoices').select('total_amount')
          .eq('tenant_id', tenantId).eq('status', 'paid')
          .gte('invoice_date', from).lte('invoice_date', to),
        supabase.from('invoices').select('total_amount')
          .eq('tenant_id', tenantId).eq('status', 'paid')
          .gte('invoice_date', prevFrom).lte('invoice_date', prevTo),
        supabase.from('bills').select('total_amount')
          .eq('tenant_id', tenantId).eq('status', 'paid')
          .gte('bill_date', from).lte('bill_date', to),
        supabase.from('bills').select('total_amount')
          .eq('tenant_id', tenantId).eq('status', 'paid')
          .gte('bill_date', prevFrom).lte('bill_date', prevTo),
        supabase.from('hr_employees')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId).eq('status', 'active'),
        supabase.from('sales_orders')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId).in('status', ['confirmed', 'invoiced']),
        supabase.from('products')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId).eq('status', 'active'),
        supabase.from('invoices')
          .select('invoice_number, total_amount, status, invoice_date, customer:customer_id(name)')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false }).limit(5),
        supabase.from('sales_orders')
          .select('order_number, total_amount, status, order_date, customer:customer_id(name)')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false }).limit(5),
      ])

      const sum = (rows) => (rows || []).reduce((s, r) => s + Number(r.total_amount || 0), 0)

      setMetrics({
        revenue:     sum(revRes.data),
        prevRevenue: sum(prevRevRes.data),
        expenses:    sum(expRes.data),
        prevExpenses:sum(prevExpRes.data),
        employees:   empRes.count   || 0,
        openOrders:  orderRes.count || 0,
        products:    prodRes.count  || 0,
      })
      setRecentInvoices(invRes.data || [])
      setRecentOrders(soRes.data   || [])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId, period])

  useEffect(() => { fetchData() }, [fetchData])

  const net     = metrics.revenue  - metrics.expenses
  const prevNet = metrics.prevRevenue - metrics.prevExpenses

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports Overview"
        subtitle="Key metrics aggregated across all installed modules"
        breadcrumb="Reports / Overview"
        actions={
          <select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm border border-surface-200 dark:border-surface-700
                       bg-white dark:bg-surface-900 text-slate-900 dark:text-slate-200
                       focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        }
      />

      {/* KPI StatCards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Revenue"
          value={loading ? '—' : `$${fmt(metrics.revenue)}`}
          change={pctChange(metrics.revenue, metrics.prevRevenue)}
          icon={TrendingUp}
          color="#10b981"
          loading={loading}
        />
        <StatCard
          label="Expenses"
          value={loading ? '—' : `$${fmt(metrics.expenses)}`}
          change={pctChange(metrics.expenses, metrics.prevExpenses)}
          icon={TrendingDown}
          color="#f43f5e"
          loading={loading}
        />
        <StatCard
          label="Net Profit"
          value={loading ? '—' : `$${fmt(net)}`}
          change={pctChange(net, prevNet)}
          icon={DollarSign}
          color="#a855f7"
          loading={loading}
        />
        <StatCard
          label="Employees"
          value={loading ? '—' : metrics.employees}
          icon={Users}
          color="#6366f1"
          loading={loading}
        />
        <StatCard
          label="Open Orders"
          value={loading ? '—' : metrics.openOrders}
          icon={ShoppingCart}
          color="#f59e0b"
          loading={loading}
        />
        <StatCard
          label="Products"
          value={loading ? '—' : metrics.products}
          icon={Package}
          color="#3b82f6"
          loading={loading}
        />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Invoices</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-2">
            {loading ? (
              <div className="flex justify-center py-10">
                <Spinner className="w-6 h-6" />
              </div>
            ) : recentInvoices.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">No invoices found.</p>
            ) : (
              <Table>
                <Thead>
                  <Th>Invoice #</Th>
                  <Th>Customer</Th>
                  <Th>Amount</Th>
                  <Th>Status</Th>
                </Thead>
                <Tbody>
                  {recentInvoices.map(inv => (
                    <Tr key={inv.invoice_number}>
                      <Td>
                        <span className="font-mono text-xs font-medium text-purple-600 dark:text-purple-400
                                         bg-purple-50 dark:bg-purple-500/10 px-1.5 py-0.5 rounded">
                          {inv.invoice_number}
                        </span>
                      </Td>
                      <Td className="text-slate-700 dark:text-slate-300">{inv.customer?.name || '—'}</Td>
                      <Td>
                        <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                          ${fmt(inv.total_amount)}
                        </span>
                      </Td>
                      <Td>
                        <Badge color={INVOICE_STATUS[inv.status]?.color || 'default'}>
                          {INVOICE_STATUS[inv.status]?.label || inv.status}
                        </Badge>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent Sales Orders */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Sales Orders</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-2">
            {loading ? (
              <div className="flex justify-center py-10">
                <Spinner className="w-6 h-6" />
              </div>
            ) : recentOrders.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">No sales orders found.</p>
            ) : (
              <Table>
                <Thead>
                  <Th>Order #</Th>
                  <Th>Customer</Th>
                  <Th>Amount</Th>
                  <Th>Status</Th>
                </Thead>
                <Tbody>
                  {recentOrders.map(ord => (
                    <Tr key={ord.order_number}>
                      <Td>
                        <span className="font-mono text-xs font-medium text-blue-600 dark:text-blue-400
                                         bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 rounded">
                          {ord.order_number}
                        </span>
                      </Td>
                      <Td className="text-slate-700 dark:text-slate-300">{ord.customer?.name || '—'}</Td>
                      <Td>
                        <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                          ${fmt(ord.total_amount)}
                        </span>
                      </Td>
                      <Td>
                        <Badge color={SALES_ORDER_STATUS[ord.status]?.color || 'default'}>
                          {SALES_ORDER_STATUS[ord.status]?.label || ord.status}
                        </Badge>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
