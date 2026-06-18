import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2, Cpu, Eye } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card,
  Modal, Input, Select, EmptyState,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import {
  PAGE_SIZE_TABLE as PAGE_SIZE,
  ASSET_STATUS,
  ASSET_STATUS_TABS,
  DEPRECIATION_METHODS,
  ASSET_PRODUCT_CATEGORY,
} from '@shared/lib/constants'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function buildDepreciationSchedule(assetId, tenantId, purchaseCost, salvageValue, usefulLifeYears, method, purchaseDate) {
  const cost    = Math.round(parseFloat(purchaseCost)   * 100) / 100
  const salvage = Math.round(parseFloat(salvageValue)   * 100) / 100
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

// ── Validation ────────────────────────────────────────────────────────────────

const assetSchema = z.object({
  name:                z.string().trim().min(1, 'Name is required'),
  description:         z.string().optional(),
  category_id:         z.string().optional(),
  status:              z.enum(['active', 'maintenance', 'disposed', 'fully_depreciated']),
  purchase_date:       z.string().min(1, 'Purchase date is required'),
  purchase_cost:       z.coerce
    .number({ invalid_type_error: 'Enter a valid amount' })
    .positive('Must be greater than 0'),
  salvage_value:       z.coerce
    .number({ invalid_type_error: 'Enter a valid amount' })
    .min(0, 'Must be 0 or more'),
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

const DEFAULT_VALUES = {
  name: '',
  description: '',
  category_id: '',
  status: 'active',
  purchase_date: new Date().toISOString().slice(0, 10),
  purchase_cost: '',
  salvage_value: 0,
  useful_life_years: 5,
  depreciation_method: 'straight_line',
  location: '',
  serial_number: '',
  warranty_expiry: '',
  notes: '',
}

// ── Asset Modal ───────────────────────────────────────────────────────────────

function AssetModal({ open, onClose, onSaved, asset, categories, assetProducts }) {
  const { tenantId } = useTenant()
  const isEdit = Boolean(asset)

  const {
    register, handleSubmit, reset, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(assetSchema), defaultValues: DEFAULT_VALUES })

  const watchedCategoryId   = watch('category_id')
  const watchedName         = watch('name')
  const watchedPurchaseCost = watch('purchase_cost')

  // Auto-fill purchase_cost from the selected product's cost_price
  useEffect(() => {
    if (isEdit || !watchedName) return
    const product = assetProducts.find(p => p.name === watchedName)
    if (product?.cost_price) setValue('purchase_cost', product.cost_price)
  }, [watchedName, assetProducts, isEdit, setValue])

  // Auto-fill depreciation method + useful life when category is selected
  useEffect(() => {
    if (!watchedCategoryId || isEdit) return
    const cat = categories.find(c => c.id === watchedCategoryId)
    if (!cat) return
    setValue('depreciation_method', cat.depreciation_method)
    setValue('useful_life_years',   cat.default_useful_life)
  }, [watchedCategoryId, categories, isEdit, setValue])

  // Auto-fill salvage_value = purchase_cost × default_salvage_rate%
  useEffect(() => {
    if (!watchedCategoryId || isEdit) return
    const cat = categories.find(c => c.id === watchedCategoryId)
    if (!cat) return
    const cost = parseFloat(watchedPurchaseCost) || 0
    if (cost > 0) {
      setValue('salvage_value', Math.round(cost * (cat.default_salvage_rate / 100) * 100) / 100)
    }
  }, [watchedCategoryId, watchedPurchaseCost, categories, isEdit, setValue])

  useEffect(() => {
    if (!open) return
    reset(asset
      ? {
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
        }
      : DEFAULT_VALUES
    )
  }, [open, asset, reset])

  const onSubmit = async (data) => {
    const cost    = parseFloat(data.purchase_cost)
    const salvage = parseFloat(data.salvage_value) || 0
    const years   = parseInt(data.useful_life_years)

    const payload = {
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
    }

    const deprParamsChanged = asset && (
      asset.purchase_cost      !== cost                ||
      asset.salvage_value      !== salvage             ||
      asset.useful_life_years  !== years               ||
      asset.depreciation_method !== data.depreciation_method ||
      asset.purchase_date      !== data.purchase_date
    )

    if (isEdit) {
      const { error } = await supabase.from('assets').update(payload).eq('id', asset.id)
      if (error) { toast.error(error.message); return }

      if (deprParamsChanged) {
        await supabase.from('asset_depreciation_schedules')
          .delete()
          .eq('asset_id', asset.id)
          .eq('status', 'scheduled')

        const schedules = buildDepreciationSchedule(
          asset.id, tenantId, cost, salvage, years, data.depreciation_method, data.purchase_date
        )
        if (schedules.length) {
          await supabase.from('asset_depreciation_schedules').insert(schedules)
        }
      }
      toast.success('Asset updated.')
    } else {
      const { data: num, error: numErr } = await supabase.rpc('generate_asset_number')
      if (numErr) { toast.error(numErr.message); return }

      const { data: newAsset, error } = await supabase
        .from('assets')
        .insert({
          ...payload,
          tenant_id:               tenantId,
          asset_number:            num,
          accumulated_depreciation: 0,
          book_value:              cost,
        })
        .select('id')
        .single()
      if (error) { toast.error(error.message); return }

      const schedules = buildDepreciationSchedule(
        newAsset.id, tenantId, cost, salvage, years, data.depreciation_method, data.purchase_date
      )
      if (schedules.length) {
        const { error: schedErr } = await supabase
          .from('asset_depreciation_schedules')
          .insert(schedules)
        if (schedErr) toast.warning('Asset created but depreciation schedule failed: ' + schedErr.message)
      }
      toast.success('Asset created.')
    }

    onSaved(); onClose()
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEdit ? `Edit ${asset?.asset_number}` : 'New Asset'}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-5">

          {/* Basic info */}
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Basic Information
            </p>
            <div className="space-y-3">
              <Select label="Asset Name" error={errors.name?.message} {...register('name')}>
                <option value="">Select an asset…</option>
                {isEdit && asset?.name && !assetProducts.some(p => p.name === asset.name) && (
                  <option value={asset.name}>{asset.name}</option>
                )}
                {assetProducts.map(p => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Category (optional)" {...register('category_id')}>
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
              <Input
                label="Description (optional)"
                placeholder="Brief description"
                {...register('description')}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Location (optional)"
                  placeholder="e.g. Head Office – Floor 3"
                  {...register('location')}
                />
                <Input
                  label="Serial / Tag No. (optional)"
                  placeholder="e.g. SN-20240001"
                  {...register('serial_number')}
                />
              </div>
            </div>
          </div>

          {/* Financial info */}
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Financial Details
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Purchase Date"
                  type="date"
                  error={errors.purchase_date?.message}
                  {...register('purchase_date')}
                />
                <Input
                  label="Purchase Cost"
                  type="number" min="0" step="0.01"
                  placeholder="0.00"
                  error={errors.purchase_cost?.message}
                  {...register('purchase_cost')}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Salvage Value"
                  type="number" min="0" step="0.01"
                  placeholder="0.00"
                  error={errors.salvage_value?.message}
                  {...register('salvage_value')}
                />
                <Input
                  label="Warranty Expiry (optional)"
                  type="date"
                  {...register('warranty_expiry')}
                />
              </div>
            </div>
          </div>

          {/* Depreciation */}
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Depreciation
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Method" {...register('depreciation_method')}>
                <option value="straight_line">Straight Line</option>
                <option value="declining_balance">Declining Balance (Double)</option>
              </Select>
              <Input
                label="Useful Life (years)"
                type="number" min="1" max="99"
                error={errors.useful_life_years?.message}
                {...register('useful_life_years')}
              />
            </div>
          </div>

          {/* Notes */}
          <Input
            label="Notes (optional)"
            placeholder="Any additional notes"
            {...register('notes')}
          />

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              {isEdit ? 'Save Changes' : 'Create Asset'}
            </Button>
          </div>

        </div>
      </form>
    </Modal>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AssetList() {
  const { tenantId }    = useTenant()
  const [assets,        setAssets]        = useState([])
  const [categories,    setCategories]    = useState([])
  const [assetProducts, setAssetProducts] = useState([])   // products in the "Assets" category
  const [total,         setTotal]         = useState(0)
  const [page,          setPage]          = useState(1)
  const [search,        setSearch]        = useState('')
  const [statusFilter,  setStatusFilter]  = useState('all')
  const [loading,       setLoading]       = useState(true)
  const [showModal,     setShowModal]     = useState(false)
  const [editAsset,     setEditAsset]     = useState(null)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const fetchAssets = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      let query = supabase
        .from('assets')
        .select('*, asset_categories(name)', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (statusFilter !== 'all') query = query.eq('status', statusFilter)
      if (search.trim()) {
        query = query.or(
          `name.ilike.%${search.trim()}%,asset_number.ilike.%${search.trim()}%,serial_number.ilike.%${search.trim()}%`
        )
      }

      const { data, count, error } = await query
      if (error) throw error
      setAssets(data || [])
      setTotal(count || 0)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId, page, search, statusFilter])

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

  useEffect(() => { fetchAssets()        }, [fetchAssets])
  useEffect(() => { fetchCategories()    }, [fetchCategories])
  useEffect(() => { fetchAssetProducts() }, [fetchAssetProducts])
  useEffect(() => { setPage(1) },           [search, statusFilter])

  const openNew    = ()  => { setEditAsset(null); setShowModal(true) }
  const openEdit   = (a) => { setEditAsset(a);    setShowModal(true) }
  const closeModal = ()  => { setShowModal(false); setEditAsset(null) }

  const handleDelete = async (a) => {
    if (!window.confirm(`Delete asset ${a.asset_number}? This will also delete its depreciation schedule. This cannot be undone.`)) return
    const { error } = await supabase.from('assets').delete().eq('id', a.id)
    if (error) { toast.error(error.message); return }
    toast.success('Asset deleted.')
    fetchAssets()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assets"
        subtitle="Fixed asset registry with depreciation tracking"
        breadcrumb="Assets / Assets"
        actions={
          <PermissionGate action="create" moduleId="assets">
            <Button size="sm" onClick={openNew}>
              <Plus className="w-4 h-4" />New Asset
            </Button>
          </PermissionGate>
        }
      />

      <Card>
        {/* Toolbar */}
        <div className="flex items-center gap-3 p-4 border-b border-surface-200 dark:border-surface-800 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-xs
                          px-3 py-2 rounded-lg
                          bg-slate-50 dark:bg-surface-800
                          border border-surface-200 dark:border-surface-700">
            <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, number, serial…"
              className="bg-transparent text-sm text-slate-700 dark:text-slate-300
                         placeholder:text-slate-400 dark:placeholder:text-slate-600
                         flex-1 outline-none"
            />
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-surface-800">
            {ASSET_STATUS_TABS.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  statusFilter === s
                    ? 'bg-white dark:bg-surface-700 text-slate-800 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {s === 'all' ? 'All' : ASSET_STATUS[s]?.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20
                            flex items-center justify-center">
              <Cpu className="w-5 h-5 text-orange-400 animate-pulse" />
            </div>
            <p className="text-sm text-slate-400">Loading assets…</p>
          </div>
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full bg-orange-500/5 dark:bg-orange-500/10 scale-[2.5]" />
              <div className="absolute inset-0 rounded-full bg-orange-500/8 dark:bg-orange-500/15 scale-[1.8]" />
              <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-600/10
                              border border-orange-500/20 flex items-center justify-center">
                {search || statusFilter !== 'all'
                  ? <Search className="w-9 h-9 text-slate-400" />
                  : <Cpu className="w-9 h-9 text-orange-400" />}
              </div>
            </div>
            <h3 className="text-base font-display font-bold text-slate-800 dark:text-slate-200 mb-1">
              {search || statusFilter !== 'all' ? 'No assets match' : 'No assets yet'}
            </h3>
            <p className="text-sm text-slate-500 text-center max-w-xs mb-5">
              {search || statusFilter !== 'all'
                ? 'Try adjusting your search or filter.'
                : 'Register your first fixed asset to start tracking depreciation.'}
            </p>
            {!search && statusFilter === 'all' && (
              <PermissionGate action="create" moduleId="assets">
                <Button size="sm" onClick={openNew}><Plus className="w-4 h-4" />New Asset</Button>
              </PermissionGate>
            )}
          </div>
        ) : (
          <Table>
            <Thead>
              <Th>Asset #</Th>
              <Th>Name</Th>
              <Th>Category</Th>
              <Th>Purchase Date</Th>
              <Th>Cost</Th>
              <Th>Book Value</Th>
              <Th>Status</Th>
              <Th></Th>
            </Thead>
            <Tbody>
              {assets.map(a => {
                const s       = ASSET_STATUS[a.status]
                const deprPct = a.purchase_cost > 0
                  ? Math.round((a.accumulated_depreciation / a.purchase_cost) * 100)
                  : 0
                return (
                  <Tr key={a.id}>
                    <Td>
                      <span className="font-mono text-xs font-medium
                                       text-orange-600 dark:text-orange-400
                                       bg-orange-50 dark:bg-orange-500/10
                                       px-2 py-0.5 rounded-md">
                        {a.asset_number}
                      </span>
                    </Td>
                    <Td>
                      <div>
                        <span className="font-medium text-slate-900 dark:text-slate-100">{a.name}</span>
                        {a.location && (
                          <p className="text-xs text-slate-500 mt-0.5">{a.location}</p>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <span className="text-slate-500 dark:text-slate-400 text-sm">
                        {a.asset_categories?.name || '—'}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-sm text-slate-600 dark:text-slate-400">{a.purchase_date}</span>
                    </Td>
                    <Td>
                      <span className="font-mono text-sm">${fmt(a.purchase_cost)}</span>
                    </Td>
                    <Td>
                      <div>
                        <span className="font-mono text-sm font-semibold text-orange-600 dark:text-orange-400">
                          ${fmt(a.book_value)}
                        </span>
                        <span className="text-xs text-slate-500 ml-1">(-{deprPct}%)</span>
                      </div>
                    </Td>
                    <Td>
                      <Badge color={s?.color || 'default'}>{s?.label || a.status}</Badge>
                    </Td>
                    <Td onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Link to={`/assets/list/${a.id}`}>
                          <Button variant="ghost" size="xs">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                        <PermissionGate action="edit" moduleId="assets">
                          <Button variant="ghost" size="xs" onClick={() => openEdit(a)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate action="delete" moduleId="assets">
                          <Button variant="danger" size="xs" onClick={() => handleDelete(a)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </PermissionGate>
                      </div>
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
          label="assets"
          className="border-t border-surface-200 dark:border-surface-800"
        />
      </Card>

      <AssetModal
        open={showModal}
        onClose={closeModal}
        onSaved={fetchAssets}
        asset={editAsset}
        categories={categories}
        assetProducts={assetProducts}
      />
    </div>
  )
}
