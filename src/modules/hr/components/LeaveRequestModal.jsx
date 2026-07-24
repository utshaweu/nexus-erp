import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Modal, Input, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import useStore from '@core/store/useStore'
import { EMPLOYMENT_TYPES } from '@shared/lib/constants'
import { createLeaveRequest } from '../api/leave'

const leaveReqSchema = z.object({
  employee_id:   z.string().min(1, 'Employee is required'),
  leave_type_id: z.string().min(1, 'Leave type is required'),
  start_date:    z.string().min(1, 'Start date is required'),
  end_date:      z.string().min(1, 'End date is required'),
  reason:        z.string().optional(),
}).refine(d => d.end_date >= d.start_date, {
  message: 'End date must be on or after start date',
  path: ['end_date'],
})

function countWeekdays(start, end) {
  let count = 0
  const d = new Date(start)
  const e = new Date(end)
  while (d <= e) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

export default function LeaveRequestModal({ open, onClose, onSaved, employees, leaveTypes }) {
  const { tenantId } = useTenant()
  const session      = useStore(s => s.session)

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } =
    useForm({
      resolver: zodResolver(leaveReqSchema),
      defaultValues: {
        employee_id: '', leave_type_id: '',
        start_date: new Date().toISOString().slice(0, 10),
        end_date:   new Date().toISOString().slice(0, 10),
        reason: '',
      },
    })

  const startDate = watch('start_date')
  const endDate   = watch('end_date')
  const days = (startDate && endDate && endDate >= startDate)
    ? countWeekdays(startDate, endDate)
    : 0

  const employeeId = watch('employee_id')
  const selectedEmployee = employees.find(e => e.id === employeeId)
  const availableLeaveTypes = selectedEmployee
    ? leaveTypes.filter(t => t.is_active && t.employment_type === selectedEmployee.employment_type)
    : []

  // Leave type options depend on the selected employee's employment type —
  // clear any prior selection when the employee changes so a stale/invalid pick can't be submitted.
  useEffect(() => {
    setValue('leave_type_id', '')
  }, [employeeId, setValue])

  useEffect(() => {
    if (!open) return
    reset({
      employee_id: '', leave_type_id: '',
      start_date: new Date().toISOString().slice(0, 10),
      end_date:   new Date().toISOString().slice(0, 10),
      reason: '',
    })
  }, [open, reset])

  const onSubmit = async (data) => {
    try {
      const { message, approvalError } = await createLeaveRequest(
        tenantId, data, days, employees, leaveTypes, session?.user?.id
      )
      if (approvalError) toast.error(approvalError)
      toast.success(message)
      onSaved(); onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Leave Request" size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Select label="Employee" error={errors.employee_id?.message} {...register('employee_id')}>
          <option value="">— Select employee —</option>
          {employees.map(e => (
            <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_number})</option>
          ))}
        </Select>
        <Select
          label="Leave Type"
          error={errors.leave_type_id?.message}
          disabled={!selectedEmployee}
          {...register('leave_type_id')}
        >
          <option value="">
            {selectedEmployee ? '— Select type —' : '— Select employee first —'}
          </option>
          {availableLeaveTypes.map(t => (
            <option key={t.id} value={t.id}>{t.name} ({t.days_allowed} days/yr, {t.is_paid ? 'Paid' : 'Unpaid'})</option>
          ))}
        </Select>
        {selectedEmployee && availableLeaveTypes.length === 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 -mt-2">
            No active leave types configured for {EMPLOYMENT_TYPES[selectedEmployee.employment_type] || selectedEmployee.employment_type} employees.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Start Date"
            type="date"
            error={errors.start_date?.message}
            {...register('start_date')}
          />
          <Input
            label="End Date"
            type="date"
            error={errors.end_date?.message}
            {...register('end_date')}
          />
        </div>
        {days > 0 && (
          <p className="text-sm text-pink-600 dark:text-pink-400 font-medium">
            {days} working day{days !== 1 ? 's' : ''}
          </p>
        )}
        <Input label="Reason (optional)" placeholder="Reason for leave" {...register('reason')} />
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isSubmitting}>Submit Request</Button>
        </div>
      </form>
    </Modal>
  )
}
