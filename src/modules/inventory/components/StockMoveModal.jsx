import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeftRight, ArrowDown, ArrowUp, SlidersHorizontal, MoveRight } from 'lucide-react'
import { Button, Modal, Input, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { STOCK_MOVE_TYPES } from '@shared/lib/constants'
import { createStockMove, fetchActiveProductOptions } from '../api/stockMoves'
import { fetchActiveWarehouseOptions } from '../api/warehouses'

export const MOVE_ICONS = {
  incoming:   ArrowDown,
  outgoing:   ArrowUp,
  internal:   ArrowLeftRight,
  adjustment: SlidersHorizontal,
}

export const MOVE_BG = {
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

const DEFAULT_VALUES = {
  product_id: '', move_type: 'incoming', quantity: '',
  source_warehouse_id: '', dest_warehouse_id: '',
  reference: '', move_date: new Date().toISOString().split('T')[0],
}

export default function StockMoveModal({ open, onClose, onSaved }) {
  const { tenantId }   = useTenant()
  const [products,   setProducts]   = useState([])
  const [warehouses, setWarehouses] = useState([])

  const {
    register, handleSubmit, reset, watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(moveSchema), defaultValues: DEFAULT_VALUES })

  const moveType = watch('move_type')

  useEffect(() => {
    if (!open || !tenantId) return
    fetchActiveProductOptions(tenantId).then(setProducts)
    fetchActiveWarehouseOptions(tenantId).then(setWarehouses)
  }, [open, tenantId])

  useEffect(() => {
    if (open) reset(DEFAULT_VALUES)
  }, [open, reset])

  const onSubmit = async (data) => {
    try {
      await createStockMove(tenantId, data)
      toast.success('Stock move recorded.')
      onSaved(); onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleClose = () => { reset(); onClose() }
  const needsSource = moveType === 'outgoing' || moveType === 'internal'
  const needsDest   = moveType !== 'outgoing'

  return (
    <Modal open={open} onClose={handleClose} title="New Stock Move" size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-5">

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
