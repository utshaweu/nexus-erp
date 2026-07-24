import { supabase } from '@shared/api/supabase'
import { PAGE_SIZE_TABLE as PAGE_SIZE } from '@shared/lib/constants'

export async function fetchMaintenanceLogs(tenantId, { page, search, statusFilter, assetFilter }) {
  if (!tenantId) return { items: [], total: 0 }

  let query = supabase
    .from('asset_maintenance_logs')
    .select('*, assets(name, asset_number)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('scheduled_date', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (statusFilter !== 'all') query = query.eq('status', statusFilter)
  if (assetFilter) query = query.eq('asset_id', assetFilter)
  if (search.trim()) {
    query = query.or(`log_number.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%,performed_by.ilike.%${search.trim()}%`)
  }

  const { data, count, error } = await query
  if (error) throw error
  return { items: data || [], total: count || 0 }
}

async function markAssetInMaintenance(assetId) {
  await supabase.from('assets')
    .update({ status: 'maintenance', updated_at: new Date().toISOString() })
    .eq('id', assetId).eq('status', 'active')
}

/** No other open log on this asset → it's safe to flip the asset back to active. */
async function clearAssetMaintenanceIfNoOtherOpenLogs(assetId, excludeLogId) {
  const { data: otherLogs } = await supabase
    .from('asset_maintenance_logs')
    .select('id')
    .eq('asset_id', assetId)
    .in('status', ['scheduled', 'in_progress'])
    .neq('id', excludeLogId)
  if (!otherLogs?.length) {
    await supabase.from('assets')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', assetId).eq('status', 'maintenance')
  }
}

export async function saveMaintenanceLog(tenantId, log, data) {
  const payload = {
    asset_id: data.asset_id, maintenance_type: data.maintenance_type, status: data.status,
    scheduled_date: data.scheduled_date, completed_date: data.completed_date || null,
    description: data.description, cost: parseFloat(data.cost),
    performed_by: data.performed_by || null, notes: data.notes || null,
    updated_at: new Date().toISOString(),
  }

  if (log) {
    const { error } = await supabase.from('asset_maintenance_logs').update(payload).eq('id', log.id)
    if (error) throw error

    if (data.status === 'in_progress' || data.status === 'scheduled') {
      await markAssetInMaintenance(data.asset_id)
    } else if (data.status === 'completed' || data.status === 'cancelled') {
      await clearAssetMaintenanceIfNoOtherOpenLogs(data.asset_id, log.id)
    }
  } else {
    const { data: num, error: numErr } = await supabase.rpc('generate_maintenance_log_number')
    if (numErr) throw numErr

    const { error } = await supabase.from('asset_maintenance_logs').insert({ ...payload, tenant_id: tenantId, log_number: num })
    if (error) throw error

    if (data.status === 'in_progress' || data.status === 'scheduled') {
      await markAssetInMaintenance(data.asset_id)
    }
  }
}

export async function deleteMaintenanceLog(log) {
  const { error } = await supabase.from('asset_maintenance_logs').delete().eq('id', log.id)
  if (error) throw error
}
