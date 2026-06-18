import { useState, useEffect, useCallback } from 'react'
import { TrendingDown, Search, CheckCircle2, Cpu } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card,
  CardHeader, CardTitle, CardContent, StatCard, Select, EmptyState,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import {
  PAGE_SIZE_TABLE as PAGE_SIZE,
  ASSET_DEPR_STATUS,
  ASSET_DEPR_STATUS_TABS,
} from '@shared/lib/constants'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Depreciation() {
  const { tenantId }   = useTenant()
  const [schedules,    setSchedules]    = useState([])
  const [allAssets,    setAllAssets]    = useState([])
  const [total,        setTotal]        = useState(0)
  const [page,         setPage]         = useState(1)
  const [assetFilter,  setAssetFilter]  = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading,      setLoading]      = useState(true)
  const [posting,      setPosting]      = useState(null)

  // Summary stats computed from the full unfiltered list for the current asset
  const [stats, setStats] = useState({ scheduled: 0, posted: 0, scheduledAmt: 0, postedAmt: 0 })

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const fetchSchedules = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      let query = supabase
        .from('asset_depreciation_schedules')
        .select('*, assets(name, asset_number)', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('period_date', { ascending: true })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (assetFilter)        query = query.eq('asset_id', assetFilter)
      if (statusFilter !== 'all') query = query.eq('status', statusFilter)

      const { data, count, error } = await query
      if (error) throw error
      setSchedules(data || [])
      setTotal(count || 0)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId, page, assetFilter, statusFilter])

  const fetchStats = useCallback(async () => {
    if (!tenantId) return
    let query = supabase
      .from('asset_depreciation_schedules')
      .select('status, depreciation_amount')
      .eq('tenant_id', tenantId)
    if (assetFilter) query = query.eq('asset_id', assetFilter)
    const { data } = await query
    if (!data) return

    const rows = data
    setStats({
      scheduled:    rows.filter(r => r.status === 'scheduled').length,
      posted:       rows.filter(r => r.status === 'posted').length,
      scheduledAmt: rows.filter(r => r.status === 'scheduled').reduce((s, r) => s + Number(r.depreciation_amount), 0),
      postedAmt:    rows.filter(r => r.status === 'posted').reduce((s, r) => s + Number(r.depreciation_amount), 0),
    })
  }, [tenantId, assetFilter])

  const fetchAssets = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase
      .from('assets')
      .select('id, asset_number, name')
      .eq('tenant_id', tenantId)
      .order('name')
    setAllAssets(data || [])
  }, [tenantId])

  useEffect(() => { fetchSchedules() }, [fetchSchedules])
  useEffect(() => { fetchStats()     }, [fetchStats])
  useEffect(() => { fetchAssets()    }, [fetchAssets])
  useEffect(() => { setPage(1) },       [assetFilter, statusFilter])

  const handlePost = async (entry) => {
    if (entry.status !== 'scheduled') return
    if (!window.confirm(`Post depreciation for ${entry.assets?.name} — ${entry.period_label}?\n\nThis will update the asset's book value and cannot be undone.`)) return

    setPosting(entry.id)
    try {
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

      const newAccDepr  = Math.round((Number(asset.accumulated_depreciation) + Number(entry.depreciation_amount)) * 100) / 100
      const newBookVal  = Math.round((Number(asset.purchase_cost) - newAccDepr) * 100) / 100
      const fullyDepr   = newBookVal <= Number(asset.salvage_value)
      const newStatus   = fullyDepr ? 'fully_depreciated' : asset.status

      await supabase.from('assets').update({
        accumulated_depreciation: newAccDepr,
        book_value:               Math.max(newBookVal, Number(asset.salvage_value)),
        status:                   newStatus,
        updated_at:               new Date().toISOString(),
      }).eq('id', entry.asset_id)

      toast.success('Depreciation posted.')
      fetchSchedules()
      fetchStats()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setPosting(null)
    }
  }

  const handlePostAll = async () => {
    const scheduledOnPage = schedules.filter(s => s.status === 'scheduled')
    if (!scheduledOnPage.length) { toast.info('No scheduled entries on this page.'); return }
    if (!window.confirm(`Post all ${scheduledOnPage.length} scheduled entries on this page?`)) return

    for (const entry of scheduledOnPage) {
      await handlePost(entry)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Depreciation"
        subtitle="Review and post annual depreciation schedule entries"
        breadcrumb="Assets / Depreciation"
        actions={
          <PermissionGate action="edit" moduleId="assets">
            <Button size="sm" variant="secondary" onClick={handlePostAll}>
              <CheckCircle2 className="w-4 h-4" />Post Page
            </Button>
          </PermissionGate>
        }
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Scheduled Periods"
          value={stats.scheduled.toString()}
          icon={TrendingDown}
          color="#f97316"
        />
        <StatCard
          label="Scheduled Amount"
          value={`$${Number(stats.scheduledAmt).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
          icon={TrendingDown}
          color="#f59e0b"
        />
        <StatCard
          label="Posted Periods"
          value={stats.posted.toString()}
          icon={CheckCircle2}
          color="#10b981"
        />
        <StatCard
          label="Posted Amount"
          value={`$${Number(stats.postedAmt).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
          icon={CheckCircle2}
          color="#10b981"
        />
      </div>

      <Card>
        {/* Toolbar */}
        <div className="flex items-center gap-3 p-4 border-b border-surface-200 dark:border-surface-800 flex-wrap">
          {/* Asset selector */}
          <div className="w-64">
            <select
              value={assetFilter}
              onChange={e => setAssetFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm
                         text-slate-900 dark:text-slate-200
                         bg-slate-50 dark:bg-surface-800
                         border border-surface-200 dark:border-surface-700
                         focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">All Assets</option>
              {allAssets.map(a => (
                <option key={a.id} value={a.id}>{a.asset_number} — {a.name}</option>
              ))}
            </select>
          </div>

          {/* Status filter tabs */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-surface-800">
            {ASSET_DEPR_STATUS_TABS.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  statusFilter === s
                    ? 'bg-white dark:bg-surface-700 text-slate-800 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {s === 'all' ? 'All' : ASSET_DEPR_STATUS[s]?.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-orange-400 animate-pulse" />
            </div>
            <p className="text-sm text-slate-400">Loading depreciation schedule…</p>
          </div>
        ) : schedules.length === 0 ? (
          <EmptyState
            icon={TrendingDown}
            title="No depreciation entries"
            description={assetFilter || statusFilter !== 'all'
              ? 'Try adjusting your filters.'
              : 'Depreciation schedules are generated automatically when assets are created.'}
          />
        ) : (
          <Table>
            <Thead>
              <Th>Asset</Th>
              <Th>Period</Th>
              <Th>Date</Th>
              <Th>Depreciation</Th>
              <Th>Accumulated</Th>
              <Th>Book Value After</Th>
              <Th>Status</Th>
              <Th></Th>
            </Thead>
            <Tbody>
              {schedules.map(s => {
                const st = ASSET_DEPR_STATUS[s.status]
                return (
                  <Tr key={s.id}>
                    <Td>
                      <div>
                        <span className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                          {s.assets?.name || '—'}
                        </span>
                        <p className="text-xs text-orange-500 dark:text-orange-400 font-mono">
                          {s.assets?.asset_number}
                        </p>
                      </div>
                    </Td>
                    <Td>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{s.period_label}</span>
                    </Td>
                    <Td>
                      <span className="text-sm text-slate-500">{s.period_date}</span>
                    </Td>
                    <Td>
                      <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">
                        ${fmt(s.depreciation_amount)}
                      </span>
                    </Td>
                    <Td>
                      <span className="font-mono text-sm text-slate-600 dark:text-slate-400">
                        ${fmt(s.accumulated_depreciation)}
                      </span>
                    </Td>
                    <Td>
                      <span className="font-mono text-sm font-semibold text-orange-600 dark:text-orange-400">
                        ${fmt(s.book_value_after)}
                      </span>
                    </Td>
                    <Td>
                      <Badge color={st?.color || 'default'}>{st?.label || s.status}</Badge>
                    </Td>
                    <Td onClick={e => e.stopPropagation()}>
                      {s.status === 'scheduled' && (
                        <PermissionGate action="edit" moduleId="assets">
                          <Button
                            variant="outline"
                            size="xs"
                            loading={posting === s.id}
                            onClick={() => handlePost(s)}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />Post
                          </Button>
                        </PermissionGate>
                      )}
                    </Td>
                  </Tr>
                )
              })}
            </Tbody>
          </Table>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          total={total}
          pageSize={PAGE_SIZE}
          label="entries"
          className="border-t border-surface-200 dark:border-surface-800"
        />
      </Card>
    </div>
  )
}
