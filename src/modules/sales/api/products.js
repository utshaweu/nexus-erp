import { supabase } from '@shared/api/supabase'

/** id/name only — feeds the "Buy"/"Get" product pickers on the Offer form. */
export async function fetchProductNameOptions(tenantId) {
  const { data } = await supabase
    .from('products')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('name')
  return data || []
}

/** id/name/sale_price — feeds the Quotation line item product picker (auto-fills unit price). */
export async function fetchProductSaleOptions(tenantId) {
  const { data } = await supabase
    .from('products')
    .select('id, name, sale_price')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('name')
  return data || []
}

/** id/name/sale_price/category — Sales Order line item picker also needs category to match offer scopes. */
export async function fetchProductSaleOptionsWithCategory(tenantId) {
  const { data } = await supabase
    .from('products')
    .select('id, name, sale_price, category')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('name')
  return data || []
}
