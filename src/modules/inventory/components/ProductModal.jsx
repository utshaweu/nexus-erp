import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Modal, Input, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { PRODUCT_CATEGORIES, PRODUCT_UNITS } from '@shared/lib/constants'
import { saveProduct } from '../api/products'

const productSchema = z.object({
  name:            z.string().trim().min(1, 'Product name is required'),
  sku:             z.string().trim().min(1, 'SKU is required'),
  category:        z.string().min(1, 'Category is required'),
  unit_of_measure: z.string().min(1, 'Unit of measure is required'),
  cost_price:      z.coerce.number({ invalid_type_error: 'Enter a valid price' }).min(0, 'Must be ≥ 0'),
  sale_price:      z.coerce.number({ invalid_type_error: 'Enter a valid price' }).min(0, 'Must be ≥ 0'),
  reorder_qty:     z.coerce.number({ invalid_type_error: 'Enter a valid quantity' }).min(0, 'Must be ≥ 0'),
  status:          z.enum(['active', 'inactive', 'archived']),
  description:     z.string().trim().optional(),
})

const DEFAULT_VALUES = {
  name: '', sku: '', category: '', unit_of_measure: 'unit',
  cost_price: 0, sale_price: 0, reorder_qty: 0, status: 'active', description: '',
}

export default function ProductModal({ open, onClose, onSaved, product }) {
  const { tenantId } = useTenant()
  const isEdit = Boolean(product)

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(productSchema), defaultValues: DEFAULT_VALUES })

  useEffect(() => {
    if (!open) return
    reset(product ? {
      name:            product.name            || '',
      sku:             product.sku             || '',
      category:        product.category        || '',
      unit_of_measure: product.unit_of_measure || 'unit',
      cost_price:      product.cost_price      ?? 0,
      sale_price:      product.sale_price      ?? 0,
      reorder_qty:     product.reorder_qty     ?? 0,
      status:          product.status          || 'active',
      description:     product.description     || '',
    } : DEFAULT_VALUES)
  }, [open, product, reset])

  const onSubmit = async (data) => {
    try {
      await saveProduct(tenantId, product, data)
      toast.success(isEdit ? 'Product updated.' : 'Product created.')
      onSaved(); onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? 'Edit Product' : 'New Product'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-5">

          <Input
            label="Product Name"
            placeholder="e.g. USB-C Cable 2m"
            error={errors.name?.message}
            {...register('name')}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="SKU"
              placeholder="e.g. SKU-001"
              error={errors.sku?.message}
              {...register('sku')}
            />
            <div>
              <Select label="Category" error={errors.category?.message} {...register('category')}>
                <option value="">Select category…</option>
                {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Select label="Unit of Measure" {...register('unit_of_measure')}>
                {PRODUCT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </Select>
            </div>
            <div>
              <Select label="Status" {...register('status')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </Select>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-surface-800/60 p-4 space-y-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Pricing & Stock
            </p>
            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Cost Price"
                type="number" step="0.01" min="0" placeholder="0.00"
                error={errors.cost_price?.message}
                {...register('cost_price')}
              />
              <Input
                label="Sale Price"
                type="number" step="0.01" min="0" placeholder="0.00"
                error={errors.sale_price?.message}
                {...register('sale_price')}
              />
              <Input
                label="Reorder Qty"
                type="number" step="1" min="0" placeholder="0"
                error={errors.reorder_qty?.message}
                {...register('reorder_qty')}
              />
            </div>
          </div>

          <Input
            label="Description (optional)"
            placeholder="Short product description"
            {...register('description')}
          />

          <div className="flex gap-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              {isEdit ? 'Save Changes' : 'Create Product'}
            </Button>
          </div>

        </div>
      </form>
    </Modal>
  )
}
