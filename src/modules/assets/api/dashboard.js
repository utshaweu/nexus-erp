import { supabase } from '@shared/api/supabase'

const CATEGORY_COLORS = ['#3b82f6', '#10b981', '#f97316', '#8b5cf6', '#64748b', '#f59e0b']

export async function fetchDashboardData(tenantId) {
  const [assetsRes, scheduleRes] = await Promise.all([
    supabase
      .from('assets')
      .select('id, asset_number, name, status, purchase_date, purchase_cost, book_value, accumulated_depreciation, asset_categories(name)')
      .eq('tenant_id', tenantId),
    supabase
      .from('asset_depreciation_schedules')
      .select('period_date, depreciation_amount')
      .eq('tenant_id', tenantId).eq('status', 'scheduled')
      .order('period_date', { ascending: true }),
  ])
  if (assetsRes.error) throw assetsRes.error

  const assets = assetsRes.data || []
  const active = assets.filter(a => a.status !== 'disposed')
  const totalBookValue = active.reduce((s, a) => s + Number(a.book_value || 0), 0)

  const stats = {
    total:            assets.length,
    totalValue:       totalBookValue,
    fullyDepreciated: assets.filter(a => a.status === 'fully_depreciated').length,
    underMaintenance: assets.filter(a => a.status === 'maintenance').length,
  }

  const recentAssets = [...assets]
    .sort((a, b) => new Date(b.purchase_date) - new Date(a.purchase_date))
    .slice(0, 5)

  const catMap = {}
  active.forEach(a => {
    const name = a.asset_categories?.name || 'Uncategorised'
    catMap[name] = (catMap[name] || 0) + 1
  })
  const categories = Object.entries(catMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([name, count], i) => ({ name, count, color: CATEGORY_COLORS[i] }))

  // Projected book value: aggregate future scheduled depreciation by calendar year.
  const byYear = {}
  ;(scheduleRes.data || []).forEach(d => {
    const yr = d.period_date.slice(0, 4)
    byYear[yr] = (byYear[yr] || 0) + Number(d.depreciation_amount)
  })
  let running = totalBookValue
  const chartData = [{ label: 'Now', value: Math.round(running) }]
  Object.entries(byYear).slice(0, 5).forEach(([yr, depr]) => {
    running = Math.max(0, running - depr)
    chartData.push({ label: yr, value: Math.round(running) })
  })

  return { stats, recentAssets, categories, chartData }
}
