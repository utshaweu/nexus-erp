import { supabase } from '@shared/api/supabase'
import { buildMonthBuckets } from '@shared/lib/monthBuckets'

export async function fetchSalesDashboard(tenantId) {
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
  const totalOrders = all.length || 1

  const pipeline = [
    { label: 'Drafts',    value: all.filter(o => o.status === 'draft').length,     color: '#64748b', total: totalOrders },
    { label: 'Confirmed', value: all.filter(o => o.status === 'confirmed').length,  color: '#3b82f6', total: totalOrders },
    { label: 'Invoiced',  value: all.filter(o => o.status === 'invoiced').length,   color: '#8b5cf6', total: totalOrders },
    { label: 'Done',      value: all.filter(o => o.status === 'done').length,       color: '#10b981', total: totalOrders },
  ]

  const buckets = buildMonthBuckets(6, { revenue: 0, orders: 0 })
  ;(chartRes.data || []).forEach(o => {
    if (!o.order_date) return
    const d   = new Date(o.order_date)
    const idx = buckets.findIndex(b => b.m === d.getMonth() + 1 && b.year === d.getFullYear())
    if (idx >= 0) {
      buckets[idx].revenue += Number(o.total_amount) || 0
      buckets[idx].orders  += 1
    }
  })

  return {
    stats:    { orders: all.length, customers: customersRes.count || 0, revenue },
    pipeline,
    recent:   recentRes.data || [],
    chart:    buckets.map(({ month, revenue, orders }) => ({ month, revenue, orders })),
  }
}
