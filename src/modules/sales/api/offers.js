import { supabase } from '@shared/api/supabase'
import { PAGE_SIZE_TABLE as PAGE_SIZE } from '@shared/lib/constants'

export const today = () => new Date().toISOString().split('T')[0]

export function getEffectiveStatus(offer) {
  const now = today()
  if (!offer.is_active) return 'inactive'
  if (offer.end_date && offer.end_date < now) return 'expired'
  if (offer.start_date && offer.start_date > now) return 'upcoming'
  return 'active'
}

/** Is an offer valid right now? (active window + under usage limit) */
export function offerValidNow(o) {
  const now = today()
  return (!o.start_date || o.start_date <= now) &&
         (!o.end_date   || o.end_date   >= now) &&
         (!o.usage_limit || Number(o.usage_count) < Number(o.usage_limit))
}

/** Does an offer's "applies_to" scope cover this product / order customer? */
export function offerApplies(o, product, customerName) {
  switch (o.applies_to) {
    case 'product':  return !!product && o.applies_to_ref === product.name
    case 'category': return !!product && o.applies_to_ref === product.category
    case 'customer': return !!customerName && o.applies_to_ref === customerName
    default:         return true // 'all'
  }
}

export function discountLabel(o) {
  if (o.offer_type === 'percentage')   return `${Number(o.discount_value)}% off`
  if (o.offer_type === 'fixed_amount') return `$${Number(o.discount_value).toLocaleString()} off`
  if (o.offer_type === 'buy_x_get_y') {
    if (o.buy_product_name || o.get_product_name)
      return `Buy ${Number(o.buy_quantity) || 0} × ${o.buy_product_name || 'item'} → ${Number(o.get_quantity) || 0} × ${o.get_product_name || 'item'} free`
    return `Buy ${Number(o.discount_value)} get ${o.applies_to_ref || '1'} free`
  }
  return '—'
}

export async function fetchOffers(tenantId, { page, search, typeFilter, statusFilter }) {
  if (!tenantId) return { items: [], total: 0 }

  let query = supabase
    .from('offers')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (search.trim()) {
    query = query.or(`name.ilike.%${search.trim()}%,coupon_code.ilike.%${search.trim()}%`)
  }
  if (typeFilter !== 'all') {
    query = query.eq('offer_type', typeFilter)
  }

  const { data, count, error } = await query
  if (error) throw error

  // Client-side status filter (requires date comparison logic)
  let filtered = data || []
  if (statusFilter !== 'all') {
    filtered = filtered.filter(o => getEffectiveStatus(o) === statusFilter)
  }

  return {
    items: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    total: statusFilter === 'all' ? (count || 0) : filtered.length,
  }
}

export async function fetchOfferStats(tenantId) {
  const { data } = await supabase
    .from('offers')
    .select('is_active, coupon_code, end_date, usage_count')
    .eq('tenant_id', tenantId)
  if (!data) return { active: 0, withCoupon: 0, expiringSoon: 0, totalRedeemed: 0 }

  const now  = today()
  const soon = new Date()
  soon.setDate(soon.getDate() + 7)
  const soonStr = soon.toISOString().split('T')[0]

  return {
    active:        data.filter(o => getEffectiveStatus(o) === 'active').length,
    withCoupon:    data.filter(o => o.coupon_code).length,
    expiringSoon:  data.filter(o => o.is_active && o.end_date && o.end_date >= now && o.end_date <= soonStr).length,
    totalRedeemed: data.reduce((a, o) => a + (Number(o.usage_count) || 0), 0),
  }
}

/** Offers usable on an order line (percentage/fixed only — buy_x_get_y is applied automatically as gift lines). */
export async function fetchLineOffers(tenantId) {
  const { data } = await supabase
    .from('offers')
    .select('id, name, offer_type, discount_value, minimum_amount, usage_count, usage_limit, start_date, end_date, applies_to, applies_to_ref')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .in('offer_type', ['percentage', 'fixed_amount'])
  return (data || []).filter(offerValidNow)
}

export async function saveOffer(tenantId, offer, data) {
  const isBxgy = data.offer_type === 'buy_x_get_y'
  const payload = {
    tenant_id:      tenantId,
    name:           data.name,
    description:    data.description   || null,
    offer_type:     data.offer_type,
    discount_value: isBxgy ? 0 : data.discount_value,
    coupon_code:    data.coupon_code   ? data.coupon_code.toUpperCase() : null,
    minimum_amount: data.minimum_amount || 0,
    applies_to:     isBxgy ? 'all' : data.applies_to,
    applies_to_ref: (!isBxgy && data.applies_to !== 'all') ? (data.applies_to_ref || null) : null,
    buy_product_name: isBxgy ? (data.buy_product || null) : null,
    buy_quantity:     isBxgy ? (Number(data.buy_qty) || 0) : null,
    get_product_name: isBxgy ? (data.get_product || null) : null,
    get_quantity:     isBxgy ? (Number(data.get_qty) || 0) : null,
    start_date:     data.start_date   || null,
    end_date:       data.end_date     || null,
    usage_limit:    data.usage_limit  || null,
    is_active:      data.is_active,
  }

  if (offer) {
    const { error } = await supabase.from('offers').update(payload).eq('id', offer.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('offers').insert({ ...payload, usage_count: 0 })
    if (error) throw error
  }
}

export async function deleteOffer(id) {
  const { error } = await supabase.from('offers').delete().eq('id', id)
  if (error) throw error
}

export async function toggleOfferActive(offer) {
  const { error } = await supabase
    .from('offers')
    .update({ is_active: !offer.is_active })
    .eq('id', offer.id)
  if (error) throw error
}
