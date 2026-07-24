import { supabase } from '@shared/api/supabase'

export async function fetchSavedFilters(tenantId, reportPage) {
  const { data } = await supabase
    .from('report_saved_filters')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('report_page', reportPage)
    .order('created_at', { ascending: false })
  return data || []
}

export async function saveFilter(tenantId, reportPage, name, filters) {
  const { error } = await supabase.from('report_saved_filters').insert({
    tenant_id:   tenantId,
    report_page: reportPage,
    name,
    filters,
  })
  if (error) throw error
}

export async function deleteSavedFilter(id) {
  const { error } = await supabase.from('report_saved_filters').delete().eq('id', id)
  if (error) throw error
}
