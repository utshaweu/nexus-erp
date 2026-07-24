import { supabase } from '@shared/api/supabase'
import { PAGE_SIZE_TABLE as PAGE_SIZE } from '@shared/lib/constants'
import { computeLineItemTotals } from './lineItems'

export async function fetchBills(tenantId, { page, search, filter }) {
  if (!tenantId) return { items: [], total: 0 }

  let query = supabase
    .from('bills')
    .select('*, vendor:vendor_id(name)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('bill_date', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (filter !== 'all') query = query.eq('status', filter)
  if (search.trim()) query = query.ilike('bill_number', `%${search.trim()}%`)

  const { data, count, error } = await query
  if (error) throw error
  return { items: data || [], total: count || 0 }
}

/** Draft bills already have a pending approval request → { [record_id]: request }. */
export async function fetchPendingApprovalsForBills(tenantId, billIds) {
  if (!billIds.length) return {}
  const { data } = await supabase
    .from('approval_requests')
    .select('id, request_number, record_id')
    .eq('tenant_id', tenantId).eq('module', 'accounts')
    .eq('record_type', 'bill').eq('status', 'pending')
    .in('record_id', billIds)
  return Object.fromEntries((data || []).map(p => [p.record_id, p]))
}

export async function fetchBillLines(billId) {
  const { data } = await supabase
    .from('bill_lines')
    .select('*')
    .eq('bill_id', billId)
    .order('id')
  return data || []
}

/** Creates or updates a bill header + wholesale-replaces its lines. */
export async function saveBill(tenantId, bill, data) {
  const isEdit = Boolean(bill)
  const { total_amount } = computeLineItemTotals(data.lines)
  const header = {
    vendor_id: data.vendor_id,
    bill_date: data.bill_date,
    due_date:  data.due_date || null,
    status:    data.status,
    total_amount,
  }

  let billId = bill?.id
  if (isEdit) {
    const { error } = await supabase.from('bills').update(header).eq('id', billId)
    if (error) throw error
    await supabase.from('bill_lines').delete().eq('bill_id', billId)
  } else {
    const { data: num, error: numErr } = await supabase.rpc('generate_bill_number')
    if (numErr) throw numErr
    const { data: newBill, error } = await supabase
      .from('bills')
      .insert({ ...header, tenant_id: tenantId, bill_number: num })
      .select('id')
      .single()
    if (error) throw error
    billId = newBill.id
  }

  const lines = data.lines.map(l => ({
    tenant_id: tenantId, bill_id: billId,
    description: l.description, quantity: l.quantity, unit_price: l.unit_price, tax_rate: l.tax_rate,
    total_price: Number(l.quantity) * Number(l.unit_price) * (1 + Number(l.tax_rate) / 100),
  }))
  const { error: lineErr } = await supabase.from('bill_lines').insert(lines)
  if (lineErr) throw lineErr
}

export async function deleteBill(bill) {
  await supabase.from('bill_lines').delete().eq('bill_id', bill.id)
  const { error } = await supabase.from('bills').delete().eq('id', bill.id)
  if (error) throw error
}

export async function fetchActiveVendors(tenantId) {
  if (!tenantId) return []
  const { data } = await supabase
    .from('vendors')
    .select('id, name')
    .eq('tenant_id', tenantId).eq('status', 'active').order('name')
  return data || []
}

export async function fetchActiveProductsForCost(tenantId) {
  if (!tenantId) return []
  const { data } = await supabase
    .from('products')
    .select('id, name, cost_price')
    .eq('tenant_id', tenantId).eq('status', 'active').order('name')
  return data || []
}
