import { supabase } from '@shared/api/supabase'

/** id/name only — feeds the RFQ line item's product picker. */
export async function fetchProductNameOptions(tenantId) {
  if (!tenantId) return []
  const { data } = await supabase
    .from('products')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('name')
  return data || []
}

/** id/name/cost_price — feeds the Purchase Order line item's product picker (auto-fills unit price). */
export async function fetchProductPricingOptions(tenantId) {
  if (!tenantId) return []
  const { data } = await supabase
    .from('products')
    .select('id, name, cost_price')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('name')
  return data || []
}
