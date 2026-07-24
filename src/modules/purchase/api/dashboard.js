import { supabase } from '@shared/api/supabase'

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

export async function fetchPurchaseDashboard(tenantId) {
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
  const stats = {
    total:      all.length,
    pending:    all.filter(o => o.status === 'pending').length,
    approved:   all.filter(o => o.status === 'approved').length,
    totalSpend: all.reduce((s, o) => s + (Number(o.total_amount) || 0), 0),
  }

  const buckets = buildMonthBuckets()
  ;(chartRes.data || []).forEach(o => {
    if (!o.order_date) return
    const d = new Date(o.order_date)
    const idx = buckets.findIndex(b => b.m === d.getMonth() + 1 && b.year === d.getFullYear())
    if (idx >= 0) buckets[idx].spend += Number(o.total_amount) || 0
  })

  return {
    stats,
    orders: recentRes.data || [],
    chart:  buckets.map(({ month, spend }) => ({ month, spend })),
  }
}
