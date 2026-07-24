import { supabase } from '@shared/api/supabase'
import { PAGE_SIZE_GRID as PAGE_SIZE } from '@shared/lib/constants'

export async function fetchVendors(tenantId, { page, search, filter }) {
  if (!tenantId) return { items: [], total: 0 }

  let query = supabase
    .from('vendors')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('name')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (filter !== 'all') query = query.eq('status', filter)
  if (search.trim()) {
    query = query.or(`name.ilike.%${search.trim()}%,contact_name.ilike.%${search.trim()}%,category.ilike.%${search.trim()}%`)
  }

  const { data, count, error } = await query
  if (error) throw error
  return { items: data || [], total: count || 0 }
}

/** id/name only — feeds the vendor picker on the RFQ and Purchase Order creation forms. */
export async function fetchActiveVendorOptions(tenantId) {
  if (!tenantId) return []
  const { data } = await supabase
    .from('vendors')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('name')
  return data || []
}

export async function saveVendor(tenantId, vendor, data) {
  const payload = {
    name:         data.name,
    contact_name: data.contact_name || null,
    email:        data.email        || null,
    phone:        data.phone        || null,
    country:      data.country      || null,
    address:      data.address      || null,
    category:     data.category,
    status:       data.status,
  }
  if (vendor) {
    const { error } = await supabase
      .from('vendors')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', vendor.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('vendors').insert({ ...payload, tenant_id: tenantId })
    if (error) throw error
  }
}

export async function deleteVendor(vendor) {
  const { error } = await supabase.from('vendors').delete().eq('id', vendor.id)
  if (error) throw error
}
