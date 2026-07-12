import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ArrowLeft, Pencil, Trash2, Cpu, MapPin, Hash, ShieldCheck,
  Calendar, DollarSign, TrendingDown, Wrench, AlertTriangle,
} from 'lucide-react'
import {
  Button, Badge, Card, CardHeader, CardTitle, CardContent,
  Table, Thead, Th, Tbody, Tr, Td, PageHeader, Modal, Input, Select, Spinner,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import toast from '@shared/lib/toast'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import {
  ASSET_STATUS,
  DEPRECIATION_METHODS,
  ASSET_DEPR_STATUS,
  MAINTENANCE_TYPE,
  MAINTENANCE_STATUS,
  ASSET_PRODUCT_CATEGORY,
} from '@shared/lib/constants'
import { findActiveWorkflow, submitForApproval } from '@shared/lib/approvalWorkflow'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function buildDepreciationSchedule(assetId, tenantId, purchaseCost, salvageValue, usefulLifeYears, method, purchaseDate) {
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
      tenant_id:                tenantId,
      asset_id:                 assetId,
      period_date:              pd.toISOString().slice(0, 10),
      period_label:             `Year ${y}`,
      depreciation_amount:      depr,
      accumulated_depreciation: accDepr,
      book_value_after:         Math.max(bookValue, salvage),
      status:                   'scheduled',
    })
    if (bookValue <= salvage) break
  }
  return schedules
}

// ── Edit Asset Modal ──────────────────────────────────────────────────────────

const assetSchema = z.object({
  name:                z.string().trim().min(1, 'Name is required'),
  description:         z.string().optional(),
  category_id:         z.string().optional(),
  status:              z.enum(['active', 'maintenance', 'disposed', 'fully_depreciated']),
  purchase_date:       z.string().min(1, 'Purchase date is required'),
  purchase_cost:       z.coerce.number({ invalid_type_error: 'Enter a valid amount' }).positive('Must be greater than 0'),
  salvage_value:       z.coerce.number({ invalid_type_error: 'Enter a valid amount' }).min(0, 'Must be 0 or more'),
  useful_life_years:   z.coerce.number().int().min(1, 'Min 1 year').max(99, 'Max 99 years'),
  depreciation_method: z.enum(['straight_line', 'declining_balance']),
  location:            z.string().optional(),
  serial_number:       z.string().optional(),
  warranty_expiry:     z.string().optional(),
  notes:               z.string().optional(),
}).refine(
  d => Number(d.salvage_value) < Number(d.purchase_cost),
  { message: 'Salvage value must be less than purchase cost', path: ['salvage_value'] }
)

function EditAssetModal({ open, onClose, onSaved, asset, categories, assetProducts }) {
  const { tenantId } = useTenant()
  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(assetSchema) })

  useEffect(() => {
    if (!open || !asset) return
    reset({
      name:                asset.name,
      description:         asset.description         || '',
      category_id:         asset.category_id         || '',
      status:              asset.status,
      purchase_date:       asset.purchase_date,
      purchase_cost:       asset.purchase_cost,
      salvage_value:       asset.salvage_value,
      useful_life_years:   asset.useful_life_years,
      depreciation_method: asset.depreciation_method,
      location:            asset.location            || '',
      serial_number:       asset.serial_number       || '',
      warranty_expiry:     asset.warranty_expiry     || '',
      notes:               asset.notes               || '',
    })
  }, [open, asset, reset])

  const onSubmit = async (data) => {
    const cost    = parseFloat(data.purchase_cost)
    const salvage = parseFloat(data.salvage_value) || 0
    const years   = parseInt(data.useful_life_years)

    const deprParamsChanged =
      asset.purchase_cost      !== cost                ||
      asset.salvage_value      !== salvage             ||
      asset.useful_life_years  !== years               ||
      asset.depreciation_method !== data.depreciation_method ||
      asset.purchase_date      !== data.purchase_date

    const { error } = await supabase.from('assets').update({
      name:                data.name,
      description:         data.description    || null,
      category_id:         data.category_id    || null,
      status:              data.status,
      purchase_date:       data.purchase_date,
      purchase_cost:       cost,
      salvage_value:       salvage,
      useful_life_years:   years,
      depreciation_method: data.depreciation_method,
      location:            data.location       || null,
      serial_number:       data.serial_number  || null,
      warranty_expiry:     data.warranty_expiry || null,
      notes:               data.notes          || null,
      updated_at:          new Date().toISOString(),
    }).eq('id', asset.id)

    if (error) { toast.error(error.message); return }

    if (deprParamsChanged) {
      await supabase.from('asset_depreciation_schedules')
        .delete().eq('asset_id', asset.id).eq('status', 'scheduled')
      const schedules = buildDepreciationSchedule(
        asset.id, tenantId, cost, salvage, years, data.depreciation_method, data.purchase_date
      )
      if (schedules.length) {
        await supabase.from('asset_depreciation_schedules').insert(schedules)
      }
    }

    toast.success('Asset updated.')
    onSaved(); onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={`Edit ${asset?.asset_number}`} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Basic Information
            </p>
            <div className="space-y-3">
              <Select label="Asset Name" error={errors.name?.message} {...register('name')}>
                <option value="">Select an asset…</option>
                {asset?.name && !assetProducts.some(p => p.name === asset.name) && (
                  <option value={asset.name}>{asset.name}</option>
                )}
                {assetProducts.map(p => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Category" {...register('category_id')}>
                  <option value="">— None —</option>
                  {categories.filter(c => c.is_active).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
                <Select label="Status" {...register('status')}>
                  {Object.entries(ASSET_STATUS).map(([v, { label }]) => (
                    <option key={v} value={v}>{label}</option>
                  ))}
                </Select>
              </div>
              <Input label="Description" {...register('description')} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Location" {...register('location')} />
                <Input label="Serial / Tag No." {...register('serial_number')} />
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Financial Details
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Purchase Date" type="date" error={errors.purchase_date?.message} {...register('purchase_date')} />
                <Input label="Purchase Cost" type="number" min="0" step="0.01" error={errors.purchase_cost?.message} {...register('purchase_cost')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Salvage Value" type="number" min="0" step="0.01" error={errors.salvage_value?.message} {...register('salvage_value')} />
                <Input label="Warranty Expiry" type="date" {...register('warranty_expiry')} />
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Depreciation
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Method" {...register('depreciation_method')}>
                <option value="straight_line">Straight Line</option>
                <option value="declining_balance">Declining Balance (Double)</option>
              </Select>
              <Input label="Useful Life (years)" type="number" min="1" max="99" error={errors.useful_life_years?.message} {...register('useful_life_years')} />
            </div>
          </div>

          <Input label="Notes" {...register('notes')} />

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>Save Changes</Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

// ── Dispose Modal ─────────────────────────────────────────────────────────────

const disposeSchema = z.object({
  disposal_date:   z.string().min(1, 'Disposal date is required'),
  disposal_amount: z.coerce.number({ invalid_type_error: 'Enter a valid amount' }).min(0),
  notes:           z.string().optional(),
})

function DisposeModal({ open, onClose, onSaved, asset }) {
  const { tenantId } = useTenant()
  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(disposeSchema),
    defaultValues: { disposal_date: new Date().toISOString().slice(0, 10), disposal_amount: 0, notes: '' },
  })

  useEffect(() => { if (open) reset({ disposal_date: new Date().toISOString().slice(0, 10), disposal_amount: 0, notes: '' }) }, [open, reset])

  const onSubmit = async (data) => {
    const disposalFields = {
      disposal_date:   data.disposal_date,
      disposal_amount: parseFloat(data.disposal_amount),
      notes:           data.notes || null,
      updated_at:      new Date().toISOString(),
    }

    let submitted = false
    try {
      const workflow = await findActiveWorkflow(tenantId, 'assets')
      if (workflow) {
        // Stage the proposed disposal details now; the outcome handler flips status once approved.
        const { error: stageErr } = await supabase.from('assets').update(disposalFields).eq('id', asset.id)
        if (stageErr) { toast.error(stageErr.message); return }

        const result = await submitForApproval({
          tenantId, module: 'assets', recordId: asset.id, recordType: 'asset_disposal',
          title: `Dispose Asset — ${asset.name}`,
          description: `${asset.asset_number} · Disposal date ${data.disposal_date} · Amount $${fmt(data.disposal_amount)}${data.notes ? ` · ${data.notes}` : ''}`,
          amount: disposalFields.disposal_amount, priority: 'normal',
          requestedBy: window.__erp_user__?.id,
        })
        submitted = result.submitted
      }
    } catch (err) {
      toast.error(err.message)
    }

    if (!submitted) {
      const { error } = await supabase.from('assets')
        .update({ ...disposalFields, status: 'disposed' })
        .eq('id', asset.id)
      if (error) { toast.error(error.message); return }

      await supabase.from('asset_depreciation_schedules')
        .update({ status: 'cancelled' })
        .eq('asset_id', asset.id)
        .eq('status', 'scheduled')

      toast.success('Asset disposed.')
    } else {
      toast.success('Disposal request submitted for approval.')
    }

    onSaved(); onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Dispose Asset" size="sm">
      <div className="mb-4 flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-red-700 dark:text-red-400">
          This will mark <strong>{asset?.name}</strong> as disposed and cancel all remaining depreciation entries.
        </p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Input
          label="Disposal Date"
          type="date"
          error={errors.disposal_date?.message}
          {...register('disposal_date')}
        />
        <Input
          label="Disposal / Sale Amount"
          type="number" min="0" step="0.01" placeholder="0.00"
          error={errors.disposal_amount?.message}
          {...register('disposal_amount')}
        />
        <Input
          label="Notes (optional)"
          placeholder="Reason for disposal, sale details…"
          {...register('notes')}
        />
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="danger" className="flex-1" loading={isSubmitting}>Dispose Asset</Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Stat Card (local) ─────────────────────────────────────────────────────────

function InfoCard({ icon: Icon, label, value, sub, color = '#f97316' }) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg flex-shrink-0" style={{ backgroundColor: `${color}20`, border: `1px solid ${color}30` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">{label}</p>
          <p className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
        </div>
      </div>
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AssetDetail() {
  const { id }        = useParams()
  const navigate      = useNavigate()
  const { tenantId }  = useTenant()

  const [asset,         setAsset]         = useState(null)
  const [categories,    setCategories]    = useState([])
  const [assetProducts, setAssetProducts] = useState([])   // products in the "Assets" category
  const [schedules,     setSchedules]     = useState([])
  const [maintenance, setMaintenance] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [activeTab,   setActiveTab]   = useState('overview')
  const [showEdit,    setShowEdit]    = useState(false)
  const [showDispose, setShowDispose] = useState(false)
  const [pendingDisposal, setPendingDisposal] = useState(null)

  const fetchAsset = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [assetRes, schedRes, maintRes] = await Promise.all([
        supabase
          .from('assets')
          .select('*, asset_categories(name)')
          .eq('id', id)
          .single(),
        supabase
          .from('asset_depreciation_schedules')
          .select('*')
          .eq('asset_id', id)
          .order('period_date', { ascending: true }),
        supabase
          .from('asset_maintenance_logs')
          .select('*')
          .eq('asset_id', id)
          .order('scheduled_date', { ascending: false })
          .limit(5),
      ])

      if (assetRes.error) throw assetRes.error
      setAsset(assetRes.data)
      setSchedules(schedRes.data || [])
      setMaintenance(maintRes.data || [])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  const fetchCategories = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase
      .from('asset_categories')
      .select('id, name, depreciation_method, default_useful_life, default_salvage_rate, is_active')
      .eq('tenant_id', tenantId)
      .order('name')
    setCategories(data || [])
  }, [tenantId])

  const fetchAssetProducts = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase
      .from('products')
      .select('id, name, cost_price')
      .eq('tenant_id', tenantId)
      .eq('category', ASSET_PRODUCT_CATEGORY)
      .order('name')
    setAssetProducts(data || [])
  }, [tenantId])

  const fetchPendingDisposal = useCallback(async () => {
    if (!id || !tenantId) return
    const { data } = await supabase
      .from('approval_requests')
      .select('id, request_number')
      .eq('tenant_id', tenantId).eq('module', 'assets')
      .eq('record_type', 'asset_disposal').eq('record_id', id)
      .eq('status', 'pending').maybeSingle()
    setPendingDisposal(data || null)
  }, [id, tenantId])

  useEffect(() => { fetchAsset() },         [fetchAsset])
  useEffect(() => { fetchCategories() },    [fetchCategories])
  useEffect(() => { fetchAssetProducts() }, [fetchAssetProducts])
  useEffect(() => { fetchPendingDisposal() }, [fetchPendingDisposal])

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

  const statusInfo  = ASSET_STATUS[asset.status] || { label: asset.status, color: 'default' }
  const deprPct     = asset.purchase_cost > 0 && (asset.purchase_cost - asset.salvage_value) > 0
    ? Math.min(100, Math.round((asset.accumulated_depreciation / (asset.purchase_cost - asset.salvage_value)) * 100))
    : 0
  const remainingLife = schedules.filter(s => s.status === 'scheduled').length

  const TABS = [
    { id: 'overview',   label: 'Overview'              },
    { id: 'schedule',   label: `Depreciation Schedule (${schedules.length})`   },
    { id: 'maintenance', label: `Maintenance (${maintenance.length})`          },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
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
            <h1 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">
              {asset.name}
            </h1>
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

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <InfoCard icon={DollarSign} label="Purchase Cost"        value={`$${fmt(asset.purchase_cost)}`}          color="#f97316" />
        <InfoCard icon={DollarSign} label="Book Value"           value={`$${fmt(asset.book_value)}`}             color="#8b5cf6" />
        <InfoCard icon={TrendingDown} label="Accumulated Depr."  value={`$${fmt(asset.accumulated_depreciation)}`} sub={`${deprPct}% depreciated`} color="#64748b" />
        <InfoCard icon={Calendar}   label="Remaining Periods"    value={remainingLife > 0 ? `${remainingLife} period${remainingLife !== 1 ? 's' : ''}` : 'Fully depreciated'} color="#10b981" />
      </div>

      {/* Depreciation progress */}
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
          <span>
            {DEPRECIATION_METHODS[asset.depreciation_method]?.label} · {asset.useful_life_years} yr useful life
          </span>
        </div>
      </Card>

      {/* Tabs */}
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

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Asset Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 pt-0">
              {[
                { icon: Hash,        label: 'Asset Number',    value: asset.asset_number },
                { icon: Calendar,    label: 'Purchase Date',   value: asset.purchase_date },
                { icon: MapPin,      label: 'Location',        value: asset.location || '—' },
                { icon: Hash,        label: 'Serial / Tag No.', value: asset.serial_number || '—' },
                { icon: ShieldCheck, label: 'Warranty Expiry', value: asset.warranty_expiry || '—' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 py-2 border-b border-surface-100 dark:border-surface-800 last:border-0">
                  <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-xs text-slate-500 w-32 flex-shrink-0">{label}</span>
                  <span className="text-sm text-slate-800 dark:text-slate-200 font-medium">{value}</span>
                </div>
              ))}
              {asset.description && (
                <div className="pt-1">
                  <p className="text-xs text-slate-500 mb-1">Description</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{asset.description}</p>
                </div>
              )}
              {asset.notes && (
                <div className="pt-1">
                  <p className="text-xs text-slate-500 mb-1">Notes</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{asset.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Financial Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3 pt-0">
              {[
                { label: 'Purchase Cost',          value: `$${fmt(asset.purchase_cost)}` },
                { label: 'Salvage Value',           value: `$${fmt(asset.salvage_value)}` },
                { label: 'Depreciable Amount',      value: `$${fmt(asset.purchase_cost - asset.salvage_value)}` },
                { label: 'Accumulated Depreciation', value: `$${fmt(asset.accumulated_depreciation)}` },
                { label: 'Current Book Value',      value: `$${fmt(asset.book_value)}` },
                { label: 'Depreciation Method',     value: DEPRECIATION_METHODS[asset.depreciation_method]?.label || asset.depreciation_method },
                { label: 'Useful Life',             value: `${asset.useful_life_years} year${asset.useful_life_years !== 1 ? 's' : ''}` },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-surface-100 dark:border-surface-800 last:border-0">
                  <span className="text-xs text-slate-500">{label}</span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{value}</span>
                </div>
              ))}
              {asset.status === 'disposed' && (
                <div className="pt-2 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">Disposed</p>
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Date: {asset.disposal_date} · Amount: ${fmt(asset.disposal_amount)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Depreciation Schedule */}
      {activeTab === 'schedule' && (
        <Card>
          <CardHeader><CardTitle>Depreciation Schedule</CardTitle></CardHeader>
          <CardContent className="pt-0 px-0">
            {schedules.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm">No depreciation schedule found.</div>
            ) : (
              <Table>
                <Thead>
                  <Th>Period</Th>
                  <Th>Date</Th>
                  <Th>Depreciation</Th>
                  <Th>Accumulated</Th>
                  <Th>Book Value After</Th>
                  <Th>Status</Th>
                </Thead>
                <Tbody>
                  {schedules.map((s) => {
                    const st = ASSET_DEPR_STATUS[s.status]
                    return (
                      <Tr key={s.id}>
                        <Td><span className="font-medium text-slate-700 dark:text-slate-300">{s.period_label}</span></Td>
                        <Td><span className="text-sm text-slate-500">{s.period_date}</span></Td>
                        <Td><span className="font-mono text-sm">${fmt(s.depreciation_amount)}</span></Td>
                        <Td><span className="font-mono text-sm">${fmt(s.accumulated_depreciation)}</span></Td>
                        <Td>
                          <span className="font-mono text-sm font-semibold text-orange-600 dark:text-orange-400">
                            ${fmt(s.book_value_after)}
                          </span>
                        </Td>
                        <Td>
                          <Badge color={st?.color || 'default'}>{st?.label || s.status}</Badge>
                        </Td>
                      </Tr>
                    )
                  })}
                </Tbody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Maintenance */}
      {activeTab === 'maintenance' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Maintenance History</CardTitle>
              <a
                href={`/assets/maintenance?asset=${asset.id}`}
                className="text-xs text-orange-500 hover:text-orange-400 transition-colors"
              >
                View all →
              </a>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-0">
            {maintenance.length === 0 ? (
              <div className="py-12 text-center">
                <Wrench className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-500">No maintenance records found.</p>
              </div>
            ) : (
              <Table>
                <Thead>
                  <Th>Log #</Th>
                  <Th>Type</Th>
                  <Th>Scheduled</Th>
                  <Th>Cost</Th>
                  <Th>Performed By</Th>
                  <Th>Status</Th>
                </Thead>
                <Tbody>
                  {maintenance.map(m => {
                    const mt = MAINTENANCE_TYPE[m.maintenance_type]
                    const ms = MAINTENANCE_STATUS[m.status]
                    return (
                      <Tr key={m.id}>
                        <Td>
                          <span className="font-mono text-xs font-medium text-orange-600 dark:text-orange-400
                                           bg-orange-50 dark:bg-orange-500/10 px-2 py-0.5 rounded-md">
                            {m.log_number}
                          </span>
                        </Td>
                        <Td><Badge color={mt?.color || 'default'}>{mt?.label || m.maintenance_type}</Badge></Td>
                        <Td><span className="text-sm text-slate-500">{m.scheduled_date}</span></Td>
                        <Td><span className="font-mono text-sm">${fmt(m.cost)}</span></Td>
                        <Td><span className="text-sm text-slate-500">{m.performed_by || '—'}</span></Td>
                        <Td><Badge color={ms?.color || 'default'}>{ms?.label || m.status}</Badge></Td>
                      </Tr>
                    )
                  })}
                </Tbody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <EditAssetModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        onSaved={fetchAsset}
        asset={asset}
        categories={categories}
        assetProducts={assetProducts}
      />
      <DisposeModal
        open={showDispose}
        onClose={() => setShowDispose(false)}
        onSaved={() => { fetchAsset(); fetchPendingDisposal() }}
        asset={asset}
      />
    </div>
  )
}
