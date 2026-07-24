import { supabase } from '@shared/api/supabase'
import { PAGE_SIZE_TABLE as PAGE_SIZE } from '@shared/lib/constants'

export async function fetchDepartments(tenantId, { page, search }) {
  if (!tenantId) return { items: [], total: 0 }

  let query = supabase
    .from('hr_departments')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('name')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  if (search.trim()) query = query.ilike('name', `%${search.trim()}%`)

  const { data, count, error } = await query
  if (error) throw error
  return { items: data || [], total: count || 0 }
}

/** id/name/is_active only — feeds department pickers on Employee/Position forms. */
export async function fetchDepartmentOptions(tenantId) {
  if (!tenantId) return []
  const { data } = await supabase
    .from('hr_departments')
    .select('id, name, is_active')
    .eq('tenant_id', tenantId)
    .order('name')
  return data || []
}

export async function saveDepartment(tenantId, dept, data) {
  if (dept) {
    const { error } = await supabase
      .from('hr_departments')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', dept.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('hr_departments').insert({ ...data, tenant_id: tenantId })
    if (error) throw error
  }
}

export async function deleteDepartment(dept) {
  const { error } = await supabase.from('hr_departments').delete().eq('id', dept.id)
  if (error) throw error
}

export async function toggleDepartmentActive(dept) {
  const { error } = await supabase
    .from('hr_departments')
    .update({ is_active: !dept.is_active, updated_at: new Date().toISOString() })
    .eq('id', dept.id)
  if (error) throw error
}
