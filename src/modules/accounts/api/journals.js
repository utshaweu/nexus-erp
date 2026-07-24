import { supabase } from '@shared/api/supabase'
import { PAGE_SIZE_TABLE as PAGE_SIZE } from '@shared/lib/constants'

export async function fetchJournalEntries(tenantId, { page, search, filter }) {
  if (!tenantId) return { items: [], total: 0 }

  let query = supabase
    .from('journal_entries')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('entry_date', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (filter !== 'all') query = query.eq('status', filter)
  if (search.trim()) {
    query = query.or(`entry_number.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%`)
  }

  const { data, count, error } = await query
  if (error) throw error
  return { items: data || [], total: count || 0 }
}

export async function fetchJournalEntryLines(entryId) {
  const { data } = await supabase
    .from('journal_entry_lines')
    .select('*')
    .eq('journal_entry_id', entryId)
    .order('id')
  return data || []
}

/** Creates or updates a journal entry header + wholesale-replaces its lines. */
export async function saveJournalEntry(tenantId, entry, data) {
  const isEdit = Boolean(entry)
  const totalD = data.lines.reduce((s, l) => s + Number(l.debit_amount  || 0), 0)
  const totalC = data.lines.reduce((s, l) => s + Number(l.credit_amount || 0), 0)

  const header = {
    entry_date:   data.entry_date,
    description:  data.description,
    reference:    data.reference || null,
    status:       data.status,
    total_debit:  totalD,
    total_credit: totalC,
    updated_at:   new Date().toISOString(),
  }

  let entryId = entry?.id
  if (isEdit) {
    const { error } = await supabase.from('journal_entries').update(header).eq('id', entryId)
    if (error) throw error
    await supabase.from('journal_entry_lines').delete().eq('journal_entry_id', entryId)
  } else {
    const { data: num, error: numErr } = await supabase.rpc('generate_journal_entry_number')
    if (numErr) throw numErr
    const { data: newEntry, error } = await supabase
      .from('journal_entries')
      .insert({ ...header, tenant_id: tenantId, entry_number: num })
      .select('id')
      .single()
    if (error) throw error
    entryId = newEntry.id
  }

  const lines = data.lines.map(l => ({
    tenant_id: tenantId, journal_entry_id: entryId,
    account_id: l.account_id, description: l.description || null,
    debit_amount: Number(l.debit_amount), credit_amount: Number(l.credit_amount),
  }))
  const { error: lineErr } = await supabase.from('journal_entry_lines').insert(lines)
  if (lineErr) throw lineErr
}

export async function deleteJournalEntry(entry) {
  await supabase.from('journal_entry_lines').delete().eq('journal_entry_id', entry.id)
  const { error } = await supabase.from('journal_entries').delete().eq('id', entry.id)
  if (error) throw error
}

export async function fetchActiveAccounts(tenantId) {
  if (!tenantId) return []
  const { data } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, account_type')
    .eq('tenant_id', tenantId).eq('is_active', true).order('code')
  return data || []
}
