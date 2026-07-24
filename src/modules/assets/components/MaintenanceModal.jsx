import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Modal, Input, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { MAINTENANCE_TYPE, MAINTENANCE_STATUS } from '@shared/lib/constants'
import { saveMaintenanceLog } from '../api/maintenance'

const maintenanceSchema = z.object({
  asset_id:         z.string().min(1, 'Asset is required'),
  maintenance_type: z.enum(['preventive', 'corrective', 'emergency', 'inspection']),
  status:           z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']),
  scheduled_date:   z.string().min(1, 'Scheduled date is required'),
  completed_date:   z.string().optional(),
  description:      z.string().trim().min(1, 'Description is required'),
  cost:             z.coerce.number({ invalid_type_error: 'Enter a valid amount' }).min(0, 'Must be 0 or more'),
  performed_by:     z.string().optional(),
  notes:            z.string().optional(),
})

const DEFAULT_VALUES = {
  asset_id: '', maintenance_type: 'preventive', status: 'scheduled',
  scheduled_date: new Date().toISOString().slice(0, 10), completed_date: '',
  description: '', cost: 0, performed_by: '', notes: '',
}

export default function MaintenanceModal({ open, onClose, onSaved, log, allAssets }) {
  const { tenantId } = useTenant()
  const isEdit = Boolean(log)

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(maintenanceSchema), defaultValues: DEFAULT_VALUES })

  useEffect(() => {
    if (!open) return
    reset(log
      ? {
          asset_id: log.asset_id, maintenance_type: log.maintenance_type, status: log.status,
          scheduled_date: log.scheduled_date, completed_date: log.completed_date || '',
          description: log.description, cost: log.cost,
          performed_by: log.performed_by || '', notes: log.notes || '',
        }
      : DEFAULT_VALUES
    )
  }, [open, log, reset])

  const onSubmit = async (data) => {
    try {
      await saveMaintenanceLog(tenantId, log, data)
      toast.success(isEdit ? 'Maintenance log updated.' : 'Maintenance log created.')
      onSaved(); onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? `Edit ${log?.log_number}` : 'New Maintenance Log'} size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Asset
          </label>
          <select
            className={`w-full px-3 py-2 rounded-lg text-sm
              text-slate-900 dark:text-slate-200
              bg-white dark:bg-surface-900
              border ${errors.asset_id ? 'border-red-500' : 'border-surface-200 dark:border-surface-700'}
              focus:outline-none focus:ring-1 focus:ring-brand-500`}
            {...register('asset_id')}
          >
            <option value="">Select an asset…</option>
            {allAssets.map(a => (
              <option key={a.id} value={a.id}>{a.asset_number} — {a.name}</option>
            ))}
          </select>
          {errors.asset_id && <p className="text-xs text-red-500">{errors.asset_id.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select label="Type" {...register('maintenance_type')}>
            {Object.entries(MAINTENANCE_TYPE).map(([v, { label }]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </Select>
          <Select label="Status" {...register('status')}>
            {Object.entries(MAINTENANCE_STATUS).map(([v, { label }]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </Select>
        </div>

        <Input label="Description" placeholder="Describe the maintenance work" error={errors.description?.message} {...register('description')} />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Scheduled Date" type="date" error={errors.scheduled_date?.message} {...register('scheduled_date')} />
          <Input label="Completed Date" type="date" {...register('completed_date')} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Cost" type="number" min="0" step="0.01" placeholder="0.00" error={errors.cost?.message} {...register('cost')} />
          <Input label="Performed By (optional)" placeholder="Technician or vendor name" {...register('performed_by')} />
        </div>

        <Input label="Notes (optional)" placeholder="Additional details" {...register('notes')} />

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isSubmitting}>
            {isEdit ? 'Save Changes' : 'Create Log'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
