import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ToggleLeft, ToggleRight } from 'lucide-react'
import { Modal, Button, Input, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { PRODUCT_CATEGORIES } from '@shared/lib/constants'
import { fetchProductNameOptions } from '../api/products'
import { fetchActiveCustomerOptions } from '../api/customers'
import { saveOffer } from '../api/offers'

const offerSchema = z.object({
  name:           z.string().trim().min(1, 'Name is required'),
  description:    z.string().trim().optional(),
  offer_type:     z.enum(['percentage', 'fixed_amount', 'buy_x_get_y']),
  discount_value: z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0, 'Must be ≥ 0').default(0),
  coupon_code:    z.string().trim().optional(),
  minimum_amount: z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0).default(0),
  applies_to:     z.enum(['all', 'product', 'category', 'customer']).default('all'),
  applies_to_ref: z.string().trim().optional(),
  // Buy X Get Y Free — which product/qty to buy, which product/qty is free
  buy_product:    z.string().trim().optional(),
  buy_qty:        z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0).default(1),
  get_product:    z.string().trim().optional(),
  get_qty:        z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0).default(1),
  start_date:     z.string().optional(),
  end_date:       z.string().optional(),
  usage_limit:    z.coerce.number({ invalid_type_error: 'Enter a number' }).int().min(0).optional(),
  is_active:      z.boolean().default(true),
})
  .refine(d => !(d.offer_type === 'percentage' && d.discount_value > 100),
    { message: 'Percentage cannot exceed 100%', path: ['discount_value'] })
  .refine(d => d.offer_type !== 'buy_x_get_y' || !!d.buy_product,
    { message: 'Select the product to buy', path: ['buy_product'] })
  .refine(d => d.offer_type !== 'buy_x_get_y' || d.buy_qty >= 1,
    { message: 'Must be ≥ 1', path: ['buy_qty'] })
  .refine(d => d.offer_type !== 'buy_x_get_y' || !!d.get_product,
    { message: 'Select the free product', path: ['get_product'] })
  .refine(d => d.offer_type !== 'buy_x_get_y' || d.get_qty >= 1,
    { message: 'Must be ≥ 1', path: ['get_qty'] })

const DEFAULT_VALS = {
  name: '', description: '', offer_type: 'percentage', discount_value: 0,
  coupon_code: '', minimum_amount: 0, applies_to: 'all', applies_to_ref: '',
  buy_product: '', buy_qty: 1, get_product: '', get_qty: 1,
  start_date: '', end_date: '', usage_limit: 0, is_active: true,
}

export default function OfferModal({ open, onClose, offer, onSaved }) {
  const { tenantId } = useTenant()
  const isEdit = Boolean(offer)

  const {
    register, handleSubmit, reset, watch, control,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(offerSchema), defaultValues: DEFAULT_VALS })

  const offerType = watch('offer_type', 'percentage')
  const appliesTo = watch('applies_to', 'all')

  // Products + customers for the "applies to" dropdowns
  const [products,  setProducts]  = useState([])
  const [customers, setCustomers] = useState([])

  useEffect(() => {
    if (!open || !tenantId) return
    let active = true
    Promise.all([
      fetchProductNameOptions(tenantId),
      fetchActiveCustomerOptions(tenantId),
    ]).then(([prods, custs]) => {
      if (!active) return
      setProducts(prods)
      setCustomers(custs)
    })
    return () => { active = false }
  }, [open, tenantId])

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
      buy_product:    offer.buy_product_name ?? '',
      buy_qty:        Number(offer.buy_quantity) || 1,
      get_product:    offer.get_product_name ?? '',
      get_qty:        Number(offer.get_quantity) || 1,
      start_date:     offer.start_date     ?? '',
      end_date:       offer.end_date       ?? '',
      usage_limit:    Number(offer.usage_limit) || 0,
      is_active:      offer.is_active      ?? true,
    } : DEFAULT_VALS)
  }, [open, offer, reset])

  const onSubmit = async (data) => {
    try {
      await saveOffer(tenantId, offer, data)
      toast.success(isEdit ? 'Offer updated.' : 'Offer created.')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err.message)
    }
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

            {offerType !== 'buy_x_get_y' && (
              <Input
                label={offerType === 'percentage' ? 'Discount %' : 'Discount Amount ($)'}
                type="number"
                step="0.01"
                min="0"
                max={offerType === 'percentage' ? 100 : undefined}
                placeholder={offerType === 'percentage' ? '10' : '50'}
                error={errors.discount_value?.message}
                {...register('discount_value')}
              />
            )}
          </div>

          {offerType === 'buy_x_get_y' && (
            <div className="rounded-lg border border-surface-200 dark:border-surface-700 p-4 space-y-3">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Buy X Get Y Free — pick the items &amp; quantities
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Select label="Buy Product" error={errors.buy_product?.message} {...register('buy_product')}>
                  <option value="">Select product…</option>
                  {products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </Select>
                <Input
                  label="Buy Quantity"
                  type="number"
                  step="1"
                  min="1"
                  placeholder="3"
                  error={errors.buy_qty?.message}
                  {...register('buy_qty')}
                />
                <Select label="Get Free Product" error={errors.get_product?.message} {...register('get_product')}>
                  <option value="">Select product…</option>
                  {products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </Select>
                <Input
                  label="Get Free Quantity"
                  type="number"
                  step="1"
                  min="1"
                  placeholder="1"
                  error={errors.get_qty?.message}
                  {...register('get_qty')}
                />
              </div>
            </div>
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
                ) : appliesTo === 'product' ? (
                  <Select label="Product" {...register('applies_to_ref')}>
                    <option value="">Select product…</option>
                    {products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </Select>
                ) : (
                  <Select label="Customer" {...register('applies_to_ref')}>
                    <option value="">Select customer…</option>
                    {customers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </Select>
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
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-600/20 dark:text-emerald-300 dark:border-emerald-600/40'
                        : 'bg-surface-100 text-slate-500 border-surface-200 dark:bg-surface-800 dark:text-slate-400 dark:border-surface-700'
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
