import { supabase } from '@shared/api/supabase'
import { PAGE_SIZE_GRID as PAGE_SIZE } from '@shared/lib/constants'

export async function fetchCustomers(tenantId, { page, search, filter }) {
  if (!tenantId) return { items: [], total: 0 }

  let query = supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('name')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (filter !== 'all') query = query.eq('status', filter)
  if (search.trim()) {
    query = query.or(
      `name.ilike.%${search.trim()}%,contact_name.ilike.%${search.trim()}%,industry.ilike.%${search.trim()}%`,
    )
  }

  const { data, count, error } = await query
  if (error) throw error
  return { items: data || [], total: count || 0 }
}

/** id/name only — feeds the customer picker on Quotation and Sales Order creation forms. */
export async function fetchActiveCustomerOptions(tenantId) {
  if (!tenantId) return []
  const { data } = await supabase
    .from('customers')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('name')
  return data || []
}

export async function saveCustomer(tenantId, customer, data) {
  const payload = {
    name:         data.name,
    contact_name: data.contact_name || null,
    email:        data.email        || null,
    phone:        data.phone        || null,
    country:      data.country      || null,
    address:      data.address      || null,
    industry:     data.industry     || null,
    status:       data.status,
    credit_limit: data.credit_limit || 0,
  }
  if (customer) {
    const { error } = await supabase
      .from('customers')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', customer.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('customers').insert({ ...payload, tenant_id: tenantId })
    if (error) throw error
  }
}

export async function deleteCustomer(customer) {
  const { error } = await supabase.from('customers').delete().eq('id', customer.id)
  if (error) throw error
}
