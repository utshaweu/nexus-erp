import { useState, useEffect, useCallback } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Tag, Plus, Search, Pencil, Trash2, ToggleLeft, ToggleRight,
  Gift, CalendarDays, Copy, CheckCircle2,
} from 'lucide-react'
import {
  Button, Badge, Card, Modal, Input, Select, Spinner,
  Table, Thead, Th, Tbody, Tr, Td, PageHeader, StatCard, EmptyState,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import {
  PAGE_SIZE_TABLE as PAGE_SIZE,
  OFFER_TYPES,
  OFFER_STATUS_TABS,
  OFFER_APPLIES_TO_LABELS,
  PRODUCT_CATEGORIES,
} from '@shared/lib/constants'

// ── Helpers ───────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().split('T')[0]

function getEffectiveStatus(offer) {
  const now = today()
  if (!offer.is_active) return 'inactive'
  if (offer.end_date && offer.end_date < now) return 'expired'
  if (offer.start_date && offer.start_date > now) return 'upcoming'
  return 'active'
}

const STATUS_COLORS = { active: 'green', inactive: 'default', expired: 'red', upcoming: 'yellow' }
const STATUS_LABELS = { active: 'Active', inactive: 'Inactive', expired: 'Expired', upcoming: 'Upcoming' }

// ── Zod schema ────────────────────────────────────────────────────────────────

const offerSchema = z.object({
  name:           z.string().trim().min(1, 'Name is required'),
  description:    z.string().trim().optional(),
  offer_type:     z.enum(['percentage', 'fixed_amount', 'buy_x_get_y']),
  discount_value: z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0, 'Must be ≥ 0'),
  coupon_code:    z.string().trim().optional(),
  minimum_amount: z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0).default(0),
  applies_to:     z.enum(['all', 'product', 'category', 'customer']).default('all'),
  applies_to_ref: z.string().trim().optional(),
  start_date:     z.string().optional(),
  end_date:       z.string().optional(),
  usage_limit:    z.coerce.number({ invalid_type_error: 'Enter a number' }).int().min(0).optional(),
  is_active:      z.boolean().default(true),
}).refine(d => {
  if (d.offer_type === 'percentage' && d.discount_value > 100) return false
  return true
}, { message: 'Percentage cannot exceed 100%', path: ['discount_value'] })

const DEFAULT_VALS = {
  name: '', description: '', offer_type: 'percentage', discount_value: 0,
  coupon_code: '', minimum_amount: 0, applies_to: 'all', applies_to_ref: '',
  start_date: '', end_date: '', usage_limit: 0, is_active: true,
}

// ── OfferModal ────────────────────────────────────────────────────────────────

function OfferModal({ open, onClose, offer, onSaved }) {
  const { tenantId } = useTenant()
  const isEdit = Boolean(offer)

  const {
    register, handleSubmit, reset, watch, control,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(offerSchema), defaultValues: DEFAULT_VALS })

  const offerType = watch('offer_type', 'percentage')
  const appliesTo = watch('applies_to', 'all')

  useEffect(() => {
    if (!open) return
    reset(offer ? {
      name:           offer.name           ?? '',
      description:    offer.description    ?? '',
      offer_type:     offer.offer_type     ?? 'percentage',
      discount_value: Number(offer.discount_value) || 0,
      coupon_code:    offer.coupon_code    ?? '',
      minimum_amount: Number(offer.minimum_amount) || 0,
      applies_to:     offer.applies_to     ?? 'all',
      applies_to_ref: offer.applies_to_ref ?? '',
      start_date:     offer.start_date     ?? '',
      end_date:       offer.end_date       ?? '',
      usage_limit:    Number(offer.usage_limit) || 0,
      is_active:      offer.is_active      ?? true,
    } : DEFAULT_VALS)
  }, [open, offer, reset])

  const onSubmit = async (data) => {
    const payload = {
      tenant_id:      tenantId,
      name:           data.name,
      description:    data.description   || null,
      offer_type:     data.offer_type,
      discount_value: data.discount_value,
      coupon_code:    data.coupon_code   ? data.coupon_code.toUpperCase() : null,
      minimum_amount: data.minimum_amount || 0,
      applies_to:     data.applies_to,
      applies_to_ref: data.applies_to !== 'all' ? (data.applies_to_ref || null) : null,
      start_date:     data.start_date   || null,
      end_date:       data.end_date     || null,
      usage_limit:    data.usage_limit  || null,
      is_active:      data.is_active,
    }

    if (isEdit) {
      const { error } = await supabase.from('offers').update(payload).eq('id', offer.id)
      if (error) { toast.error(error.message); return }
      toast.success('Offer updated.')
    } else {
      const { error } = await supabase.from('offers').insert({ ...payload, usage_count: 0 })
      if (error) { toast.error(error.message); return }
      toast.success('Offer created.')
    }
    onSaved()
    onClose()
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? 'Edit Offer' : 'New Offer'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          {/* Name + Description */}
          <Input
            label="Offer Name"
            placeholder="e.g. Summer Sale 20%"
            error={errors.name?.message}
            {...register('name')}
          />

          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1.5">
              Description
            </label>
            <textarea
              rows={2}
              placeholder="Optional description shown to customers…"
              className="w-full px-3 py-2 rounded-lg text-sm
                         text-slate-900 dark:text-slate-200
                         placeholder:text-slate-400 dark:placeholder:text-slate-600
                         bg-white dark:bg-surface-900
                         border border-surface-200 dark:border-surface-700
                         hover:border-surface-300 dark:hover:border-surface-600
                         focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500
                         transition-colors resize-none"
              {...register('description')}
            />
          </div>

          {/* Offer type + Value */}
          <div className="grid grid-cols-2 gap-4">
            <Select label="Offer Type" error={errors.offer_type?.message} {...register('offer_type')}>
              <option value="percentage">Percentage (% off)</option>
              <option value="fixed_amount">Fixed Amount ($ off)</option>
              <option value="buy_x_get_y">Buy X Get Y Free</option>
            </Select>

            <Input
              label={
                offerType === 'percentage'   ? 'Discount %' :
                offerType === 'fixed_amount' ? 'Discount Amount ($)' :
                'Buy (Quantity)'
              }
              type="number"
              step="0.01"
              min="0"
              max={offerType === 'percentage' ? 100 : undefined}
              placeholder={offerType === 'percentage' ? '10' : offerType === 'fixed_amount' ? '50' : '3'}
              error={errors.discount_value?.message}
              {...register('discount_value')}
            />
          </div>

          {offerType === 'buy_x_get_y' && (
            <Input
              label="Get Free (Quantity)"
              type="number"
              step="1"
              min="1"
              placeholder="1"
              {...register('applies_to_ref')}
            />
          )}

          {/* Coupon code + Min amount */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Coupon Code (optional)"
              placeholder="SUMMER20"
              error={errors.coupon_code?.message}
              {...register('coupon_code')}
            />
            <Input
              label="Minimum Order Amount ($)"
              type="number"
              step="0.01"
              min="0"
              placeholder="0"
              {...register('minimum_amount')}
            />
          </div>

          {/* Applies to */}
          {offerType !== 'buy_x_get_y' && (
            <div className="grid grid-cols-2 gap-4">
              <Select label="Applies To" {...register('applies_to')}>
                <option value="all">All Products</option>
                <option value="product">Specific Product</option>
                <option value="category">Category</option>
                <option value="customer">Customer Group</option>
              </Select>

              {appliesTo !== 'all' && appliesTo !== 'buy_x_get_y' && (
                appliesTo === 'category' ? (
                  <Select label="Category" {...register('applies_to_ref')}>
                    <option value="">Select category…</option>
                    {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </Select>
                ) : (
                  <Input
                    label={appliesTo === 'product' ? 'Product Name' : 'Customer Name'}
                    placeholder={appliesTo === 'product' ? 'Product name…' : 'Customer name…'}
                    {...register('applies_to_ref')}
                  />
                )
              )}
            </div>
          )}

          {/* Date range */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date (optional)"
              type="date"
              {...register('start_date')}
            />
            <Input
              label="End Date (optional)"
              type="date"
              {...register('end_date')}
            />
          </div>

          {/* Usage limit + Active toggle */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Usage Limit (0 = unlimited)"
              type="number"
              step="1"
              min="0"
              placeholder="0"
              {...register('usage_limit')}
            />

            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1.5">
                Status
              </label>
              <Controller
                name="is_active"
                control={control}
                render={({ field }) => (
                  <button
                    type="button"
                    onClick={() => field.onChange(!field.value)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                      field.value
                        ? 'bg-emerald-600/20 text-emerald-300 border-emerald-600/40'
                        : 'bg-surface-800 text-slate-400 border-surface-700'
                    }`}
                  >
                    {field.value
                      ? <><ToggleRight className="w-4 h-4" />Active</>
                      : <><ToggleLeft  className="w-4 h-4" />Inactive</>
                    }
                  </button>
                )}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              {isEdit ? 'Save Changes' : 'Create Offer'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

// ── CopyButton (coupon code) ──────────────────────────────────────────────────

function CopyButton({ code }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 font-mono text-xs px-2 py-0.5 rounded bg-surface-700 hover:bg-surface-600 text-slate-300 transition-colors"
      title="Copy coupon code"
    >
      {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      {code}
    </button>
  )
}

// ── OffersDiscounts page ──────────────────────────────────────────────────────

export default function OffersDiscounts() {
  const { tenantId } = useTenant()
  const [offers,       setOffers]       = useState([])
  const [total,        setTotal]        = useState(0)
  const [page,         setPage]         = useState(1)
  const [search,       setSearch]       = useState('')
  const [typeFilter,   setTypeFilter]   = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading,      setLoading]      = useState(true)
  const [showModal,    setShowModal]    = useState(false)
  const [editOffer,    setEditOffer]    = useState(null)
  const [stats,        setStats]        = useState({ active: 0, withCoupon: 0, expiringSoon: 0, totalRedeemed: 0 })

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const fetchOffers = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      let query = supabase
        .from('offers')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      if (search.trim()) {
        query = query.or(`name.ilike.%${search.trim()}%,coupon_code.ilike.%${search.trim()}%`)
      }

      if (typeFilter !== 'all') {
        query = query.eq('offer_type', typeFilter)
      }

      const { data, count, error } = await query
      if (error) throw error

      // Client-side status filter (requires date comparison logic)
      const now = today()
      let filtered = data || []
      if (statusFilter !== 'all') {
        filtered = filtered.filter(o => getEffectiveStatus(o) === statusFilter)
      }

      setOffers(filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE))
      setTotal(statusFilter === 'all' ? (count || 0) : filtered.length)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId, page, search, typeFilter, statusFilter])

  const fetchStats = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase
      .from('offers')
      .select('is_active, coupon_code, end_date, usage_count')
      .eq('tenant_id', tenantId)
    if (!data) return
    const now  = today()
    const soon = new Date()
    soon.setDate(soon.getDate() + 7)
    const soonStr = soon.toISOString().split('T')[0]

    setStats({
      active:       data.filter(o => getEffectiveStatus(o) === 'active').length,
      withCoupon:   data.filter(o => o.coupon_code).length,
      expiringSoon: data.filter(o => o.is_active && o.end_date && o.end_date >= now && o.end_date <= soonStr).length,
      totalRedeemed: data.reduce((a, o) => a + (Number(o.usage_count) || 0), 0),
    })
  }, [tenantId])

  useEffect(() => { fetchOffers() }, [fetchOffers])
  useEffect(() => { fetchStats()  }, [fetchStats])
  useEffect(() => { setPage(1) },    [search, typeFilter, statusFilter])

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete offer "${name}"? This cannot be undone.`)) return
    const { error } = await supabase.from('offers').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Offer deleted.')
    fetchOffers()
    fetchStats()
  }

  const handleToggle = async (offer) => {
    const { error } = await supabase
      .from('offers')
      .update({ is_active: !offer.is_active })
      .eq('id', offer.id)
    if (error) { toast.error(error.message); return }
    toast.success(offer.is_active ? 'Offer deactivated.' : 'Offer activated.')
    fetchOffers()
    fetchStats()
  }

  const openCreate = () => { setEditOffer(null); setShowModal(true) }
  const openEdit   = (o) => { setEditOffer(o);   setShowModal(true) }
  const closeModal = () => { setShowModal(false); setEditOffer(null) }

  const afterSave = () => { fetchOffers(); fetchStats() }

  const discountLabel = (o) => {
    if (o.offer_type === 'percentage')   return `${Number(o.discount_value)}% off`
    if (o.offer_type === 'fixed_amount') return `$${Number(o.discount_value).toLocaleString()} off`
    if (o.offer_type === 'buy_x_get_y')
      return `Buy ${Number(o.discount_value)} get ${o.applies_to_ref || '1'} free`
    return '—'
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offers & Discounts"
        subtitle="Manage promotions, coupons, and discount rules"
        breadcrumb="Sales / Offers"
        actions={
          <PermissionGate action="create" moduleId="sales">
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4" />New Offer
            </Button>
          </PermissionGate>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Offers"
          value={stats.active}
          icon={Tag}
          color="#10b981"
        />
        <StatCard
          label="Coupon Codes"
          value={stats.withCoupon}
          icon={Gift}
          color="#3b82f6"
        />
        <StatCard
          label="Expiring Soon"
          value={stats.expiringSoon}
          icon={CalendarDays}
          color="#f59e0b"
        />
        <StatCard
          label="Total Redeemed"
          value={stats.totalRedeemed}
          icon={CheckCircle2}
          color="#a855f7"
        />
      </div>

      <Card>
        {/* Toolbar */}
        <div className="p-4 border-b border-surface-200 dark:border-surface-800 space-y-3">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="flex items-center gap-2 max-w-xs px-3 py-1.5 rounded-lg
                            bg-surface-100 dark:bg-surface-800
                            border border-surface-200 dark:border-surface-700">
              <Search className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or coupon code…"
                className="bg-transparent text-sm text-slate-700 dark:text-slate-300
                           placeholder:text-slate-400 dark:placeholder:text-slate-600
                           flex-1 outline-none"
              />
            </div>

            {/* Type filter */}
            <div className="flex items-center gap-1.5">
              {['all', 'percentage', 'fixed_amount', 'buy_x_get_y'].map(t => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    typeFilter === t
                      ? 'bg-brand-600/20 text-brand-300 border border-brand-600/30'
                      : 'text-slate-500 hover:text-slate-200'
                  }`}
                >
                  {t === 'all' ? 'All Types' : OFFER_TYPES[t]?.label}
                </button>
              ))}
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-1.5 ml-auto">
              {OFFER_STATUS_TABS.map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    statusFilter === s
                      ? 'bg-brand-600/20 text-brand-300 border border-brand-600/30'
                      : 'text-slate-500 hover:text-slate-200'
                  }`}
                >
                  {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="w-6 h-6" />
          </div>
        ) : offers.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="No offers found"
            description="Create your first promotion or discount rule to attract more customers."
            action={
              <PermissionGate action="create" moduleId="sales">
                <Button size="sm" onClick={openCreate}>
                  <Plus className="w-4 h-4" />New Offer
                </Button>
              </PermissionGate>
            }
          />
        ) : (
          <>
            <Table>
              <Thead>
                <Th>Name</Th>
                <Th>Type</Th>
                <Th>Discount</Th>
                <Th>Coupon Code</Th>
                <Th>Applies To</Th>
                <Th>Valid Period</Th>
                <Th>Usage</Th>
                <Th>Status</Th>
                <Th></Th>
              </Thead>
              <Tbody>
                {offers.map(offer => {
                  const effStatus = getEffectiveStatus(offer)
                  const typeInfo  = OFFER_TYPES[offer.offer_type] || OFFER_TYPES.percentage
                  return (
                    <Tr key={offer.id}>
                      <Td>
                        <div>
                          <p className="font-medium text-slate-200">{offer.name}</p>
                          {offer.description && (
                            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[160px]">{offer.description}</p>
                          )}
                        </div>
                      </Td>
                      <Td>
                        <Badge color={typeInfo.color}>{typeInfo.label}</Badge>
                      </Td>
                      <Td>
                        <span className="font-semibold text-emerald-400">{discountLabel(offer)}</span>
                        {Number(offer.minimum_amount) > 0 && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            Min. ${Number(offer.minimum_amount).toLocaleString()}
                          </p>
                        )}
                      </Td>
                      <Td>
                        {offer.coupon_code
                          ? <CopyButton code={offer.coupon_code} />
                          : <span className="text-slate-600">—</span>
                        }
                      </Td>
                      <Td>
                        <span className="text-sm text-slate-400">
                          {OFFER_APPLIES_TO_LABELS[offer.applies_to] || '—'}
                        </span>
                        {offer.applies_to !== 'all' && offer.applies_to_ref && (
                          <p className="text-xs text-slate-500 mt-0.5">{offer.applies_to_ref}</p>
                        )}
                      </Td>
                      <Td>
                        {offer.start_date || offer.end_date ? (
                          <div className="text-xs text-slate-400 space-y-0.5">
                            {offer.start_date && <div>From: {offer.start_date}</div>}
                            {offer.end_date   && <div>To: {offer.end_date}</div>}
                          </div>
                        ) : (
                          <span className="text-slate-600 text-xs">No limit</span>
                        )}
                      </Td>
                      <Td>
                        <span className="text-sm text-slate-300">
                          {Number(offer.usage_count)}
                          {offer.usage_limit
                            ? <span className="text-slate-500"> / {offer.usage_limit}</span>
                            : <span className="text-slate-600"> / ∞</span>
                          }
                        </span>
                      </Td>
                      <Td>
                        <Badge color={STATUS_COLORS[effStatus]}>
                          {STATUS_LABELS[effStatus]}
                        </Badge>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-1">
                          <PermissionGate action="edit" moduleId="sales">
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => openEdit(offer)}
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => handleToggle(offer)}
                              title={offer.is_active ? 'Deactivate' : 'Activate'}
                              className={offer.is_active ? 'text-yellow-400 hover:text-yellow-300' : 'text-emerald-400 hover:text-emerald-300'}
                            >
                              {offer.is_active
                                ? <ToggleRight className="w-3.5 h-3.5" />
                                : <ToggleLeft  className="w-3.5 h-3.5" />
                              }
                            </Button>
                          </PermissionGate>
                          <PermissionGate action="delete" moduleId="sales">
                            <Button
                              variant="danger"
                              size="xs"
                              onClick={() => handleDelete(offer.id, offer.name)}
                            >
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

            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              total={total}
              pageSize={PAGE_SIZE}
              className="border-t border-surface-200 dark:border-surface-800"
            />
          </>
        )}
      </Card>

      <OfferModal
        open={showModal}
        onClose={closeModal}
        offer={editOffer}
        onSaved={afterSave}
      />
    </div>
  )
}
