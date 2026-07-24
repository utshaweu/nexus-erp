import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Modal, Input, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { EMPLOYMENT_TYPES } from '@shared/lib/constants'
import { useTenant } from '@core/tenant/TenantContext'
import { saveLeaveType } from '../api/leave'

const leaveTypeSchema = z.object({
  name:            z.string().trim().min(1, 'Name is required'),
  days_allowed:    z.coerce.number().int().min(0, 'Must be 0 or more'),
  employment_type: z.string().min(1, 'Employment type is required'),
  is_paid:         z.boolean(),
})

export default function LeaveTypeModal({ open, onClose, onSaved, leaveType }) {
  const { tenantId } = useTenant()
  const isEdit = Boolean(leaveType)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm({
      resolver: zodResolver(leaveTypeSchema),
      defaultValues: { name: '', days_allowed: 0, employment_type: '', is_paid: true },
    })

  useEffect(() => {
    if (!open) return
    reset(leaveType
      ? {
          name: leaveType.name,
          days_allowed: leaveType.days_allowed,
          employment_type: leaveType.employment_type || '',
          is_paid: leaveType.is_paid,
        }
      : { name: '', days_allowed: 0, employment_type: '', is_paid: true }
    )
  }, [open, leaveType, reset])

  const onSubmit = async (data) => {
    try {
      await saveLeaveType(tenantId, leaveType, data)
      toast.success(isEdit ? 'Leave type updated.' : 'Leave type created.')
      onSaved(); onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Leave Type' : 'New Leave Type'} size="sm">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Input
          label="Name"
          placeholder="e.g. Annual Leave"
          error={errors.name?.message}
          {...register('name')}
        />
        <Input
          label="Days Allowed per Year"
          type="number" min="0"
          error={errors.days_allowed?.message}
          {...register('days_allowed')}
        />
        <Select label="Employment Type" error={errors.employment_type?.message} {...register('employment_type')}>
          <option value="">— Select employment type —</option>
          {Object.entries(EMPLOYMENT_TYPES).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" {...register('is_paid')} className="w-4 h-4 rounded accent-pink-500" />
          <span className="text-sm text-slate-700 dark:text-slate-300">Paid leave</span>
        </label>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isSubmitting}>
            {isEdit ? 'Save Changes' : 'Create Type'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
