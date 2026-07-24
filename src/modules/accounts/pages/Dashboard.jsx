import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { DollarSign, FileText, Receipt, AlertCircle, Plus } from 'lucide-react'
import { StatCard, Button, PageHeader } from '@shared/components/ui'
import { useTenant } from '@core/tenant/TenantContext'
import { fetchDashboardData } from '../api/dashboard'
import CashflowChart from '../components/CashflowChart'
import RecentInvoices from '../components/RecentInvoices'

const fmtShort = (n) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`
  return `$${Math.round(n)}`
}

export default function AccountsDashboard() {
  const { tenantId } = useTenant()
  const [stats, setStats]       = useState({ revenue: 0, outstanding: 0, invoiceCount: 0, billsDue: 0 })
  const [cashflow, setCashflow] = useState([])
  const [recent, setRecent]     = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!tenantId) return
    setLoading(true)
    fetchDashboardData(tenantId)
      .then(({ stats, cashflow, recent }) => {
        setStats(stats)
        setCashflow(cashflow)
        setRecent(recent)
      })
      .catch(err => console.error('[AccountsDashboard]', err))
      .finally(() => setLoading(false))
  }, [tenantId])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts"
        subtitle="Financial management and reporting"
        breadcrumb="Finance / Accounts"
        actions={
          <Link to="/accounts/invoices">
            <Button size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" />New Invoice
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={loading ? '—' : fmtShort(stats.revenue)} icon={DollarSign} color="#8b5cf6" />
        <StatCard label="Outstanding" value={loading ? '—' : fmtShort(stats.outstanding)} icon={AlertCircle} color="#f59e0b" />
        <StatCard label="Invoices" value={loading ? '—' : stats.invoiceCount} icon={FileText} color="#6366f1" />
        <StatCard label="Bills Due" value={loading ? '—' : stats.billsDue} icon={Receipt} color="#ec4899" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <CashflowChart loading={loading} data={cashflow} />
        <RecentInvoices loading={loading} invoices={recent} />
      </div>
    </div>
  )
}
