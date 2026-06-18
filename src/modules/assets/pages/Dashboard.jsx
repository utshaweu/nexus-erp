import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Cpu, TrendingDown, Wrench, DollarSign, Plus } from 'lucide-react'
import {
  StatCard, Card, CardHeader, CardTitle, CardContent,
  Badge, Table, Thead, Th, Tbody, Tr, Td, Button, PageHeader, Spinner,
} from '@shared/components/ui'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import toast from '@shared/lib/toast'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import { ASSET_STATUS } from '@shared/lib/constants'

const CATEGORY_COLORS = ['#3b82f6', '#10b981', '#f97316', '#8b5cf6', '#64748b', '#f59e0b']

const fmtVal = (n) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
  return `$${Number(n).toFixed(0)}`
}

export default function AssetDashboard() {
  const { tenantId } = useTenant()

  const [loading,      setLoading]      = useState(true)
  const [stats,        setStats]        = useState({ total: 0, totalValue: 0, fullyDepreciated: 0, underMaintenance: 0 })
  const [recentAssets, setRecentAssets] = useState([])   // top-5 by purchase date
  const [categories,   setCategories]  = useState([])
  const [chartData,    setChartData]   = useState([])

  const fetchData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const [assetsRes, scheduleRes] = await Promise.all([
        supabase
          .from('assets')
          .select('id, asset_number, name, status, purchase_date, purchase_cost, book_value, accumulated_depreciation, asset_categories(name)')
          .eq('tenant_id', tenantId),
        supabase
          .from('asset_depreciation_schedules')
          .select('period_date, depreciation_amount')
          .eq('tenant_id', tenantId)
          .eq('status', 'scheduled')
          .order('period_date', { ascending: true }),
      ])

      if (assetsRes.error) throw assetsRes.error

      const assets = assetsRes.data || []
      const active = assets.filter(a => a.status !== 'disposed')
      const totalBookValue = active.reduce((s, a) => s + Number(a.book_value || 0), 0)

      setStats({
        total:            assets.length,
        totalValue:       totalBookValue,
        fullyDepreciated: assets.filter(a => a.status === 'fully_depreciated').length,
        underMaintenance: assets.filter(a => a.status === 'maintenance').length,
      })

      // most recent 5 by purchase date
      setRecentAssets(
        [...assets]
          .sort((a, b) => new Date(b.purchase_date) - new Date(a.purchase_date))
          .slice(0, 5)
      )

      // assets by category
      const catMap = {}
      active.forEach(a => {
        const name = a.asset_categories?.name || 'Uncategorised'
        catMap[name] = (catMap[name] || 0) + 1
      })
      setCategories(
        Object.entries(catMap)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 6)
          .map(([name, count], i) => ({ name, count, color: CATEGORY_COLORS[i] }))
      )

      // projected book value: aggregate future scheduled depreciation by calendar year
      const byYear = {}
      ;(scheduleRes.data || []).forEach(d => {
        const yr = d.period_date.slice(0, 4)
        byYear[yr] = (byYear[yr] || 0) + Number(d.depreciation_amount)
      })
      let running = totalBookValue
      const projected = [{ label: 'Now', value: Math.round(running) }]
      Object.entries(byYear).slice(0, 5).forEach(([yr, depr]) => {
        running = Math.max(0, running - depr)
        projected.push({ label: yr, value: Math.round(running) })
      })
      setChartData(projected)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assets"
        subtitle="Fixed asset management and depreciation tracking"
        breadcrumb="Finance / Assets"
        actions={
          <Link to="/assets/list">
            <Button size="sm"><Plus className="w-4 h-4" />Add Asset</Button>
          </Link>
        }
      />

      {/* ── Stat cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Assets"   value={stats.total.toString()}             icon={Cpu}          color="#f97316" loading={loading} />
        <StatCard label="Total Value"    value={fmtVal(stats.totalValue)}            icon={DollarSign}   color="#8b5cf6" loading={loading} />
        <StatCard label="Fully Depr."   value={stats.fullyDepreciated.toString()}   icon={TrendingDown} color="#64748b" loading={loading} />
        <StatCard label="In Maintenance" value={stats.underMaintenance.toString()}  icon={Wrench}       color="#f59e0b" loading={loading} />
      </div>

      {/* ── Projected chart + category breakdown ─────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Projected Book Value</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[200px] flex items-center justify-center">
                <Spinner className="w-6 h-6" />
              </div>
            ) : chartData.length < 2 ? (
              <div className="h-[200px] flex flex-col items-center justify-center gap-2 text-sm text-slate-500">
                <TrendingDown className="w-8 h-8 text-slate-300 dark:text-slate-700" />
                No depreciation schedule data. Create assets to see projections.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="assetGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#f97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false} tickLine={false}
                    tickFormatter={v => fmtVal(v)}
                  />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                    formatter={v => [`$${Number(v).toLocaleString()}`, 'Book Value']}
                  />
                  <Area type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} fill="url(#assetGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Assets by Category</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-8 rounded bg-surface-200 dark:bg-surface-800 animate-pulse" />
                ))}
              </div>
            ) : categories.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">No active assets yet.</p>
            ) : (
              categories.map(cat => (
                <div key={cat.name} className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400 truncate mr-2">{cat.name}</span>
                    <span className="text-slate-300 flex-shrink-0">{cat.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-800">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(4, (cat.count / (categories[0]?.count || 1)) * 100)}%`,
                        backgroundColor: cat.color,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Assets table ──────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Assets</CardTitle>
            <Link to="/assets/list" className="text-xs text-brand-400 hover:text-brand-300">
              View all →
            </Link>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="w-6 h-6" />
            </div>
          ) : recentAssets.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No assets yet.{' '}
              <Link to="/assets/list" className="text-orange-400 hover:underline">Add your first asset →</Link>
            </div>
          ) : (
            <Table>
              <Thead>
                <Th>Asset ID</Th>
                <Th>Name</Th>
                <Th>Category</Th>
                <Th>Purchase Date</Th>
                <Th>Cost</Th>
                <Th>Book Value</Th>
                <Th>Status</Th>
              </Thead>
              <Tbody>
                {recentAssets.map(a => {
                  const s = ASSET_STATUS[a.status] || { label: a.status, color: 'default' }
                  const deprPct = Number(a.purchase_cost) > 0
                    ? Math.round(((Number(a.purchase_cost) - Number(a.book_value)) / Number(a.purchase_cost)) * 100)
                    : 0
                  return (
                    <Tr key={a.id}>
                      <Td>
                        <span className="font-mono text-xs text-orange-400">{a.asset_number}</span>
                      </Td>
                      <Td>
                        <Link
                          to={`/assets/list/${a.id}`}
                          className="font-medium text-slate-900 dark:text-slate-100
                                     hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
                        >
                          {a.name}
                        </Link>
                      </Td>
                      <Td>
                        <span className="text-slate-400 text-sm">{a.asset_categories?.name || '—'}</span>
                      </Td>
                      <Td>
                        <span className="text-slate-500 text-sm">{a.purchase_date}</span>
                      </Td>
                      <Td>
                        <span className="font-semibold">${Number(a.purchase_cost).toLocaleString()}</span>
                      </Td>
                      <Td>
                        <div>
                          <span className="font-semibold text-orange-600 dark:text-orange-400">
                            ${Number(a.book_value).toLocaleString()}
                          </span>
                          <span className="text-xs text-slate-500 ml-1">(-{deprPct}%)</span>
                        </div>
                      </Td>
                      <Td>
                        <Badge color={s.color}>{s.label}</Badge>
                      </Td>
                    </Tr>
                  )
                })}
              </Tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
