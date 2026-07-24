import { supabase } from '@shared/api/supabase'
import { PAGE_SIZE_TABLE as PAGE_SIZE } from '@shared/lib/constants'

export async function fetchDepreciationSchedules(tenantId, { page, assetFilter, statusFilter }) {
  if (!tenantId) return { items: [], total: 0 }

  let query = supabase
    .from('asset_depreciation_schedules')
    .select('*, assets(name, asset_number)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('period_date', { ascending: true })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (assetFilter) query = query.eq('asset_id', assetFilter)
  if (statusFilter !== 'all') query = query.eq('status', statusFilter)

  const { data, count, error } = await query
  if (error) throw error
  return { items: data || [], total: count || 0 }
}

export async function fetchDepreciationStats(tenantId, assetFilter) {
  if (!tenantId) return { scheduled: 0, posted: 0, scheduledAmt: 0, postedAmt: 0 }

  let query = supabase
    .from('asset_depreciation_schedules')
    .select('status, depreciation_amount')
    .eq('tenant_id', tenantId)
  if (assetFilter) query = query.eq('asset_id', assetFilter)

  const { data } = await query
  const rows = data || []
  return {
    scheduled:    rows.filter(r => r.status === 'scheduled').length,
    posted:       rows.filter(r => r.status === 'posted').length,
    scheduledAmt: rows.filter(r => r.status === 'scheduled').reduce((s, r) => s + Number(r.depreciation_amount), 0),
    postedAmt:    rows.filter(r => r.status === 'posted').reduce((s, r) => s + Number(r.depreciation_amount), 0),
  }
}

/** Posts one scheduled depreciation entry and rolls its amount into the asset's book value. */
export async function postDepreciationEntry(entry) {
  const { error: updErr } = await supabase
    .from('asset_depreciation_schedules')
    .update({ status: 'posted' })
    .eq('id', entry.id)
  if (updErr) throw updErr

  const { data: asset, error: assetErr } = await supabase
    .from('assets')
    .select('accumulated_depreciation, purchase_cost, salvage_value, status')
    .eq('id', entry.asset_id)
    .single()
  if (assetErr) throw assetErr

  const newAccDepr = Math.round((Number(asset.accumulated_depreciation) + Number(entry.depreciation_amount)) * 100) / 100
  const newBookVal = Math.round((Number(asset.purchase_cost) - newAccDepr) * 100) / 100
  const fullyDepr  = newBookVal <= Number(asset.salvage_value)

  await supabase.from('assets').update({
    accumulated_depreciation: newAccDepr,
    book_value: Math.max(newBookVal, Number(asset.salvage_value)),
    status: fullyDepr ? 'fully_depreciated' : asset.status,
    updated_at: new Date().toISOString(),
  }).eq('id', entry.asset_id)
}
