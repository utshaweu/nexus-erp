import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { DollarSign, FileText, Receipt, AlertCircle, Plus } from 'lucide-react'
import {
  StatCard, Card, CardHeader, CardTitle, CardContent,
  Badge, Button, PageHeader,
} from '@shared/components/ui'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import { INVOICE_STATUS } from '@shared/lib/constants'

// Build the last N month buckets: [{ month:'Jan', key:'2025-01', income:0, expenses:0 }, ...]
function buildMonthBuckets(n = 6) {
  const buckets = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    buckets.push({
      month:    d.toLocaleString('en-US', { month: 'short' }),
      key:      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      income:   0,
      expenses: 0,
    })
  }
  return buckets
}

const fmtShort = (n) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`
  return `$${Math.round(n)}`
}

export default function AccountsDashboard() {
  const { tenantId } = useTenant()
  const [stats, setStats] = useState({ revenue: 0, outstanding: 0, invoiceCount: 0, billsDue: 0 })
  const [cashflow, setCashflow]     = useState(buildMonthBuckets())
  const [recent, setRecent]         = useState([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    if (!tenantId) return
    const load = async () => {
      setLoading(true)
      try {
        const [invRes, billRes, recentRes] = await Promise.all([
          supabase
            .from('invoices')
            .select('status, total_amount, paid_amount, invoice_date')
            .eq('tenant_id', tenantId),
          supabase
            .from('bills')
            .select('status, total_amount, bill_date')
            .eq('tenant_id', tenantId),
          supabase
            .from('invoices')
            .select('invoice_number, customer:customer_id(name), total_amount, due_date, status')
            .eq('tenant_id', tenantId)
            .order('invoice_date', { ascending: false })
            .limit(5),
        ])

        const invoices = invRes.data  || []
        const bills    = billRes.data || []

        // ── Stats ──
        const revenue     = invoices
          .filter(i => i.status === 'paid')
          .reduce((s, i) => s + Number(i.total_amount || 0), 0)
        const outstanding = invoices
          .filter(i => ['draft', 'sent', 'overdue'].includes(i.status))
          .reduce((s, i) => s + Math.max(0, Number(i.total_amount || 0) - Number(i.paid_amount || 0)), 0)
        const invoiceCount = invoices.length
        const billsDue     = bills.filter(b => ['draft', 'posted'].includes(b.status)).length
        setStats({ revenue, outstanding, invoiceCount, billsDue })

        // ── Cash flow — last 6 months ──
        const buckets = buildMonthBuckets()
        invoices.forEach(inv => {
          if (!inv.invoice_date) return
          const key    = inv.invoice_date.slice(0, 7)
          const bucket = buckets.find(b => b.key === key)
          if (bucket) bucket.income += Number(inv.total_amount || 0)
        })
        bills.forEach(bill => {
          if (!bill.bill_date) return
          const key    = bill.bill_date.slice(0, 7)
          const bucket = buckets.find(b => b.key === key)
          if (bucket) bucket.expenses += Number(bill.total_amount || 0)
        })
        setCashflow(buckets)

        setRecent(recentRes.data || [])
      } catch (err) {
        console.error('[AccountsDashboard]', err)
      } finally {
        setLoading(false)
      }
    }
    load()
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

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Revenue"
          value={loading ? '—' : fmtShort(stats.revenue)}
          icon={DollarSign}
          color="#8b5cf6"
        />
        <StatCard
          label="Outstanding"
          value={loading ? '—' : fmtShort(stats.outstanding)}
          icon={AlertCircle}
          color="#f59e0b"
        />
        <StatCard
          label="Invoices"
          value={loading ? '—' : stats.invoiceCount}
          icon={FileText}
          color="#6366f1"
        />
        <StatCard
          label="Bills Due"
          value={loading ? '—' : stats.billsDue}
          icon={Receipt}
          color="#ec4899"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Cash flow chart */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Cash Flow — Income vs Expenses</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-slate-400">
                Loading…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={cashflow}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={v => [`$${Number(v).toLocaleString()}`, undefined]}
                  />
                  <Line
                    type="monotone"
                    dataKey="income"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={false}
                    name="Income"
                  />
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="4 4"
                    name="Expenses"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent invoices */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Invoices</CardTitle>
              <Link to="/accounts/invoices">
                <span className="text-xs text-brand-500 hover:text-brand-400 transition-colors">
                  View all →
                </span>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-sm text-slate-400">Loading…</div>
            ) : recent.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-slate-400">No invoices yet.</p>
                <Link to="/accounts/invoices" className="mt-3 inline-block">
                  <Button size="xs" variant="outline" className="gap-1">
                    <Plus className="w-3 h-3" />Create one
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recent.map(inv => (
                  <div
                    key={inv.invoice_number}
                    className="flex items-center justify-between py-2
                               border-b border-surface-200 dark:border-surface-800 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                        {inv.customer?.name || '—'}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {inv.invoice_number} · Due {inv.due_date || '—'}
                      </p>
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        ${Number(inv.total_amount || 0).toLocaleString()}
                      </p>
                      <Badge color={INVOICE_STATUS[inv.status]?.color || 'default'}>
                        {INVOICE_STATUS[inv.status]?.label || inv.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
