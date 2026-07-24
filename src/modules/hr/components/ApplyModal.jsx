import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Modal, Input, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import useStore from '@core/store/useStore'
import { MOVEMENT_TYPES } from '@shared/lib/constants'
import { createMovement } from '../api/movements'

const today = new Date().toISOString().slice(0, 10)

const moveSchema = z.object({
  employee_id:   z.string().min(1, 'Employee is required'),
  movement_type: z.string().min(1, 'Movement type is required'),
  from_date:     z.string().min(1, 'From date is required'),
  to_date:       z.string().min(1, 'To date is required'),
  start_time:    z.string().optional(),
  end_time:      z.string().optional(),
  location:      z.string().optional(),
  reason:        z.string().trim().min(1, 'Reason is required'),
}).refine(d => d.to_date >= d.from_date, {
  message: 'To date must be on or after from date', path: ['to_date'],
})

export default function ApplyModal({ open, onClose, onSaved, employees, myEmployee, isManager }) {
  const { tenantId } = useTenant()
  const session      = useStore(s => s.session)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm({
      resolver: zodResolver(moveSchema),
      defaultValues: {
        employee_id: '', movement_type: '', from_date: today, to_date: today,
        start_time: '', end_time: '', location: '', reason: '',
      },
    })

  useEffect(() => {
    if (!open) return
    reset({
      employee_id: myEmployee?.id || '', movement_type: '', from_date: today, to_date: today,
      start_time: '', end_time: '', location: '', reason: '',
    })
  }, [open, myEmployee, reset])

  const onSubmit = async (data) => {
    try {
      const { message, approvalError } = await createMovement(
        tenantId, data, employees, myEmployee, isManager, session?.user?.id
      )
      if (approvalError) toast.error(approvalError)
      toast.success(message)
      onSaved(); onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Apply Movement" size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {isManager ? (
          <Select label="Employee" error={errors.employee_id?.message} {...register('employee_id')}>
            <option value="">— Select employee —</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_number})</option>
            ))}
          </Select>
        ) : (
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-surface-800 text-sm">
            <span className="text-slate-500">Employee: </span>
            <span className="font-semibold">{myEmployee?.first_name} {myEmployee?.last_name}</span>
            <span className="font-mono text-xs text-pink-500 ml-2">{myEmployee?.employee_number}</span>
          </div>
        )}

        <Select label="Movement Type *" error={errors.movement_type?.message} {...register('movement_type')}>
          <option value="">Select Movement Type</option>
          {MOVEMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </Select>

        <div className="grid grid-cols-2 gap-3">
          <Input label="From Date" type="date" error={errors.from_date?.message} {...register('from_date')} />
          <Input label="To Date"   type="date" error={errors.to_date?.message}   {...register('to_date')}   />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Start Time" type="time" {...register('start_time')} />
          <Input label="End Time"   type="time" {...register('end_time')}   />
        </div>
        <Input label="Location" placeholder="Write Your Location" {...register('location')} />
        <div>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1.5">
            Reason *
          </label>
          <textarea
            {...register('reason')}
            placeholder="Reason for movement"
            rows={3}
            className="w-full px-3 py-2 rounded-lg text-sm
                       text-slate-900 dark:text-slate-200
                       placeholder:text-slate-400 dark:placeholder:text-slate-600
                       bg-white dark:bg-surface-900
                       border border-surface-200 dark:border-surface-700
                       focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500
                       resize-none"
          />
          {errors.reason && <p className="text-xs text-red-500 mt-1">{errors.reason.message}</p>}
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isSubmitting}>Apply</Button>
        </div>
      </form>
    </Modal>
  )
}
