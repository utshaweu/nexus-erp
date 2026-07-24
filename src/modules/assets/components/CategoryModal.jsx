import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Modal, Input, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { saveCategory } from '../api/categories'

const categorySchema = z.object({
  name:                 z.string().trim().min(1, 'Name is required'),
  description:          z.string().optional(),
  depreciation_method:  z.enum(['straight_line', 'declining_balance']),
  default_useful_life:  z.coerce.number().int().min(1, 'Must be at least 1 year').max(99, 'Max 99 years'),
  default_salvage_rate: z.coerce.number().min(0, 'Must be 0 or more').max(100, 'Must be 100 or less'),
})

const DEFAULT_VALUES = {
  name: '', description: '', depreciation_method: 'straight_line',
  default_useful_life: 5, default_salvage_rate: 10,
}

export default function CategoryModal({ open, onClose, onSaved, category }) {
  const { tenantId } = useTenant()
  const isEdit = Boolean(category)

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(categorySchema), defaultValues: DEFAULT_VALUES })

  useEffect(() => {
    if (!open) return
    reset(category
      ? {
          name: category.name, description: category.description || '',
          depreciation_method: category.depreciation_method,
          default_useful_life: category.default_useful_life,
          default_salvage_rate: category.default_salvage_rate,
        }
      : DEFAULT_VALUES
    )
  }, [open, category, reset])

  const onSubmit = async (data) => {
    try {
      await saveCategory(tenantId, category, data)
      toast.success(isEdit ? 'Category updated.' : 'Category created.')
      onSaved(); onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Category' : 'New Asset Category'} size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Input label="Name" placeholder="e.g. IT Equipment" error={errors.name?.message} {...register('name')} />
        <Input label="Description (optional)" placeholder="Brief description of this category" {...register('description')} />
        <Select label="Default Depreciation Method" {...register('depreciation_method')}>
          <option value="straight_line">Straight Line</option>
          <option value="declining_balance">Declining Balance (Double)</option>
        </Select>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Default Useful Life (years)" type="number" min="1" max="99" error={errors.default_useful_life?.message} {...register('default_useful_life')} />
          <Input label="Default Salvage Rate (%)" type="number" min="0" max="100" step="0.01" error={errors.default_salvage_rate?.message} {...register('default_salvage_rate')} />
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isSubmitting}>
            {isEdit ? 'Save Changes' : 'Create Category'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
