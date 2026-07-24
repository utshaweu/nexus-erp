import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Modal, Input, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { saveWarehouse } from '../api/warehouses'

const warehouseSchema = z.object({
  code:         z.string().trim().min(1, 'Code is required').max(20, 'Max 20 characters'),
  name:         z.string().trim().min(1, 'Warehouse name is required'),
  location:     z.string().trim().optional(),
  capacity_pct: z.coerce.number({ invalid_type_error: 'Enter a number' })
                  .min(0, 'Min 0').max(100, 'Max 100').optional().default(0),
  status:       z.enum(['active', 'inactive']),
})

const DEFAULT_VALUES = { code: '', name: '', location: '', capacity_pct: 0, status: 'active' }

export default function WarehouseModal({ open, onClose, onSaved, warehouse }) {
  const { tenantId } = useTenant()
  const isEdit = Boolean(warehouse)

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(warehouseSchema), defaultValues: DEFAULT_VALUES })

  useEffect(() => {
    if (!open) return
    reset(warehouse ? {
      code:         warehouse.code         || '',
      name:         warehouse.name         || '',
      location:     warehouse.location     || '',
      capacity_pct: warehouse.capacity_pct ?? 0,
      status:       warehouse.status       || 'active',
    } : DEFAULT_VALUES)
  }, [open, warehouse, reset])

  const onSubmit = async (data) => {
    try {
      await saveWarehouse(tenantId, warehouse, data)
      toast.success(isEdit ? 'Warehouse updated.' : 'Warehouse created.')
      onSaved(); onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? 'Edit Warehouse' : 'New Warehouse'} size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-5">

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Warehouse Code"
              placeholder="e.g. WH-MAIN"
              error={errors.code?.message}
              {...register('code')}
            />
            <div>
              <Select label="Status" {...register('status')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>
          </div>

          <Input
            label="Warehouse Name"
            placeholder="e.g. Main Warehouse"
            error={errors.name?.message}
            {...register('name')}
          />

          <Input
            label="Location"
            placeholder="City, Country"
            {...register('location')}
          />

          <div className="space-y-2">
            <Input
              label="Capacity Used (%)"
              type="number"
              min="0"
              max="100"
              step="1"
              placeholder="0"
              error={errors.capacity_pct?.message}
              {...register('capacity_pct')}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              {isEdit ? 'Save Changes' : 'Create Warehouse'}
            </Button>
          </div>

        </div>
      </form>
    </Modal>
  )
}
