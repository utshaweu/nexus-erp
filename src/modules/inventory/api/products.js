import { supabase } from '@shared/api/supabase'
import { PAGE_SIZE_TABLE as PAGE_SIZE } from '@shared/lib/constants'

export async function fetchProducts(tenantId, { page, search, filter }) {
  if (!tenantId) return { items: [], total: 0 }

  let query = supabase
    .from('products')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('name')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (filter !== 'all') query = query.eq('status', filter)
  if (search.trim()) {
    query = query.or(`name.ilike.%${search.trim()}%,sku.ilike.%${search.trim()}%,category.ilike.%${search.trim()}%`)
  }

  const { data, count, error } = await query
  if (error) throw error
  return { items: data || [], total: count || 0 }
}

export async function saveProduct(tenantId, product, data) {
  const payload = {
    name: data.name, sku: data.sku, category: data.category,
    unit_of_measure: data.unit_of_measure,
    cost_price: data.cost_price, sale_price: data.sale_price,
    reorder_qty: data.reorder_qty, status: data.status,
    description: data.description || null,
  }
  if (product) {
    const { error } = await supabase
      .from('products')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', product.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('products').insert({ ...payload, tenant_id: tenantId })
    if (error) throw error
  }
}

export async function deleteProduct(product) {
  const { error } = await supabase.from('products').delete().eq('id', product.id)
  if (error) throw error
}
