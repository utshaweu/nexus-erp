import { supabase } from '@shared/api/supabase'
import { PAGE_SIZE_TABLE as PAGE_SIZE, ASSET_PRODUCT_CATEGORY } from '@shared/lib/constants'
import { findActiveWorkflow, submitForApproval } from '@shared/lib/approvalWorkflow'

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Generates the year-by-year depreciation schedule rows for an asset. */
export function buildDepreciationSchedule(assetId, tenantId, purchaseCost, salvageValue, usefulLifeYears, method, purchaseDate) {
  const cost    = Math.round(parseFloat(purchaseCost) * 100) / 100
  const salvage = Math.round(parseFloat(salvageValue) * 100) / 100
  const years   = Math.max(1, parseInt(usefulLifeYears))
  if (cost <= salvage) return []

  const startDate = new Date(purchaseDate)
  const rate      = 2 / years
  const schedules = []
  let bookValue   = cost
  let accDepr     = 0

  for (let y = 1; y <= years; y++) {
    let depr
    if (method === 'straight_line') {
      depr = (cost - salvage) / years
    } else {
      depr = Math.min(bookValue * rate, Math.max(0, bookValue - salvage))
    }
    depr      = Math.max(0, Math.round(depr * 100) / 100)
    accDepr   = Math.round((accDepr + depr) * 100) / 100
    bookValue = Math.round((bookValue - depr) * 100) / 100

    const pd = new Date(startDate)
    pd.setFullYear(startDate.getFullYear() + y)

    schedules.push({
      tenant_id: tenantId, asset_id: assetId,
      period_date: pd.toISOString().slice(0, 10), period_label: `Year ${y}`,
      depreciation_amount: depr, accumulated_depreciation: accDepr,
      book_value_after: Math.max(bookValue, salvage), status: 'scheduled',
    })
    if (bookValue <= salvage) break
  }
  return schedules
}

export async function fetchAssets(tenantId, { page, search, filter }) {
  if (!tenantId) return { items: [], total: 0 }

  let query = supabase
    .from('assets')
    .select('*, asset_categories(name)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (filter !== 'all') query = query.eq('status', filter)
  if (search.trim()) {
    query = query.or(`name.ilike.%${search.trim()}%,asset_number.ilike.%${search.trim()}%,serial_number.ilike.%${search.trim()}%`)
  }

  const { data, count, error } = await query
  if (error) throw error
  return { items: data || [], total: count || 0 }
}

/** Full detail-page bundle: the asset, its depreciation schedule, and its 5 most recent maintenance logs. */
export async function fetchAssetDetail(id) {
  const [assetRes, schedRes, maintRes] = await Promise.all([
    supabase.from('assets').select('*, asset_categories(name)').eq('id', id).single(),
    supabase.from('asset_depreciation_schedules').select('*').eq('asset_id', id).order('period_date', { ascending: true }),
    supabase.from('asset_maintenance_logs').select('*').eq('asset_id', id).order('scheduled_date', { ascending: false }).limit(5),
  ])
  if (assetRes.error) throw assetRes.error
  return { asset: assetRes.data, schedules: schedRes.data || [], maintenance: maintRes.data || [] }
}

/** Unfiltered id/number/name list — feeds the asset picker on Depreciation/Maintenance/forms. */
export async function fetchAssetOptions(tenantId) {
  if (!tenantId) return []
  const { data } = await supabase
    .from('assets')
    .select('id, asset_number, name')
    .eq('tenant_id', tenantId)
    .order('name')
  return data || []
}

export async function fetchActiveAssetProducts(tenantId) {
  if (!tenantId) return []
  const { data } = await supabase
    .from('products')
    .select('id, name, cost_price')
    .eq('tenant_id', tenantId)
    .eq('category', ASSET_PRODUCT_CATEGORY)
    .order('name')
  return data || []
}

/** Creates or updates an asset, regenerating its scheduled depreciation rows when the financial inputs change. */
export async function saveAsset(tenantId, asset, data) {
  const cost    = parseFloat(data.purchase_cost)
  const salvage = parseFloat(data.salvage_value) || 0
  const years   = parseInt(data.useful_life_years)

  const payload = {
    name: data.name, description: data.description || null, category_id: data.category_id || null,
    status: data.status, purchase_date: data.purchase_date,
    purchase_cost: cost, salvage_value: salvage, useful_life_years: years,
    depreciation_method: data.depreciation_method,
    location: data.location || null, serial_number: data.serial_number || null,
    warranty_expiry: data.warranty_expiry || null, notes: data.notes || null,
    updated_at: new Date().toISOString(),
  }

  if (asset) {
    const deprParamsChanged =
      asset.purchase_cost !== cost || asset.salvage_value !== salvage ||
      asset.useful_life_years !== years || asset.depreciation_method !== data.depreciation_method ||
      asset.purchase_date !== data.purchase_date

    const { error } = await supabase.from('assets').update(payload).eq('id', asset.id)
    if (error) throw error

    if (deprParamsChanged) {
      await supabase.from('asset_depreciation_schedules').delete().eq('asset_id', asset.id).eq('status', 'scheduled')
      const schedules = buildDepreciationSchedule(asset.id, tenantId, cost, salvage, years, data.depreciation_method, data.purchase_date)
      if (schedules.length) await supabase.from('asset_depreciation_schedules').insert(schedules)
    }
  } else {
    const { data: num, error: numErr } = await supabase.rpc('generate_asset_number')
    if (numErr) throw numErr

    const { data: newAsset, error } = await supabase
      .from('assets')
      .insert({ ...payload, tenant_id: tenantId, asset_number: num, accumulated_depreciation: 0, book_value: cost })
      .select('id')
      .single()
    if (error) throw error

    const schedules = buildDepreciationSchedule(newAsset.id, tenantId, cost, salvage, years, data.depreciation_method, data.purchase_date)
    if (schedules.length) {
      const { error: schedErr } = await supabase.from('asset_depreciation_schedules').insert(schedules)
      if (schedErr) throw schedErr
    }
  }
}

export async function deleteAsset(asset) {
  const { error } = await supabase.from('assets').delete().eq('id', asset.id)
  if (error) throw error
}

export async function fetchPendingDisposal(tenantId, assetId) {
  if (!assetId || !tenantId) return null
  const { data } = await supabase
    .from('approval_requests')
    .select('id, request_number')
    .eq('tenant_id', tenantId).eq('module', 'assets')
    .eq('record_type', 'asset_disposal').eq('record_id', assetId)
    .eq('status', 'pending').maybeSingle()
  return data || null
}

/**
 * Disposes an asset directly, or — if the assets module has an active
 * workflow — stages the disposal fields and routes it through approval
 * instead. Returns { submitted } so the caller knows which happened.
 */
export async function disposeAsset(tenantId, asset, data) {
  const disposalFields = {
    disposal_date: data.disposal_date, disposal_amount: parseFloat(data.disposal_amount),
    notes: data.notes || null, updated_at: new Date().toISOString(),
  }

  const workflow = await findActiveWorkflow(tenantId, 'assets')
  if (workflow) {
    const { error: stageErr } = await supabase.from('assets').update(disposalFields).eq('id', asset.id)
    if (stageErr) throw stageErr

    const result = await submitForApproval({
      tenantId, module: 'assets', recordId: asset.id, recordType: 'asset_disposal',
      title: `Dispose Asset — ${asset.name}`,
      description: `${asset.asset_number} · Disposal date ${data.disposal_date} · Amount $${fmt(data.disposal_amount)}${data.notes ? ` · ${data.notes}` : ''}`,
      amount: disposalFields.disposal_amount, priority: 'normal',
      requestedBy: window.__erp_user__?.id,
    })
    if (result.submitted) return { submitted: true }
  }

  const { error } = await supabase.from('assets').update({ ...disposalFields, status: 'disposed' }).eq('id', asset.id)
  if (error) throw error

  await supabase.from('asset_depreciation_schedules')
    .update({ status: 'cancelled' }).eq('asset_id', asset.id).eq('status', 'scheduled')

  return { submitted: false }
}
