import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus, ArrowLeftRight, ArrowDown, ArrowUp, SlidersHorizontal,
  MoveRight, Calendar,
} from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card,
  Modal, Input, Select, Spinner,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import {
  PAGE_SIZE_TABLE as PAGE_SIZE,
  STOCK_MOVE_TYPES,
  STOCK_MOVE_TYPE_TABS,
} from '@shared/lib/constants'

const MOVE_ICONS = {
  incoming:   ArrowDown,
  outgoing:   ArrowUp,
  internal:   ArrowLeftRight,
  adjustment: SlidersHorizontal,
}

const MOVE_BG = {
  incoming:   'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
  outgoing:   'bg-red-50    dark:bg-red-500/10    text-red-600    dark:text-red-400    border-red-200    dark:border-red-500/20',
  internal:   'bg-blue-50   dark:bg-blue-500/10   text-blue-600   dark:text-blue-400   border-blue-200   dark:border-blue-500/20',
  adjustment: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20',
}

const moveSchema = z.object({
  product_id:          z.string().min(1, 'Product is required'),
  move_type:           z.enum(['incoming', 'outgoing', 'internal', 'adjustment']),
  quantity:            z.coerce.number({ invalid_type_error: 'Enter a valid quantity' }).positive('Quantity must be > 0'),
  source_warehouse_id: z.string().optional(),
  dest_warehouse_id:   z.string().optional(),
  reference:           z.string().trim().optional(),
  move_date:           z.string().min(1, 'Date is required'),
}).superRefine((data, ctx) => {
  if (data.move_type === 'outgoing' || data.move_type === 'internal') {
    if (!data.source_warehouse_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['source_warehouse_id'], message: 'Source warehouse required' })
    }
  }
  if (data.move_type !== 'outgoing') {
    if (!data.dest_warehouse_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dest_warehouse_id'], message: 'Destination warehouse required' })
    }
  }
})

// ── StockMoveModal ────────────────────────────────────────────────────────────

function StockMoveModal({ open, onClose, onSaved }) {
  const { tenantId }   = useTenant()
  const [products,   setProducts]   = useState([])
  const [warehouses, setWarehouses] = useState([])

  const {
    register, handleSubmit, reset, watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(moveSchema),
    defaultValues: {
      product_id: '', move_type: 'incoming', quantity: '',
      source_warehouse_id: '', dest_warehouse_id: '',
      reference: '', move_date: new Date().toISOString().split('T')[0],
    },
  })

  const moveType = watch('move_type')

  useEffect(() => {
    if (!open || !tenantId) return
    Promise.all([
      supabase.from('products').select('id, name, sku').eq('tenant_id', tenantId).eq('status', 'active').order('name'),
      supabase.from('warehouses').select('id, name, code').eq('tenant_id', tenantId).eq('status', 'active').order('name'),
    ]).then(([pRes, wRes]) => {
      if (!pRes.error) setProducts(pRes.data || [])
      if (!wRes.error) setWarehouses(wRes.data || [])
    })
  }, [open, tenantId])

  useEffect(() => {
    if (open) reset({
      product_id: '', move_type: 'incoming', quantity: '',
      source_warehouse_id: '', dest_warehouse_id: '',
      reference: '', move_date: new Date().toISOString().split('T')[0],
    })
  }, [open, reset])

  const onSubmit = async (data) => {
    const { data: moveNum, error: rpcErr } = await supabase.rpc('generate_stock_number')
    if (rpcErr) { toast.error('Failed to generate move number.'); return }

    const { error } = await supabase.from('stock_moves').insert({
      tenant_id:           tenantId,
      move_number:         moveNum,
      product_id:          data.product_id,
      move_type:           data.move_type,
      quantity:            data.quantity,
      source_warehouse_id: data.source_warehouse_id || null,
      dest_warehouse_id:   data.dest_warehouse_id   || null,
      reference:           data.reference           || null,
      move_date:           data.move_date,
    })
    if (error) { toast.error(error.message); return }
    toast.success('Stock move recorded.')
    onSaved(); onClose()
  }

  const handleClose = () => { reset(); onClose() }
  const needsSource = moveType === 'outgoing' || moveType === 'internal'
  const needsDest   = moveType !== 'outgoing'

  const moveTypeCfg = STOCK_MOVE_TYPES[moveType]

  return (
    <Modal open={open} onClose={handleClose} title="New Stock Move" size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-5">

          {/* Move type selector — visual cards */}
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
              Move Type
            </p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(STOCK_MOVE_TYPES).map(([key, cfg]) => {
                const Icon = MOVE_ICONS[key]
                const isSelected = moveType === key
                return (
                  <label
                    key={key}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 cursor-pointer
                                transition-all text-sm font-medium ${
                      isSelected
                        ? `${MOVE_BG[key]} border-current`
                        : 'border-surface-200 dark:border-surface-700 text-slate-600 dark:text-slate-400 hover:border-surface-300 dark:hover:border-surface-600'
                    }`}
                  >
                    <input type="radio" className="sr-only" value={key} {...register('move_type')} />
                    {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
                    <span>{cfg.label}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <Select
            label="Product"
            error={errors.product_id?.message}
            {...register('product_id')}
          >
            <option value="">Select product…</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
            ))}
          </Select>

          <Input
            label="Quantity"
            type="number" step="0.01" min="0.01" placeholder="0"
            error={errors.quantity?.message}
            {...register('quantity')}
          />

          {/* Warehouse row */}
          {(needsSource || needsDest) && (
            <div className="rounded-xl bg-slate-50 dark:bg-surface-800/60 p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Route
              </p>
              <div className={`grid gap-3 items-center ${needsSource && needsDest ? 'grid-cols-[1fr_auto_1fr]' : 'grid-cols-1'}`}>
                {needsSource && (
                  <Select
                    label="From Warehouse"
                    error={errors.source_warehouse_id?.message}
                    {...register('source_warehouse_id')}
                  >
                    <option value="">Select…</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                  </Select>
                )}
                {needsSource && needsDest && (
                  <div className="pt-5 flex justify-center">
                    <MoveRight className="w-5 h-5 text-slate-400" />
                  </div>
                )}
                {needsDest && (
                  <Select
                    label="To Warehouse"
                    error={errors.dest_warehouse_id?.message}
                    {...register('dest_warehouse_id')}
                  >
                    <option value="">Select…</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                  </Select>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Reference (optional)"
              placeholder="e.g. PO-2024-001"
              {...register('reference')}
            />
            <Input
              label="Move Date"
              type="date"
              error={errors.move_date?.message}
              {...register('move_date')}
            />
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>Cancel</Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>Record Move</Button>
          </div>

        </div>
      </form>
    </Modal>
  )
}

// ── Stat chip ─────────────────────────────────────────────────────────────────

function StatChip({ value, label, color }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg
                    bg-slate-50 dark:bg-surface-800
                    border border-surface-200 dark:border-surface-700">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{value}</span>
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StockMoves() {
  const { tenantId } = useTenant()
  const [moves,      setMoves]      = useState([])
  const [total,      setTotal]      = useState(0)
  const [page,       setPage]       = useState(1)
  const [typeFilter, setTypeFilter] = useState('all')
  const [loading,    setLoading]    = useState(true)
  const [showModal,  setShowModal]  = useState(false)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const fetchMoves = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      let query = supabase
        .from('stock_moves')
        .select(`
          *,
          product:products(name, sku),
          source_warehouse:warehouses!source_warehouse_id(name, code),
          dest_warehouse:warehouses!dest_warehouse_id(name, code)
        `, { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('move_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (typeFilter !== 'all') query = query.eq('move_type', typeFilter)

      const { data, count, error } = await query
      if (error) throw error
      setMoves(data || [])
      setTotal(count || 0)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId, page, typeFilter])

  useEffect(() => { fetchMoves() }, [fetchMoves])
  useEffect(() => { setPage(1) }, [typeFilter])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Movements"
        subtitle="Track every inventory in / out / internal move"
        breadcrumb="Inventory / Stock Moves"
        actions={
          <PermissionGate action="create" moduleId="inventory">
            <Button size="sm" onClick={() => setShowModal(true)} className="gap-1.5">
              <Plus className="w-4 h-4" />New Move
            </Button>
          </PermissionGate>
        }
      />

      {/* Summary chips */}
      {!loading && total > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <StatChip value={total} label="Total Moves" color="#6366f1" />
          {Object.entries(STOCK_MOVE_TYPES).map(([key, cfg]) => {
            const count = typeFilter === key ? moves.length : undefined
            if (count === undefined) return null
            return <StatChip key={key} value={count} label={cfg.label} color={
              key === 'incoming' ? '#10b981' : key === 'outgoing' ? '#ef4444' :
              key === 'internal' ? '#3b82f6' : '#a855f7'
            } />
          })}
        </div>
      )}

      <Card>
        {/* Type filter tabs */}
        <div className="flex items-center gap-3 p-4 border-b border-surface-200 dark:border-surface-800 flex-wrap">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-surface-800">
            {STOCK_MOVE_TYPE_TABS.map(t => {
              const cfg  = t !== 'all' ? STOCK_MOVE_TYPES[t] : null
              const Icon = t !== 'all' ? MOVE_ICONS[t]       : ArrowLeftRight
              return (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    typeFilter === t
                      ? 'bg-white dark:bg-surface-700 text-slate-800 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {t === 'all' ? 'All' : cfg?.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20
                            flex items-center justify-center">
              <ArrowLeftRight className="w-5 h-5 text-indigo-400 animate-pulse" />
            </div>
            <p className="text-sm text-slate-400">Loading stock moves…</p>
          </div>
        ) : moves.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full bg-indigo-500/5 dark:bg-indigo-500/10 scale-[2.5]" />
              <div className="absolute inset-0 rounded-full bg-indigo-500/8 dark:bg-indigo-500/15 scale-[1.8]" />
              <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-blue-600/10
                              border border-indigo-500/20 flex items-center justify-center">
                <ArrowLeftRight className="w-9 h-9 text-indigo-400" />
              </div>
            </div>
            <h3 className="text-base font-display font-bold text-slate-800 dark:text-slate-200 mb-1">
              {typeFilter !== 'all' ? 'No moves of this type' : 'No stock moves yet'}
            </h3>
            <p className="text-sm text-slate-500 text-center max-w-xs mb-5">
              {typeFilter !== 'all'
                ? 'Try selecting a different type filter.'
                : 'Record your first stock movement to start tracking inventory flow.'}
            </p>
            {typeFilter === 'all' && (
              <PermissionGate action="create" moduleId="inventory">
                <Button size="sm" onClick={() => setShowModal(true)} className="gap-1.5">
                  <Plus className="w-4 h-4" />Record First Move
                </Button>
              </PermissionGate>
            )}
          </div>
        ) : (
          <Table>
            <Thead>
              <Th>Move #</Th>
              <Th>Type</Th>
              <Th>Product</Th>
              <Th>Qty</Th>
              <Th>Route</Th>
              <Th>Date</Th>
              <Th>Reference</Th>
            </Thead>
            <Tbody>
              {moves.map(m => {
                const cfg      = STOCK_MOVE_TYPES[m.move_type] || { label: m.move_type, color: 'default' }
                const TypeIcon = MOVE_ICONS[m.move_type]
                const from     = m.source_warehouse?.name
                const to       = m.dest_warehouse?.name
                return (
                  <Tr key={m.id}>
                    <Td>
                      <span className="font-mono text-xs font-medium text-indigo-600 dark:text-indigo-400
                                       bg-indigo-50 dark:bg-indigo-500/10
                                       px-2 py-0.5 rounded-md">
                        {m.move_number}
                      </span>
                    </Td>
                    <Td>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium
                                        px-2 py-0.5 rounded-md border ${MOVE_BG[m.move_type] || ''}`}>
                        {TypeIcon && <TypeIcon className="w-3 h-3" />}
                        {cfg.label}
                      </span>
                    </Td>
                    <Td>
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {m.product?.name || '—'}
                        </span>
                        {m.product?.sku && (
                          <p className="text-xs text-slate-400 font-mono mt-0.5">{m.product.sku}</p>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {Number(m.quantity)}
                      </span>
                    </Td>
                    <Td>
                      {from || to ? (
                        <div className="flex items-center gap-1.5 text-sm">
                          {from && <span className="text-slate-500">{from}</span>}
                          {from && to && <MoveRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
                          {to   && <span className="text-slate-700 dark:text-slate-300 font-medium">{to}</span>}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </Td>
                    <Td>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <Calendar className="w-3 h-3" />{m.move_date}
                      </span>
                    </Td>
                    <Td>
                      <span className="font-mono text-xs text-slate-400">{m.reference || '—'}</span>
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
          label="moves"
          className="border-t border-surface-200 dark:border-surface-800"
        />
      </Card>

      <StockMoveModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSaved={fetchMoves}
      />
    </div>
  )
}
