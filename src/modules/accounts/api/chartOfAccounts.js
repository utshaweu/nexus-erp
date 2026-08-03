import { supabase } from '@shared/api/supabase'
import { PAGE_SIZE_TABLE as PAGE_SIZE } from '@shared/lib/constants'

export async function fetchAccounts(tenantId, { page, search, filter }) {
  if (!tenantId) return { items: [], total: 0 }

  let query = supabase
    .from('chart_of_accounts')
    .select('*, parent:parent_id(code,name)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('code')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (filter !== 'all') query = query.eq('account_type', filter)
  if (search.trim()) query = query.or(`code.ilike.%${search.trim()}%,name.ilike.%${search.trim()}%`)

  const { data, count, error } = await query
  if (error) throw error
  return { items: data || [], total: count || 0 }
}

/** Unfiltered/unpaginated — used to populate the parent-account dropdown and the tree view. */
export async function fetchAllAccounts(tenantId) {
  if (!tenantId) return []
  const { data } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, account_type, is_active, parent_id')
    .eq('tenant_id', tenantId)
    .order('code')
  return data || []
}

export async function saveAccount(tenantId, account, data) {
  const payload = {
    code: data.code, name: data.name, account_type: data.account_type,
    parent_id: data.parent_id || null, is_active: data.is_active === 'true',
  }
  if (account) {
    const { error } = await supabase.from('chart_of_accounts').update(payload).eq('id', account.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('chart_of_accounts').insert({ ...payload, tenant_id: tenantId })
    if (error) throw error
  }
}

export async function deleteAccount(account) {
  const { error } = await supabase.from('chart_of_accounts').delete().eq('id', account.id)
  if (error) throw error
}
