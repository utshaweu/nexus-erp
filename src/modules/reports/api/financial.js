import { supabase } from '@shared/api/supabase'

export const AGING_BUCKETS = ['current', '1–30', '31–60', '61–90', '90+']
export const BUCKET_COLORS = { current: 'green', '1–30': 'blue', '31–60': 'yellow', '61–90': 'orange', '90+': 'red' }
export const BUCKET_LABELS = { current: 'Current', '1–30': '1–30 days', '31–60': '31–60 days', '61–90': '61–90 days', '90+': '90+ days' }

function ageBucket(dueDateStr) {
  if (!dueDateStr) return 'current'
  const days = Math.floor((Date.now() - new Date(dueDateStr).getTime()) / 86400000)
  if (days <= 0)  return 'current'
  if (days <= 30) return '1–30'
  if (days <= 60) return '31–60'
  if (days <= 90) return '61–90'
  return '90+'
}

export async function runFinancialReport(tenantId, { date_from, date_to }) {
  const [incomeRes, arRes, apRes, trialRes] = await Promise.all([
    supabase.rpc('get_income_summary', { p_tenant_id: tenantId, p_date_from: date_from, p_date_to: date_to }),
    supabase.from('invoices')
      .select('invoice_number, invoice_date, due_date, total_amount, paid_amount, status, customer:customer_id(name)')
      .eq('tenant_id', tenantId)
      .in('status', ['draft', 'sent', 'overdue']),
    supabase.from('bills')
      .select('bill_number, bill_date, due_date, total_amount, paid_amount, status, vendor:vendor_id(name)')
      .eq('tenant_id', tenantId)
      .in('status', ['draft', 'posted']),
    supabase.rpc('get_trial_balance', { p_tenant_id: tenantId, p_date_from: date_from, p_date_to: date_to }),
  ])

  if (incomeRes.error) throw incomeRes.error
  if (arRes.error)     throw arRes.error
  if (apRes.error)     throw apRes.error
  if (trialRes.error)  throw trialRes.error

  return {
    incomeData: incomeRes.data || [],
    arData:     (arRes.data || []).map(r => ({ ...r, bucket: ageBucket(r.due_date) })),
    apData:     (apRes.data || []).map(r => ({ ...r, bucket: ageBucket(r.due_date) })),
    trialData:  trialRes.data || [],
  }
}
