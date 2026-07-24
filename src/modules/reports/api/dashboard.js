import { supabase } from '@shared/api/supabase'

export function getRange(period) {
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

export async function fetchOverviewMetrics(tenantId, period) {
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

  return {
    metrics: {
      revenue:      sum(revRes.data),
      prevRevenue:  sum(prevRevRes.data),
      expenses:     sum(expRes.data),
      prevExpenses: sum(prevExpRes.data),
      employees:    empRes.count   || 0,
      openOrders:   orderRes.count || 0,
      products:     prodRes.count  || 0,
    },
    recentInvoices: invRes.data || [],
    recentOrders:   soRes.data  || [],
  }
}
