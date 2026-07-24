import { supabase } from '@shared/api/supabase'

export async function fetchInventoryDashboard(tenantId) {
  const [prodRes, whRes, moveRes, lvlRes] = await Promise.all([
    supabase
      .from('products')
      .select('id, category', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('status', 'active'),
    supabase
      .from('warehouses')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('status', 'active'),
    supabase
      .from('stock_moves')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenantId),
    supabase
      .from('inventory_levels')
      .select('product_id, product_name, sku, warehouse_name, qty_on_hand')
      .eq('tenant_id', tenantId),
  ])

  const stats = {
    products:   prodRes.count || 0,
    warehouses: whRes.count   || 0,
    moves:      moveRes.count || 0,
  }

  let catData = []
  if (!prodRes.error && prodRes.data) {
    const catMap = {}
    prodRes.data.forEach(p => { catMap[p.category || 'Other'] = (catMap[p.category || 'Other'] || 0) + 1 })
    catData = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, qty]) => ({ cat, qty }))
  }

  let lowStock = []
  if (!lvlRes.error && lvlRes.data) {
    const { data: reorderData } = await supabase
      .from('products')
      .select('id, reorder_qty')
      .eq('tenant_id', tenantId)
      .gt('reorder_qty', 0)

    const reorderMap = {}
    ;(reorderData || []).forEach(p => { reorderMap[p.id] = Number(p.reorder_qty) })

    lowStock = lvlRes.data
      .filter(l => {
        const threshold = reorderMap[l.product_id]
        return threshold !== undefined && Number(l.qty_on_hand) <= threshold
      })
      .slice(0, 6)
  }

  return { stats, catData, lowStock }
}
