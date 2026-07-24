import { supabase } from '@shared/api/supabase'

// Last N month buckets: [{ month:'Jan', key:'2025-01', income:0, expenses:0 }, ...]
function buildMonthBuckets(n = 6) {
  const buckets = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    buckets.push({
      month: d.toLocaleString('en-US', { month: 'short' }),
      key:   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      income: 0, expenses: 0,
    })
  }
  return buckets
}

export async function fetchDashboardData(tenantId) {
  const [invRes, billRes, recentRes] = await Promise.all([
    supabase.from('invoices').select('status, total_amount, paid_amount, invoice_date').eq('tenant_id', tenantId),
    supabase.from('bills').select('status, total_amount, bill_date').eq('tenant_id', tenantId),
    supabase
      .from('invoices')
      .select('invoice_number, customer:customer_id(name), total_amount, due_date, status')
      .eq('tenant_id', tenantId)
      .order('invoice_date', { ascending: false })
      .limit(5),
  ])

  const invoices = invRes.data  || []
  const bills    = billRes.data || []

  const revenue = invoices
    .filter(i => i.status === 'paid')
    .reduce((s, i) => s + Number(i.total_amount || 0), 0)
  const outstanding = invoices
    .filter(i => ['draft', 'sent', 'overdue'].includes(i.status))
    .reduce((s, i) => s + Math.max(0, Number(i.total_amount || 0) - Number(i.paid_amount || 0)), 0)
  const invoiceCount = invoices.length
  const billsDue = bills.filter(b => ['draft', 'posted'].includes(b.status)).length
  const stats = { revenue, outstanding, invoiceCount, billsDue }

  const cashflow = buildMonthBuckets()
  invoices.forEach(inv => {
    if (!inv.invoice_date) return
    const bucket = cashflow.find(b => b.key === inv.invoice_date.slice(0, 7))
    if (bucket) bucket.income += Number(inv.total_amount || 0)
  })
  bills.forEach(bill => {
    if (!bill.bill_date) return
    const bucket = cashflow.find(b => b.key === bill.bill_date.slice(0, 7))
    if (bucket) bucket.expenses += Number(bill.total_amount || 0)
  })

  return { stats, cashflow, recent: recentRes.data || [] }
}
