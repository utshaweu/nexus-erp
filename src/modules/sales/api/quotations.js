import { supabase } from '@shared/api/supabase'
import { PAGE_SIZE_TABLE as PAGE_SIZE } from '@shared/lib/constants'

/** Quotation lines only support a percentage discount (no fixed-amount option, unlike Sales Order lines). */
export function lineMath({ quantity, unit_price, discount_pct, tax_rate }) {
  const base = (Number(quantity) || 0) * (Number(unit_price) || 0)
  const net  = base * (1 - (Number(discount_pct) || 0) / 100)
  const tax  = net * ((Number(tax_rate) || 0) / 100)
  return { base, discount: base - net, net, tax, total: net + tax }
}

export async function fetchQuotations(tenantId, { page, search, filter }) {
  if (!tenantId) return { items: [], total: 0 }

  let customerIds = []
  if (search.trim()) {
    const { data: cRows } = await supabase
      .from('customers')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('name', `%${search.trim()}%`)
    customerIds = (cRows || []).map(c => c.id)
  }

  let query = supabase
    .from('quotations')
    .select(
      'id, quotation_number, status, quotation_date, expiry_date, total_amount, customer:customers(name)',
      { count: 'exact' },
    )
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (filter !== 'all') query = query.eq('status', filter)

  if (search.trim()) {
    const orParts = [`quotation_number.ilike.%${search.trim()}%`]
    if (customerIds.length > 0) {
      orParts.push(`customer_id.in.(${customerIds.join(',')})`)
    }
    query = query.or(orParts.join(','))
  }

  const { data, count, error } = await query
  if (error) throw error
  return { items: data || [], total: count || 0 }
}

export async function createQuotation(tenantId, data) {
  const year             = new Date().getFullYear()
  const suffix           = String(Date.now()).slice(-5)
  const quotation_number = `Q-${year}-${suffix}`

  const { error } = await supabase.from('quotations').insert({
    tenant_id:       tenantId,
    quotation_number,
    customer_id:     data.customer_id,
    quotation_date:  data.quotation_date,
    expiry_date:     data.expiry_date || null,
    notes:           data.notes       || null,
    status:          'draft',
  })
  if (error) throw error
}

export async function sendQuotation(id) {
  const { error } = await supabase.from('quotations').update({ status: 'sent' }).eq('id', id)
  if (error) throw error
}

export async function acceptQuotation(id) {
  const { error } = await supabase.from('quotations').update({ status: 'accepted' }).eq('id', id)
  if (error) throw error
}

export async function deleteQuotation(id) {
  const { error } = await supabase.from('quotations').delete().eq('id', id)
  if (error) throw error
}

export async function fetchQuotationDetail(id, tenantId) {
  const [qRes, linesRes] = await Promise.all([
    supabase
      .from('quotations')
      .select('*, customer:customers(name, email, phone, contact_name)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single(),
    supabase
      .from('quotation_lines')
      .select('*')
      .eq('quotation_id', id)
      .eq('tenant_id', tenantId)
      .order('id'),
  ])
  if (qRes.error) throw qRes.error
  return { quote: qRes.data, lines: linesRes.data || [] }
}

async function syncQuotationTotals(id, tenantId) {
  const { data: fresh } = await supabase
    .from('quotation_lines')
    .select('quantity, unit_price, discount_pct, tax_rate')
    .eq('quotation_id', id)
    .eq('tenant_id', tenantId)
  const all      = fresh || []
  const subtotal = all.reduce((a, l) => a + lineMath(l).net, 0)
  const taxAmt   = all.reduce((a, l) => a + lineMath(l).tax, 0)
  await supabase
    .from('quotations')
    .update({ subtotal, tax_amount: taxAmt, total_amount: subtotal + taxAmt })
    .eq('id', id)
}

export async function saveQuotationLine(quotationId, tenantId, line, data) {
  const q = Number(data.quantity)
  const p = Number(data.unit_price)
  const d = Number(data.discount_pct) || 0
  const t = Number(data.tax_rate) || 0
  const { total } = lineMath({ quantity: q, unit_price: p, discount_pct: d, tax_rate: t })

  if (line) {
    const { error } = await supabase
      .from('quotation_lines')
      .update({ product_name: data.product_name, quantity: q, unit_price: p, discount_pct: d, tax_rate: t, total_price: total })
      .eq('id', line.id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('quotation_lines')
      .insert({ tenant_id: tenantId, quotation_id: quotationId, product_name: data.product_name, quantity: q, unit_price: p, discount_pct: d, tax_rate: t, total_price: total })
    if (error) throw error
  }
  await syncQuotationTotals(quotationId, tenantId)
}

export async function deleteQuotationLine(lineId, quotationId, tenantId) {
  const { error } = await supabase.from('quotation_lines').delete().eq('id', lineId)
  if (error) throw error
  await syncQuotationTotals(quotationId, tenantId)
}

export async function updateQuotationStatus(id, status) {
  const { error } = await supabase.from('quotations').update({ status }).eq('id', id)
  if (error) throw error
}

/** Convert an accepted quotation → new draft Sales Order, copying line items. */
export async function convertQuotationToSalesOrder(tenantId, quote, lines) {
  const { data: orderNumber, error: rpcErr } = await supabase.rpc('generate_so_number')
  if (rpcErr) throw new Error('Failed to generate order number.')

  const orderToday = new Date().toISOString().slice(0, 10)
  const { data: so, error: soErr } = await supabase
    .from('sales_orders')
    .insert({
      tenant_id:     tenantId,
      order_number:  orderNumber,
      customer_id:   quote.customer_id,
      order_date:    orderToday,
      delivery_date: quote.expiry_date || null,
      status:        'draft',
      notes:         quote.notes || null,
      subtotal:      Number(quote.subtotal) || 0,
      tax_amount:    Number(quote.tax_amount) || 0,
      total_amount:  Number(quote.total_amount) || 0,
    })
    .select('id')
    .single()
  if (soErr) throw soErr

  if (lines.length > 0) {
    const soLines = lines.map(l => ({
      tenant_id:       tenantId,
      sales_order_id:  so.id,
      product_name:    l.product_name,
      quantity:        Number(l.quantity),
      unit_price:      Number(l.unit_price),
      discount_pct:    Number(l.discount_pct) || 0,
      discount_amount: 0,
      tax_rate:        Number(l.tax_rate) || 0,
      total_price:     Number(l.total_price) || 0,
    }))
    const { error: linesErr } = await supabase.from('sales_order_lines').insert(soLines)
    if (linesErr) throw linesErr
  }

  return { orderNumber, orderId: so.id }
}
