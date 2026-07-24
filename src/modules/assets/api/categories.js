import { supabase } from '@shared/api/supabase'
import { PAGE_SIZE_TABLE as PAGE_SIZE } from '@shared/lib/constants'

export async function fetchCategories(tenantId, { page, search }) {
  if (!tenantId) return { items: [], total: 0 }

  let query = supabase
    .from('asset_categories')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('name')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (search.trim()) query = query.ilike('name', `%${search.trim()}%`)

  const { data, count, error } = await query
  if (error) throw error
  return { items: data || [], total: count || 0 }
}

/** Full id/name/depreciation-defaults list — feeds the category picker on asset forms. */
export async function fetchActiveCategories(tenantId) {
  if (!tenantId) return []
  const { data } = await supabase
    .from('asset_categories')
    .select('id, name, depreciation_method, default_useful_life, default_salvage_rate, is_active')
    .eq('tenant_id', tenantId)
    .order('name')
  return data || []
}

export async function saveCategory(tenantId, category, data) {
  if (category) {
    const { error } = await supabase.from('asset_categories').update(data).eq('id', category.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('asset_categories').insert({ ...data, tenant_id: tenantId })
    if (error) throw error
  }
}

export async function deleteCategory(category) {
  const { error } = await supabase.from('asset_categories').delete().eq('id', category.id)
  if (error) throw error
}

export async function toggleCategoryActive(category) {
  const { error } = await supabase
    .from('asset_categories')
    .update({ is_active: !category.is_active })
    .eq('id', category.id)
  if (error) throw error
}
