import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, TrendingDown, DollarSign, Users, ShoppingCart, Package } from 'lucide-react'
import { PageHeader, StatCard } from '@shared/components/ui'
import { useTenant } from '@core/tenant/TenantContext'
import toast from '@shared/lib/toast'
import { fetchOverviewMetrics } from '../api/dashboard'
import { fmt, pctChange } from '../api/reportHelpers'
import RecentInvoicesCard from '../components/RecentInvoicesCard'
import RecentSalesOrdersCard from '../components/RecentSalesOrdersCard'

const PERIODS = [
  { value: 'this_month',   label: 'This Month'    },
  { value: 'last_month',   label: 'Last Month'    },
  { value: 'last_3months', label: 'Last 3 Months' },
  { value: 'this_year',    label: 'This Year'     },
]

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
      const { metrics, recentInvoices, recentOrders } = await fetchOverviewMetrics(tenantId, period)
      setMetrics(metrics)
      setRecentInvoices(recentInvoices)
      setRecentOrders(recentOrders)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId, period])

  useEffect(() => { fetchData() }, [fetchData])

  const net     = metrics.revenue     - metrics.expenses
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentInvoicesCard invoices={recentInvoices} loading={loading} />
        <RecentSalesOrdersCard orders={recentOrders} loading={loading} />
      </div>
    </div>
  )
}
