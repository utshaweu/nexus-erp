import { supabase } from '@shared/api/supabase'

export async function fetchWarehouses(tenantId) {
  if (!tenantId) return []
  const { data, error } = await supabase
    .from('warehouses')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name')
  if (error) throw error
  return data || []
}

/** id/name/code only — feeds the warehouse pickers on the stock move form. */
export async function fetchActiveWarehouseOptions(tenantId) {
  if (!tenantId) return []
  const { data } = await supabase
    .from('warehouses')
    .select('id, name, code')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('name')
  return data || []
}

export async function saveWarehouse(tenantId, warehouse, data) {
  const payload = {
    code:         data.code,
    name:         data.name,
    location:     data.location     || null,
    capacity_pct: data.capacity_pct ?? 0,
    status:       data.status,
  }
  if (warehouse) {
    const { error } = await supabase.from('warehouses').update(payload).eq('id', warehouse.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('warehouses').insert({ ...payload, tenant_id: tenantId })
    if (error) throw error
  }
}

export async function deleteWarehouse(warehouse) {
  const { error } = await supabase.from('warehouses').delete().eq('id', warehouse.id)
  if (error) throw error
}
