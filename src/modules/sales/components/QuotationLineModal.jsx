import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal, Button, Input, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { fetchProductSaleOptions } from '../api/products'
import { lineMath, saveQuotationLine } from '../api/quotations'

const lineSchema = z.object({
  product_name: z.string().trim().min(1, 'Product is required'),
  quantity:     z.coerce.number({ invalid_type_error: 'Enter a number' }).positive('Must be > 0'),
  unit_price:   z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0, 'Must be ≥ 0'),
  discount_pct: z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0).max(100).default(0),
  tax_rate:     z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0).max(100).default(0),
})

export default function QuotationLineModal({ open, onClose, line, lines = [], quotationId, tenantId, onSaved }) {
  const isEdit = Boolean(line)
  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(lineSchema),
    defaultValues: { product_name: '', quantity: 1, unit_price: 0, discount_pct: 0, tax_rate: 0 },
  })

  const watchQty   = watch('quantity', 1)
  const watchPrice = watch('unit_price', 0)
  const watchDisc  = watch('discount_pct', 0)
  const watchTax   = watch('tax_rate', 0)

  const [allProducts,     setAllProducts]     = useState([])
  const [selectedProduct, setSelectedProduct] = useState('')

  // Load active inventory products once the modal opens, then seed the form
  useEffect(() => {
    if (!open) return
    let active = true
    fetchProductSaleOptions(tenantId).then(prods => {
      if (!active) return
      setAllProducts(prods)

      reset(line
        ? { product_name: line.product_name, quantity: Number(line.quantity), unit_price: Number(line.unit_price), discount_pct: Number(line.discount_pct) || 0, tax_rate: Number(line.tax_rate) || 0 }
        : { product_name: '', quantity: 1, unit_price: 0, discount_pct: 0, tax_rate: 0 })

      const match = line ? prods.find(p => p.name === line.product_name) : null
      setSelectedProduct(match ? match.id : '')
    })
    return () => { active = false }
  }, [open, line, reset, tenantId])

  const handleProductChange = (e) => {
    const val = e.target.value
    setSelectedProduct(val)
    setValue('discount_pct', 0)
    setValue('tax_rate', 0)
    const p = allProducts.find(prod => prod.id === val)
    if (p) {
      setValue('product_name', p.name)
      setValue('unit_price', Number(p.sale_price) || 0)
    } else {
      setValue('product_name', '')
    }
  }

  const preview = lineMath({ quantity: watchQty, unit_price: watchPrice, discount_pct: watchDisc, tax_rate: watchTax })

  const onSubmit = async (data) => {
    // Block duplicate products on the same quotation (ignore the row being edited)
    const dupe = (lines || []).some(l =>
      l.id !== line?.id &&
      (l.product_name || '').trim().toLowerCase() === data.product_name.trim().toLowerCase()
    )
    if (dupe) { toast.error('This item is already on the quotation.'); return }

    try {
      await saveQuotationLine(quotationId, tenantId, line, data)
      toast.success(isEdit ? 'Line updated.' : 'Line added.')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleClose = () => { reset(); setSelectedProduct(''); onClose() }

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
            <Input
              label="Discount %"
              type="number"
              step="0.01"
              min="0"
              max="100"
              placeholder="0"
              error={errors.discount_pct?.message}
              {...register('discount_pct')}
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
              <span>Base ({Number(watchQty) || 0} × ${(Number(watchPrice) || 0).toLocaleString()})</span>
              <span>${preview.base.toLocaleString()}</span>
            </div>
            {preview.discount > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Discount ({Number(watchDisc) || 0}%)</span>
                <span>−${preview.discount.toLocaleString()}</span>
              </div>
            )}
            {preview.tax > 0 && (
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Tax ({Number(watchTax) || 0}%)</span>
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
