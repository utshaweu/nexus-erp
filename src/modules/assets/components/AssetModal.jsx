import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Modal, Input, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { ASSET_STATUS } from '@shared/lib/constants'
import { saveAsset } from '../api/assets'

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

const DEFAULT_VALUES = {
  name: '', description: '', category_id: '', status: 'active',
  purchase_date: new Date().toISOString().slice(0, 10),
  purchase_cost: '', salvage_value: 0, useful_life_years: 5,
  depreciation_method: 'straight_line',
  location: '', serial_number: '', warranty_expiry: '', notes: '',
}

/** Shared create/edit form for an asset — used by AssetList (create+edit) and AssetDetail (edit only). */
export default function AssetModal({ open, onClose, onSaved, asset, categories, assetProducts }) {
  const { tenantId } = useTenant()
  const isEdit = Boolean(asset)

  const {
    register, handleSubmit, reset, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(assetSchema), defaultValues: DEFAULT_VALUES })

  const watchedCategoryId   = watch('category_id')
  const watchedName         = watch('name')
  const watchedPurchaseCost = watch('purchase_cost')

  // Auto-fill purchase_cost from the selected product's cost_price (create only)
  useEffect(() => {
    if (isEdit || !watchedName) return
    const product = assetProducts.find(p => p.name === watchedName)
    if (product?.cost_price) setValue('purchase_cost', product.cost_price)
  }, [watchedName, assetProducts, isEdit, setValue])

  // Auto-fill depreciation method + useful life when category is selected (create only)
  useEffect(() => {
    if (!watchedCategoryId || isEdit) return
    const cat = categories.find(c => c.id === watchedCategoryId)
    if (!cat) return
    setValue('depreciation_method', cat.depreciation_method)
    setValue('useful_life_years', cat.default_useful_life)
  }, [watchedCategoryId, categories, isEdit, setValue])

  // Auto-fill salvage_value = purchase_cost × default_salvage_rate% (create only)
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
    try {
      await saveAsset(tenantId, asset, data)
      toast.success(isEdit ? 'Asset updated.' : 'Asset created.')
      onSaved(); onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? `Edit ${asset?.asset_number}` : 'New Asset'} size="lg">
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
              <Input label="Description (optional)" placeholder="Brief description" {...register('description')} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Location (optional)" placeholder="e.g. Head Office – Floor 3" {...register('location')} />
                <Input label="Serial / Tag No. (optional)" placeholder="e.g. SN-20240001" {...register('serial_number')} />
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
                <Input label="Purchase Cost" type="number" min="0" step="0.01" placeholder="0.00" error={errors.purchase_cost?.message} {...register('purchase_cost')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Salvage Value" type="number" min="0" step="0.01" placeholder="0.00" error={errors.salvage_value?.message} {...register('salvage_value')} />
                <Input label="Warranty Expiry (optional)" type="date" {...register('warranty_expiry')} />
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

          <Input label="Notes (optional)" placeholder="Any additional notes" {...register('notes')} />

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>Cancel</Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              {isEdit ? 'Save Changes' : 'Create Asset'}
            </Button>
          </div>

        </div>
      </form>
    </Modal>
  )
}
