import { supabase } from '@shared/api/supabase'
import { PAGE_SIZE_TABLE as PAGE_SIZE } from '@shared/lib/constants'
import { submitForApproval, findActiveWorkflow } from '@shared/lib/approvalWorkflow'
import { offerValidNow, today } from './offers'

/** Sales Order line discount is either a % of base OR a fixed $ amount (the other is 0) — unlike Quotation lines. */
export function lineMath({ quantity, unit_price, discount_pct, discount_amount, tax_rate }) {
  const base     = (Number(quantity) || 0) * (Number(unit_price) || 0)
  const pct      = (Number(discount_pct) || 0) / 100
  const fixed    = Number(discount_amount) || 0
  const discount = Math.min(base, base * pct + fixed)
  const net      = base - discount
  const tax      = net * ((Number(tax_rate) || 0) / 100)
  return { base, discount, net, tax, total: net + tax }
}

export async function fetchSalesOrders(tenantId, { page, search, filter }) {
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
    .from('sales_orders')
    .select(
      'id, order_number, reference, status, order_date, total_amount, delivery_date, customer:customers(name)',
      { count: 'exact' },
    )
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (filter !== 'all') query = query.eq('status', filter)

  if (search.trim()) {
    const orParts = [
      `order_number.ilike.%${search.trim()}%`,
      `reference.ilike.%${search.trim()}%`,
    ]
    if (customerIds.length > 0) {
      orParts.push(`customer_id.in.(${customerIds.join(',')})`)
    }
    query = query.or(orParts.join(','))
  }

  const { data, count, error } = await query
  if (error) throw error
  return { items: data || [], total: count || 0 }
}

export async function createSalesOrder(tenantId, data) {
  const { data: orderNumber, error: rpcErr } = await supabase.rpc('generate_so_number')
  if (rpcErr) throw new Error('Failed to generate order number.')

  const { error } = await supabase.from('sales_orders').insert({
    tenant_id:     tenantId,
    order_number:  orderNumber,
    customer_id:   data.customer_id,
    reference:     data.reference || null,
    order_date:    data.order_date,
    delivery_date: data.delivery_date || null,
    notes:         data.notes         || null,
    status:        'draft',
  })
  if (error) throw error
}

export async function confirmSalesOrder(id) {
  const { error } = await supabase.from('sales_orders').update({ status: 'confirmed' }).eq('id', id)
  if (error) throw error
}

export async function deleteSalesOrder(id) {
  const { error } = await supabase.from('sales_orders').delete().eq('id', id)
  if (error) throw error
}

export async function fetchSalesOrderDetail(id, tenantId) {
  const [orderRes, linesRes] = await Promise.all([
    supabase
      .from('sales_orders')
      .select('*, customer:customers(name, email, phone, contact_name)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single(),
    supabase
      .from('sales_order_lines')
      .select('*')
      .eq('sales_order_id', id)
      .eq('tenant_id', tenantId)
      .order('id'),
  ])
  if (orderRes.error) throw orderRes.error
  return { order: orderRes.data, lines: linesRes.data || [] }
}

export async function updateOrderStatus(id, status) {
  const { error } = await supabase.from('sales_orders').update({ status }).eq('id', id)
  if (error) throw error
}

export async function fetchApprovalState(tenantId, orderId) {
  const [activeWorkflow, { data: pending }] = await Promise.all([
    findActiveWorkflow(tenantId, 'sales'),
    supabase
      .from('approval_requests')
      .select('id, request_number, status')
      .eq('tenant_id', tenantId).eq('module', 'sales')
      .eq('record_type', 'sales_order').eq('record_id', orderId)
      .eq('status', 'pending').maybeSingle(),
  ])
  return { activeWorkflow, pendingRequest: pending || null }
}

export async function submitSOForApproval(tenantId, order, lines, total, userId) {
  const result = await submitForApproval({
    tenantId, module: 'sales', recordId: order.id, recordType: 'sales_order',
    title: `Sales Order ${order.order_number}`,
    description: `Customer: ${order.customer?.name || '—'} · ${lines.length} line item(s)`,
    amount: total, priority: total > 5000 ? 'high' : 'normal',
    requestedBy: userId,
  })
  return result
}

/** Save (create/update) an order line, redeeming an applied offer's usage on new lines only. */
export async function saveOrderLine(orderId, tenantId, line, data, redeemOfferId) {
  const q = Number(data.quantity)
  const p = Number(data.unit_price)
  const fixedSel        = data.discount_type === 'fixed'
  const discount_pct    = fixedSel ? 0 : (Number(data.discount_value) || 0)
  const discount_amount = fixedSel ? (Number(data.discount_value) || 0) : 0
  const tax             = Number(data.tax_rate) || 0
  const { total } = lineMath({ quantity: q, unit_price: p, discount_pct, discount_amount, tax_rate: tax })

  if (line) {
    const { error } = await supabase
      .from('sales_order_lines')
      .update({ product_name: data.product_name, quantity: q, unit_price: p, discount_pct, discount_amount, tax_rate: tax, total_price: total })
      .eq('id', line.id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('sales_order_lines')
      .insert({ tenant_id: tenantId, sales_order_id: orderId, product_name: data.product_name, quantity: q, unit_price: p, discount_pct, discount_amount, tax_rate: tax, total_price: total })
    if (error) throw error

    if (redeemOfferId) {
      const { data: offer } = await supabase.from('offers').select('usage_count').eq('id', redeemOfferId).single()
      if (offer) {
        await supabase.from('offers').update({ usage_count: (Number(offer.usage_count) || 0) + 1 }).eq('id', redeemOfferId)
      }
    }
  }

  await reconcileGifts(tenantId, orderId)
  await syncTotals(tenantId, orderId)
}

export async function deleteOrderLine(lineId, tenantId, orderId) {
  const { error } = await supabase.from('sales_order_lines').delete().eq('id', lineId)
  if (error) throw error
  await reconcileGifts(tenantId, orderId)
  await syncTotals(tenantId, orderId)
}

/** Buy X Get Y: recompute the auto-added free ("gift") lines from the current normal lines. */
export async function reconcileGifts(tenantId, orderId) {
  const now = today()
  const [{ data: bxgyRows }, { data: freshLines }] = await Promise.all([
    supabase
      .from('offers')
      .select('buy_product_name, buy_quantity, get_product_name, get_quantity, start_date, end_date')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .eq('offer_type', 'buy_x_get_y'),
    supabase
      .from('sales_order_lines')
      .select('*')
      .eq('sales_order_id', orderId)
      .eq('tenant_id', tenantId),
  ])
  const bxgy = (bxgyRows || []).filter(o =>
    o.buy_product_name && o.get_product_name &&
    Number(o.buy_quantity) > 0 && Number(o.get_quantity) > 0 &&
    (!o.start_date || o.start_date <= now) &&
    (!o.end_date   || o.end_date   >= now)
  )
  const all    = freshLines || []
  const normal = all.filter(l => !l.is_gift)
  const gifts  = all.filter(l => l.is_gift)

  // Desired free quantity per get-product (summed across matching offers)
  const desired = {}
  for (const o of bxgy) {
    const bought = normal
      .filter(l => (l.product_name || '').toLowerCase() === o.buy_product_name.toLowerCase())
      .reduce((a, l) => a + Number(l.quantity), 0)
    const free = Math.floor(bought / Number(o.buy_quantity)) * Number(o.get_quantity)
    if (free > 0) desired[o.get_product_name] = (desired[o.get_product_name] || 0) + free
  }

  const ops = []
  for (const [name, qty] of Object.entries(desired)) {
    const existing = gifts.find(g => g.product_name === name)
    if (existing) {
      if (Number(existing.quantity) !== qty) {
        ops.push(supabase.from('sales_order_lines').update({ quantity: qty }).eq('id', existing.id))
      }
    } else {
      ops.push(supabase.from('sales_order_lines').insert({
        tenant_id: tenantId, sales_order_id: orderId, product_name: name,
        quantity: qty, unit_price: 0, discount_pct: 0, discount_amount: 0,
        tax_rate: 0, total_price: 0, is_gift: true,
      }))
    }
  }
  for (const g of gifts) {
    if (!desired[g.product_name]) ops.push(supabase.from('sales_order_lines').delete().eq('id', g.id))
  }
  if (ops.length) await Promise.all(ops)
}

/**
 * Recompute subtotal/tax/total from the current lines, and re-evaluate an applied
 * coupon against the new subtotal — dropping + releasing it if it no longer qualifies.
 * We intentionally skip the usage_limit check here: this order already consumed its
 * redemption at apply time, so re-counting it would evict the coupon from its own order.
 */
export async function syncTotals(tenantId, orderId) {
  const { data: fresh } = await supabase
    .from('sales_order_lines')
    .select('quantity, unit_price, discount_pct, discount_amount, tax_rate')
    .eq('sales_order_id', orderId)
    .eq('tenant_id', tenantId)
  const all      = fresh || []
  const subtotal = all.reduce((a, l) => a + lineMath(l).net, 0)
  const taxAmt   = all.reduce((a, l) => a + lineMath(l).tax, 0)

  const { data: ord } = await supabase
    .from('sales_orders').select('coupon_code').eq('id', orderId).single()
  let couponCode     = ord?.coupon_code || null
  let couponDiscount = 0
  if (couponCode) {
    const { data: off } = await supabase
      .from('offers').select('*')
      .eq('tenant_id', tenantId).ilike('coupon_code', couponCode)
      .eq('is_active', true).maybeSingle()
    const now    = today()
    const dateOk = off && (!off.start_date || off.start_date <= now) && (!off.end_date || off.end_date >= now)
    if (off && dateOk &&
        ['percentage', 'fixed_amount'].includes(off.offer_type) &&
        subtotal >= Number(off.minimum_amount || 0)) {
      couponDiscount = off.offer_type === 'percentage'
        ? subtotal * Number(off.discount_value) / 100
        : Math.min(subtotal, Number(off.discount_value))
    } else {
      if (off) {
        await supabase.from('offers')
          .update({ usage_count: Math.max(0, (Number(off.usage_count) || 0) - 1) })
          .eq('id', off.id)
      }
      couponCode = null
    }
  }

  await supabase
    .from('sales_orders')
    .update({
      subtotal, tax_amount: taxAmt,
      total_amount: Math.max(0, subtotal + taxAmt - couponDiscount),
      coupon_code: couponCode, coupon_discount: couponDiscount,
    })
    .eq('id', orderId)
}

/** Release one redemption of a coupon back to its offer (counterpart to the +1 in applyCoupon). */
async function releaseCouponUsage(tenantId, code) {
  if (!code) return
  const { data: off } = await supabase
    .from('offers').select('id, usage_count')
    .eq('tenant_id', tenantId).ilike('coupon_code', code).maybeSingle()
  if (off) {
    await supabase.from('offers')
      .update({ usage_count: Math.max(0, (Number(off.usage_count) || 0) - 1) })
      .eq('id', off.id)
  }
}

export async function applyCoupon(tenantId, orderId, code, lines) {
  const subtotalNow = lines.reduce((a, l) => a + lineMath(l).net, 0)
  const taxNow      = lines.reduce((a, l) => a + lineMath(l).tax, 0)

  const { data: off } = await supabase
    .from('offers').select('*')
    .eq('tenant_id', tenantId).ilike('coupon_code', code)
    .eq('is_active', true).maybeSingle()
  if (!off)                             throw new Error('Invalid or inactive coupon.')
  if (!offerValidNow(off))              throw new Error('This coupon is expired or fully redeemed.')
  if (off.offer_type === 'buy_x_get_y') throw new Error('This is a Buy-X-Get-Y offer, not a coupon discount.')
  if (subtotalNow < Number(off.minimum_amount || 0)) {
    throw new Error(`Order subtotal must be at least $${Number(off.minimum_amount).toLocaleString()} for this coupon.`)
  }
  const discount = off.offer_type === 'percentage'
    ? subtotalNow * Number(off.discount_value) / 100
    : Math.min(subtotalNow, Number(off.discount_value))

  await supabase.from('offers')
    .update({ usage_count: (Number(off.usage_count) || 0) + 1 }).eq('id', off.id)
  const { error } = await supabase.from('sales_orders')
    .update({ coupon_code: off.coupon_code, coupon_discount: discount, total_amount: Math.max(0, subtotalNow + taxNow - discount) })
    .eq('id', orderId)
  if (error) throw error
}

export async function removeCoupon(tenantId, orderId, order, lines) {
  const subtotalNow = lines.reduce((a, l) => a + lineMath(l).net, 0)
  const taxNow      = lines.reduce((a, l) => a + lineMath(l).tax, 0)
  const { error } = await supabase.from('sales_orders')
    .update({ coupon_code: null, coupon_discount: 0, total_amount: subtotalNow + taxNow })
    .eq('id', orderId)
  if (error) throw error
  await releaseCouponUsage(tenantId, order.coupon_code)
}
