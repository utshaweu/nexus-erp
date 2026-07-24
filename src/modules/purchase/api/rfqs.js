import { supabase } from '@shared/api/supabase'
import { PAGE_SIZE_TABLE as PAGE_SIZE } from '@shared/lib/constants'

export async function fetchRFQs(tenantId, { page, search, filter }) {
  if (!tenantId) return { items: [], total: 0 }

  let query = supabase
    .from('rfqs')
    .select('id, rfq_number, status, deadline, quoted_amount, created_at, vendor:vendors(name)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (filter !== 'all') query = query.eq('status', filter)
  if (search.trim()) query = query.ilike('rfq_number', `%${search.trim()}%`)

  const { data, count, error } = await query
  if (error) throw error
  return { items: data || [], total: count || 0 }
}

export async function createRFQ(tenantId, data) {
  // Generate a unique RFQ number client-side (server-side sequence not defined in migration)
  const year   = new Date().getFullYear()
  const suffix = String(Date.now()).slice(-5)
  const rfq_number = `RFQ-${year}-${suffix}`

  const { error } = await supabase.from('rfqs').insert({
    tenant_id:  tenantId,
    rfq_number,
    vendor_id:  data.vendor_id,
    deadline:   data.deadline,
    notes:      data.notes || null,
    status:     'draft',
  })
  if (error) throw error
}

export async function sendRFQ(id) {
  const { error } = await supabase.from('rfqs').update({ status: 'sent' }).eq('id', id)
  if (error) throw error
}

export async function deleteRFQ(id) {
  const { error } = await supabase.from('rfqs').delete().eq('id', id)
  if (error) throw error
}

export async function fetchRFQDetail(id, tenantId) {
  const [rfqRes, linesRes] = await Promise.all([
    supabase
      .from('rfqs')
      .select('*, vendor:vendors(name, email, phone, contact_name)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single(),
    supabase
      .from('rfq_lines')
      .select('*')
      .eq('rfq_id', id)
      .eq('tenant_id', tenantId)
      .order('created_at'),
  ])
  if (rfqRes.error) throw new Error('RFQ not found.')
  return { rfq: rfqRes.data, lines: linesRes.data || [] }
}

export async function saveRFQLine(tenantId, rfqId, line, data) {
  const qty = Number(data.quantity)
  if (line) {
    const { error } = await supabase
      .from('rfq_lines')
      .update({ product_name: data.product_name, quantity: qty })
      .eq('id', line.id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('rfq_lines')
      .insert({ tenant_id: tenantId, rfq_id: rfqId, product_name: data.product_name, quantity: qty })
    if (error) throw error
  }
}

export async function deleteRFQLine(lineId) {
  const { error } = await supabase.from('rfq_lines').delete().eq('id', lineId)
  if (error) throw error
}

export async function updateRFQStatus(id, status) {
  const { error } = await supabase.from('rfqs').update({ status }).eq('id', id)
  if (error) throw error
}

/** Converts an RFQ to a new draft Purchase Order: copies line items (pulling cost prices from
 * inventory for unit price), syncs the new order's totals, and marks the RFQ as converted. */
export async function convertRfqToPurchaseOrder(tenantId, rfq, lines) {
  const { data: orderNumber, error: rpcErr } = await supabase.rpc('generate_po_number')
  if (rpcErr) throw new Error('Failed to generate PO number.')

  const today = new Date().toISOString().slice(0, 10)
  const { data: po, error: poErr } = await supabase
    .from('purchase_orders')
    .insert({
      tenant_id:    tenantId,
      order_number: orderNumber,
      vendor_id:    rfq.vendor_id,
      reference:    rfq.rfq_number,
      order_date:   today,
      status:       'draft',
      notes:        rfq.notes || null,
    })
    .select('id')
    .single()
  if (poErr) throw poErr

  if (lines.length > 0) {
    const { data: prods } = await supabase
      .from('products')
      .select('name, cost_price')
      .eq('tenant_id', tenantId)
      .in('name', lines.map(l => l.product_name))
    const priceByName = new Map((prods || []).map(p => [p.name, Number(p.cost_price) || 0]))

    const poLines = lines.map(l => {
      const qty   = Number(l.quantity)
      const price = priceByName.get(l.product_name) || 0
      return {
        tenant_id:         tenantId,
        purchase_order_id: po.id,
        product_name:      l.product_name,
        quantity:          qty,
        unit_price:        price,
        tax_rate:          0,
        total_price:       qty * price,
      }
    })
    const { error: linesErr } = await supabase.from('purchase_order_lines').insert(poLines)
    if (linesErr) throw linesErr

    const subtotal = poLines.reduce((a, l) => a + l.total_price, 0)
    await supabase
      .from('purchase_orders')
      .update({ subtotal, tax_amount: 0, total_amount: subtotal })
      .eq('id', po.id)
  }

  await supabase.from('rfqs').update({ status: 'converted' }).eq('id', rfq.id)
  return { orderNumber, poId: po.id }
}
