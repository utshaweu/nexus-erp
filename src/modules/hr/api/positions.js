import { supabase } from '@shared/api/supabase'
import { PAGE_SIZE_TABLE as PAGE_SIZE } from '@shared/lib/constants'

export async function fetchPositions(tenantId, { page, search }) {
  if (!tenantId) return { items: [], total: 0 }

  let query = supabase
    .from('hr_positions')
    .select('*, hr_departments(name)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('title')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  if (search.trim()) query = query.ilike('title', `%${search.trim()}%`)

  const { data, count, error } = await query
  if (error) throw error
  return { items: data || [], total: count || 0 }
}

/** id/title/department_id/is_active only — feeds the position picker on the Employee form. */
export async function fetchPositionOptions(tenantId) {
  if (!tenantId) return []
  const { data } = await supabase
    .from('hr_positions')
    .select('id, title, department_id, is_active')
    .eq('tenant_id', tenantId)
    .order('title')
  return data || []
}

export async function savePosition(tenantId, position, data) {
  const payload = {
    title:         data.title,
    department_id: data.department_id || null,
    description:   data.description   || null,
    updated_at:    new Date().toISOString(),
  }
  if (position) {
    const { error } = await supabase.from('hr_positions').update(payload).eq('id', position.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('hr_positions').insert({ ...payload, tenant_id: tenantId })
    if (error) throw error
  }
}

export async function deletePosition(position) {
  const { error } = await supabase.from('hr_positions').delete().eq('id', position.id)
  if (error) throw error
}

export async function togglePositionActive(position) {
  const { error } = await supabase
    .from('hr_positions')
    .update({ is_active: !position.is_active, updated_at: new Date().toISOString() })
    .eq('id', position.id)
  if (error) throw error
}
