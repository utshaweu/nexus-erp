import { supabase } from '@shared/api/supabase'
import { PAGE_SIZE_TABLE as PAGE_SIZE } from '@shared/lib/constants'

export async function fetchStockMoves(tenantId, { page, filter }) {
  if (!tenantId) return { items: [], total: 0 }

  let query = supabase
    .from('stock_moves')
    .select(`
      *,
      product:products(name, sku),
      source_warehouse:warehouses!source_warehouse_id(name, code),
      dest_warehouse:warehouses!dest_warehouse_id(name, code)
    `, { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('move_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (filter !== 'all') query = query.eq('move_type', filter)

  const { data, count, error } = await query
  if (error) throw error
  return { items: data || [], total: count || 0 }
}

/** id/name/sku only — feeds the product picker on the stock move form. */
export async function fetchActiveProductOptions(tenantId) {
  if (!tenantId) return []
  const { data } = await supabase
    .from('products')
    .select('id, name, sku')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('name')
  return data || []
}

export async function createStockMove(tenantId, data) {
  const { data: moveNum, error: rpcErr } = await supabase.rpc('generate_stock_number')
  if (rpcErr) throw new Error('Failed to generate move number.')

  const { error } = await supabase.from('stock_moves').insert({
    tenant_id:           tenantId,
    move_number:         moveNum,
    product_id:          data.product_id,
    move_type:           data.move_type,
    quantity:            data.quantity,
    source_warehouse_id: data.source_warehouse_id || null,
    dest_warehouse_id:   data.dest_warehouse_id   || null,
    reference:           data.reference           || null,
    move_date:           data.move_date,
  })
  if (error) throw error
}
