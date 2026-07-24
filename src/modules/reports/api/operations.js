import { supabase } from '@shared/api/supabase'

export async function runOperationsReport(tenantId, { date_from, date_to }) {
  const [soRes, poRes] = await Promise.all([
    supabase.from('sales_orders')
      .select('order_number, order_date, status, total_amount, customer:customer_id(name)')
      .eq('tenant_id', tenantId)
      .gte('order_date', date_from)
      .lte('order_date', date_to)
      .order('order_date', { ascending: false }),
    supabase.from('purchase_orders')
      .select('order_number, order_date, status, total_amount, vendor:vendor_id(name)')
      .eq('tenant_id', tenantId)
      .gte('order_date', date_from)
      .lte('order_date', date_to)
      .order('order_date', { ascending: false }),
  ])

  if (soRes.error) throw soRes.error
  if (poRes.error) throw poRes.error

  return { salesData: soRes.data || [], purchaseData: poRes.data || [] }
}

export async function fetchInventorySnapshot(tenantId) {
  const { data, error } = await supabase
    .from('inventory_levels')
    .select('product_id, product_name, sku, unit_of_measure, warehouse_name, qty_on_hand, reorder_qty')
    .eq('tenant_id', tenantId)
    .order('product_name')
  if (error) throw error
  return data || []
}
