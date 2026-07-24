import { supabase } from '@shared/api/supabase'
import { PAGE_SIZE_TABLE as PAGE_SIZE } from '@shared/lib/constants'
import { submitForApproval } from '@shared/lib/approvalWorkflow'

export async function fetchPurchaseOrders(tenantId, { page, search, filter }) {
  if (!tenantId) return { items: [], total: 0 }

  // Resolve vendor IDs matching the search term so we can OR-filter
  let vendorIds = []
  if (search.trim()) {
    const { data: vRows } = await supabase
      .from('vendors')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('name', `%${search.trim()}%`)
    vendorIds = (vRows || []).map(v => v.id)
  }

  let query = supabase
    .from('purchase_orders')
    .select('id, order_number, status, order_date, total_amount, reference, vendor:vendors(name)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (filter !== 'all') query = query.eq('status', filter)

  if (search.trim()) {
    const orParts = [`order_number.ilike.%${search.trim()}%`]
    if (vendorIds.length > 0) orParts.push(`vendor_id.in.(${vendorIds.join(',')})`)
    query = query.or(orParts.join(','))
  }

  const { data, count, error } = await query
  if (error) throw error
  return { items: data || [], total: count || 0 }
}

export async function createPurchaseOrder(tenantId, data) {
  const { data: orderNumber, error: rpcErr } = await supabase.rpc('generate_po_number')
  if (rpcErr) throw new Error('Failed to generate order number.')

  const { error } = await supabase.from('purchase_orders').insert({
    tenant_id:     tenantId,
    order_number:  orderNumber,
    vendor_id:     data.vendor_id,
    reference:     data.reference,
    order_date:    data.order_date,
    expected_date: data.expected_date || null,
    notes:         data.notes         || null,
    status:        'draft',
  })
  if (error) throw error
}

export async function approvePurchaseOrder(id) {
  const { error } = await supabase.from('purchase_orders').update({ status: 'approved' }).eq('id', id)
  if (error) throw error
}

export async function deletePurchaseOrder(id) {
  const { error } = await supabase.from('purchase_orders').delete().eq('id', id)
  if (error) throw error
}

export async function fetchPurchaseOrderDetail(id, tenantId) {
  const [orderRes, linesRes] = await Promise.all([
    supabase
      .from('purchase_orders')
      .select('*, vendor:vendors(name, email, phone, contact_name)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single(),
    supabase
      .from('purchase_order_lines')
      .select('*')
      .eq('purchase_order_id', id)
      .eq('tenant_id', tenantId)
      .order('id'),
  ])
  if (orderRes.error) throw new Error('Order not found.')
  return { order: orderRes.data, lines: linesRes.data || [] }
}

async function syncPOTotals(id, tenantId) {
  const { data: fresh } = await supabase
    .from('purchase_order_lines')
    .select('quantity, unit_price, tax_rate')
    .eq('purchase_order_id', id)
    .eq('tenant_id', tenantId)
  const all      = fresh || []
  const subtotal = all.reduce((a, l) => a + Number(l.quantity) * Number(l.unit_price), 0)
  const taxAmt   = all.reduce((a, l) => a + Number(l.quantity) * Number(l.unit_price) * ((Number(l.tax_rate) || 0) / 100), 0)
  await supabase
    .from('purchase_orders')
    .update({ subtotal, tax_amount: taxAmt, total_amount: subtotal + taxAmt })
    .eq('id', id)
}

export async function savePOLine(tenantId, orderId, line, data) {
  const qty   = Number(data.quantity)
  const price = Number(data.unit_price)
  const tax   = Number(data.tax_rate) || 0
  const total = qty * price + qty * price * tax / 100

  if (line) {
    const { error } = await supabase
      .from('purchase_order_lines')
      .update({ product_name: data.product_name, quantity: qty, unit_price: price, tax_rate: tax, total_price: total })
      .eq('id', line.id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('purchase_order_lines')
      .insert({ tenant_id: tenantId, purchase_order_id: orderId, product_name: data.product_name, quantity: qty, unit_price: price, tax_rate: tax, total_price: total })
    if (error) throw error
  }
  await syncPOTotals(orderId, tenantId)
}

export async function deletePOLine(lineId, orderId, tenantId) {
  const { error } = await supabase.from('purchase_order_lines').delete().eq('id', lineId)
  if (error) throw error
  await syncPOTotals(orderId, tenantId)
}

export async function updatePOStatus(id, status) {
  const { error } = await supabase.from('purchase_orders').update({ status }).eq('id', id)
  if (error) throw error
}

/** Submits the order for approval (or falls back to a plain "pending" status if no workflow is active). */
export async function submitPOForApproval(tenantId, order, lines, total, userId) {
  const result = await submitForApproval({
    tenantId, module: 'purchase', recordId: order.id, recordType: 'purchase_order',
    title: `Purchase Order ${order.order_number}`,
    description: `Vendor: ${order.vendor?.name || '—'} · ${lines.length} line item(s)`,
    amount: total, priority: total > 5000 ? 'high' : 'normal',
    requestedBy: userId,
  })
  await updatePOStatus(order.id, 'pending')
  return result
}
