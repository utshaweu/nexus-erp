import { useState, useEffect, useCallback } from 'react'
import { TrendingDown, CheckCircle2 } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card,
  StatCard, EmptyState,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { PAGE_SIZE_TABLE as PAGE_SIZE, ASSET_DEPR_STATUS, ASSET_DEPR_STATUS_TABS } from '@shared/lib/constants'
import { fetchAssetOptions } from '../api/assets'
import { fetchDepreciationSchedules, fetchDepreciationStats, postDepreciationEntry } from '../api/depreciation'
import { useResourceList } from '../hooks/useResourceList'
import ListToolbar from '../components/ListToolbar'

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const STATUS_TABS = ASSET_DEPR_STATUS_TABS.map(s => ({ value: s, label: s === 'all' ? 'All' : ASSET_DEPR_STATUS[s]?.label }))

export default function Depreciation() {
  const { tenantId } = useTenant()
  const [allAssets, setAllAssets] = useState([])
  const [assetFilter, setAssetFilter] = useState('')
  const [posting, setPosting] = useState(null)
  const [stats, setStats] = useState({ scheduled: 0, posted: 0, scheduledAmt: 0, postedAmt: 0 })

  const fetchFn = useCallback(
    ({ page, filter }) => fetchDepreciationSchedules(tenantId, { page, assetFilter, statusFilter: filter }),
    [tenantId, assetFilter]
  )
  const {
    items: schedules, total, page, setPage, filter: statusFilter, setFilter: setStatusFilter, loading, refetch,
  } = useResourceList(fetchFn, [tenantId, assetFilter])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const loadStats = useCallback(() => {
    fetchDepreciationStats(tenantId, assetFilter).then(setStats)
  }, [tenantId, assetFilter])

  useEffect(() => { loadStats() }, [loadStats])
  useEffect(() => { fetchAssetOptions(tenantId).then(setAllAssets) }, [tenantId])
  useEffect(() => { setPage(1) }, [assetFilter, setPage])

  const handlePost = async (entry) => {
    if (entry.status !== 'scheduled') return
    if (!window.confirm(`Post depreciation for ${entry.assets?.name} — ${entry.period_label}?\n\nThis will update the asset's book value and cannot be undone.`)) return

    setPosting(entry.id)
    try {
      await postDepreciationEntry(entry)
      toast.success('Depreciation posted.')
      refetch(); loadStats()
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Scheduled Periods" value={stats.scheduled.toString()} icon={TrendingDown} color="#f97316" />
        <StatCard label="Scheduled Amount" value={`$${Number(stats.scheduledAmt).toLocaleString('en-US', { maximumFractionDigits: 0 })}`} icon={TrendingDown} color="#f59e0b" />
        <StatCard label="Posted Periods" value={stats.posted.toString()} icon={CheckCircle2} color="#10b981" />
        <StatCard label="Posted Amount" value={`$${Number(stats.postedAmt).toLocaleString('en-US', { maximumFractionDigits: 0 })}`} icon={CheckCircle2} color="#10b981" />
      </div>

      <Card>
        <ListToolbar tabs={STATUS_TABS} activeTab={statusFilter} onTabChange={setStatusFilter}>
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
        </ListToolbar>

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
                        <span className="font-medium text-slate-900 dark:text-slate-100 text-sm">{s.assets?.name || '—'}</span>
                        <p className="text-xs text-orange-500 dark:text-orange-400 font-mono">{s.assets?.asset_number}</p>
                      </div>
                    </Td>
                    <Td><span className="font-medium text-slate-700 dark:text-slate-300">{s.period_label}</span></Td>
                    <Td><span className="text-sm text-slate-500">{s.period_date}</span></Td>
                    <Td><span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">${fmt(s.depreciation_amount)}</span></Td>
                    <Td><span className="font-mono text-sm text-slate-600 dark:text-slate-400">${fmt(s.accumulated_depreciation)}</span></Td>
                    <Td><span className="font-mono text-sm font-semibold text-orange-600 dark:text-orange-400">${fmt(s.book_value_after)}</span></Td>
                    <Td><Badge color={st?.color || 'default'}>{st?.label || s.status}</Badge></Td>
                    <Td onClick={e => e.stopPropagation()}>
                      {s.status === 'scheduled' && (
                        <PermissionGate action="edit" moduleId="assets">
                          <Button variant="outline" size="xs" loading={posting === s.id} onClick={() => handlePost(s)}>
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
          page={page} totalPages={totalPages} onPageChange={setPage}
          total={total} pageSize={PAGE_SIZE} label="entries"
          className="border-t border-surface-200 dark:border-surface-800"
        />
      </Card>
    </div>
  )
}
