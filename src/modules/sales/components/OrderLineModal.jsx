import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal, Button, Input, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { fetchProductSaleOptionsWithCategory } from '../api/products'
import { fetchLineOffers, offerApplies } from '../api/offers'
import { lineMath, saveOrderLine } from '../api/salesOrders'

const lineSchema = z.object({
  product_name:   z.string().trim().min(1, 'Product name is required'),
  quantity:       z.coerce.number({ invalid_type_error: 'Enter a number' }).positive('Must be > 0'),
  unit_price:     z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0, 'Must be ≥ 0'),
  discount_type:  z.enum(['percentage', 'fixed']).default('percentage'),
  discount_value: z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0).default(0),
  tax_rate:       z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0).max(100).default(0),
}).refine(d => !(d.discount_type === 'percentage' && d.discount_value > 100), {
  message: 'Percentage cannot exceed 100%', path: ['discount_value'],
})

export default function OrderLineModal({ open, onClose, line, lines = [], orderId, tenantId, customerName, onSaved }) {
  const isEdit = Boolean(line)
  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(lineSchema),
    defaultValues: { product_name: '', quantity: 1, unit_price: 0, discount_type: 'percentage', discount_value: 0, tax_rate: 0 },
  })

  const watchQty   = watch('quantity', 1)
  const watchPrice = watch('unit_price', 0)
  const watchType  = watch('discount_type', 'percentage')
  const watchValue = watch('discount_value', 0)
  const watchTax   = watch('tax_rate', 0)
  const isFixed    = watchType === 'fixed'

  // Inventory products + applicable offers for the dropdowns
  const [allProducts,     setAllProducts]     = useState([])
  const [selectedProduct, setSelectedProduct] = useState('')
  const [offers,          setOffers]          = useState([])
  const [selectedOffer,   setSelectedOffer]   = useState('')

  // Load active products + currently-valid offers when the modal opens, then seed the form
  useEffect(() => {
    if (!open) return
    let active = true
    Promise.all([
      fetchProductSaleOptionsWithCategory(tenantId),
      fetchLineOffers(tenantId),
    ]).then(([prods, usable]) => {
      if (!active) return
      setAllProducts(prods)
      setOffers(usable)

      reset(line
        ? {
            product_name:   line.product_name,
            quantity:       Number(line.quantity),
            unit_price:     Number(line.unit_price),
            discount_type:  Number(line.discount_amount) > 0 ? 'fixed' : 'percentage',
            discount_value: Number(line.discount_amount) > 0 ? Number(line.discount_amount) : (Number(line.discount_pct) || 0),
            tax_rate:       Number(line.tax_rate) || 0,
          }
        : { product_name: '', quantity: 1, unit_price: 0, discount_type: 'percentage', discount_value: 0, tax_rate: 0 })

      const match = line ? prods.find(p => p.name === line.product_name) : null
      setSelectedProduct(match ? match.id : '')
      setSelectedOffer('')
    })
    return () => { active = false }
  }, [open, line, reset, tenantId])

  const handleProductChange = (e) => {
    const val = e.target.value
    setSelectedProduct(val)
    setSelectedOffer('')        // offer applicability depends on the product
    // Reset discount + tax whenever the product changes
    setValue('discount_type', 'percentage')
    setValue('discount_value', 0)
    setValue('tax_rate', 0)
    const p = allProducts.find(prod => prod.id === val)
    if (p) {
      setValue('product_name', p.name)
      setValue('unit_price', Number(p.sale_price) || 0)
    } else {
      setValue('product_name', '')
    }
  }

  // Offers whose scope (all/product/category/customer) covers the chosen product + order customer
  const selectedProductObj = allProducts.find(p => p.id === selectedProduct) || null
  const applicableOffers   = offers.filter(o => offerApplies(o, selectedProductObj, customerName))

  const handleOfferChange = (e) => {
    const val = e.target.value
    const offer = offers.find(o => o.id === val)
    if (!offer) { setSelectedOffer(''); return }

    const base = (Number(watch('quantity')) || 0) * (Number(watch('unit_price')) || 0)
    if (Number(offer.minimum_amount) > 0 && base < Number(offer.minimum_amount)) {
      toast.error(`Line total must be at least $${Number(offer.minimum_amount).toLocaleString()} for this offer.`)
      setSelectedOffer('')
      return
    }

    setSelectedOffer(val)
    setValue('discount_type', offer.offer_type === 'fixed_amount' ? 'fixed' : 'percentage')
    setValue('discount_value', Number(offer.discount_value) || 0)
  }

  // Live line total preview
  const preview = lineMath({
    quantity:        watchQty,
    unit_price:      watchPrice,
    discount_pct:    isFixed ? 0 : watchValue,
    discount_amount: isFixed ? watchValue : 0,
    tax_rate:        watchTax,
  })
  const qty   = Number(watchQty) || 0
  const price = Number(watchPrice) || 0

  const onSubmit = async (data) => {
    // Block duplicate products on the same order (ignore the edited row and auto-added gift lines)
    const dupe = (lines || []).some(l =>
      !l.is_gift &&
      l.id !== line?.id &&
      (l.product_name || '').trim().toLowerCase() === data.product_name.trim().toLowerCase()
    )
    if (dupe) { toast.error('This item is already on the order.'); return }

    try {
      await saveOrderLine(orderId, tenantId, line, data, isEdit ? null : selectedOffer)
      toast.success(isEdit ? 'Line updated.' : 'Line added.')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleClose = () => { reset(); setSelectedProduct(''); setSelectedOffer(''); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? 'Edit Line Item' : 'Add Line Item'} size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          {/* Product — choose from inventory */}
          <div>
            <Select label="Product / Description" value={selectedProduct} onChange={handleProductChange}>
              <option value="">Select a product…</option>
              {allProducts.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
            {errors.product_name && (
              <p className="text-red-500 dark:text-red-400 text-xs mt-1">{errors.product_name.message}</p>
            )}
          </div>

          {/* Apply an active offer (scoped to this product / customer) → auto-fills the discount */}
          {applicableOffers.length > 0 && (
            <Select label="Apply Offer (optional)" value={selectedOffer} onChange={handleOfferChange}>
              <option value="">— No offer —</option>
              {applicableOffers.map(o => (
                <option key={o.id} value={o.id}>
                  {o.name} — {o.offer_type === 'percentage'
                    ? `${Number(o.discount_value)}% off`
                    : `$${Number(o.discount_value).toLocaleString()} off`}
                </option>
              ))}
            </Select>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Quantity"
              type="number"
              step="0.01"
              min="0.01"
              error={errors.quantity?.message}
              {...register('quantity')}
            />
            <Input
              label="Unit Price ($)"
              type="number"
              step="0.01"
              min="0"
              error={errors.unit_price?.message}
              {...register('unit_price')}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Select label="Discount Type" {...register('discount_type')}>
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed Amount ($)</option>
            </Select>
            <Input
              label={isFixed ? 'Discount ($)' : 'Discount %'}
              type="number"
              step="0.01"
              min="0"
              max={isFixed ? undefined : 100}
              placeholder="0"
              error={errors.discount_value?.message}
              {...register('discount_value')}
            />
            <Input
              label="Tax %"
              type="number"
              step="0.01"
              min="0"
              max="100"
              placeholder="0"
              error={errors.tax_rate?.message}
              {...register('tax_rate')}
            />
          </div>

          {/* Live preview */}
          <div className="rounded-lg bg-surface-100 dark:bg-surface-800 px-4 py-3 text-sm space-y-1">
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Base ({qty} × ${price.toLocaleString()})</span>
              <span>${preview.base.toLocaleString()}</span>
            </div>
            {preview.discount > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Discount ({isFixed ? `$${Number(watchValue) || 0}` : `${Number(watchValue) || 0}%`})</span>
                <span>−${preview.discount.toLocaleString()}</span>
              </div>
            )}
            {preview.tax > 0 && (
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Tax ({Number(watchTax)}%)</span>
                <span>+${preview.tax.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-slate-900 dark:text-slate-100 pt-1 border-t border-surface-200 dark:border-surface-700">
              <span>Line Total</span>
              <span>${preview.total.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              {isEdit ? 'Save Changes' : 'Add Line'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
