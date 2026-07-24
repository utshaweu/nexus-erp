import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2, Calendar, DollarSign, TrendingDown } from 'lucide-react'
import { Button, Badge, Card, PageHeader, Spinner } from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { DEPRECIATION_METHODS, ASSET_STATUS } from '@shared/lib/constants'
import { fetchAssetDetail, fetchPendingDisposal, fetchActiveAssetProducts } from '../api/assets'
import { fetchActiveCategories } from '../api/categories'
import AssetModal from '../components/AssetModal'
import DisposeModal from '../components/DisposeModal'
import InfoCard from '../components/InfoCard'
import OverviewTab from '../components/OverviewTab'
import ScheduleTab from '../components/ScheduleTab'
import MaintenanceTab from '../components/MaintenanceTab'

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function AssetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { tenantId } = useTenant()

  const [asset, setAsset]             = useState(null)
  const [categories, setCategories]   = useState([])
  const [assetProducts, setAssetProducts] = useState([])
  const [schedules, setSchedules]     = useState([])
  const [maintenance, setMaintenance] = useState([])
  const [loading, setLoading]         = useState(true)
  const [activeTab, setActiveTab]     = useState('overview')
  const [showEdit, setShowEdit]       = useState(false)
  const [showDispose, setShowDispose] = useState(false)
  const [pendingDisposal, setPendingDisposal] = useState(null)

  const fetchAsset = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const { asset, schedules, maintenance } = await fetchAssetDetail(id)
      setAsset(asset)
      setSchedules(schedules)
      setMaintenance(maintenance)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  const loadPendingDisposal = useCallback(() => {
    fetchPendingDisposal(tenantId, id).then(setPendingDisposal)
  }, [id, tenantId])

  useEffect(() => { fetchAsset() }, [fetchAsset])
  useEffect(() => { fetchActiveCategories(tenantId).then(setCategories) }, [tenantId])
  useEffect(() => { fetchActiveAssetProducts(tenantId).then(setAssetProducts) }, [tenantId])
  useEffect(() => { loadPendingDisposal() }, [loadPendingDisposal])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  if (!asset) {
    return (
      <div className="space-y-6">
        <PageHeader title="Asset not found" breadcrumb="Assets / Assets" />
        <Card className="p-8 text-center text-slate-500 text-sm">
          This asset does not exist or you do not have access.
        </Card>
      </div>
    )
  }

  const statusInfo = ASSET_STATUS[asset.status] || { label: asset.status, color: 'default' }
  const deprPct = asset.purchase_cost > 0 && (asset.purchase_cost - asset.salvage_value) > 0
    ? Math.min(100, Math.round((asset.accumulated_depreciation / (asset.purchase_cost - asset.salvage_value)) * 100))
    : 0
  const remainingLife = schedules.filter(s => s.status === 'scheduled').length

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'schedule', label: `Depreciation Schedule (${schedules.length})` },
    { id: 'maintenance', label: `Maintenance (${maintenance.length})` },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => navigate('/assets/list')}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700
                       dark:hover:text-slate-300 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />Back to Assets
          </button>
          <p className="text-xs text-slate-500 mb-1">Assets / {asset.asset_number}</p>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">{asset.name}</h1>
            <Badge color={statusInfo.color}>{statusInfo.label}</Badge>
            {pendingDisposal && (
              <Link
                to={`/approval/requests/${pendingDisposal.id}`}
                className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
              >
                {pendingDisposal.request_number} · Disposal Pending
              </Link>
            )}
          </div>
          {asset.asset_categories?.name && (
            <p className="text-sm text-slate-500 mt-0.5">{asset.asset_categories.name}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {asset.status !== 'disposed' && (
            <>
              <PermissionGate action="edit" moduleId="assets">
                <Button variant="secondary" size="sm" onClick={() => setShowEdit(true)}>
                  <Pencil className="w-4 h-4" />Edit
                </Button>
              </PermissionGate>
              {!pendingDisposal && (
                <PermissionGate action="edit" moduleId="assets">
                  <Button variant="danger" size="sm" onClick={() => setShowDispose(true)}>
                    <Trash2 className="w-4 h-4" />Dispose
                  </Button>
                </PermissionGate>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <InfoCard icon={DollarSign} label="Purchase Cost" value={`$${fmt(asset.purchase_cost)}`} color="#f97316" />
        <InfoCard icon={DollarSign} label="Book Value" value={`$${fmt(asset.book_value)}`} color="#8b5cf6" />
        <InfoCard icon={TrendingDown} label="Accumulated Depr." value={`$${fmt(asset.accumulated_depreciation)}`} sub={`${deprPct}% depreciated`} color="#64748b" />
        <InfoCard icon={Calendar} label="Remaining Periods" value={remainingLife > 0 ? `${remainingLife} period${remainingLife !== 1 ? 's' : ''}` : 'Fully depreciated'} color="#10b981" />
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Depreciation Progress</span>
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{deprPct}%</span>
        </div>
        <div className="h-2 rounded-full bg-surface-200 dark:bg-surface-800 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${deprPct}%`, backgroundColor: deprPct >= 100 ? '#64748b' : '#f97316' }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-xs text-slate-500">
          <span>Salvage: ${fmt(asset.salvage_value)}</span>
          <span>{DEPRECIATION_METHODS[asset.depreciation_method]?.label} · {asset.useful_life_years} yr useful life</span>
        </div>
      </Card>

      <div className="flex gap-1 border-b border-surface-200 dark:border-surface-800">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === t.id
                ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && <OverviewTab asset={asset} />}
      {activeTab === 'schedule' && <ScheduleTab schedules={schedules} />}
      {activeTab === 'maintenance' && <MaintenanceTab assetId={asset.id} maintenance={maintenance} />}

      <AssetModal
        open={showEdit} onClose={() => setShowEdit(false)} onSaved={fetchAsset}
        asset={asset} categories={categories} assetProducts={assetProducts}
      />
      <DisposeModal
        open={showDispose} onClose={() => setShowDispose(false)}
        onSaved={() => { fetchAsset(); loadPendingDisposal() }} asset={asset}
      />
    </div>
  )
}
