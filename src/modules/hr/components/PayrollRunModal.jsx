import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Modal, Input, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import useStore from '@core/store/useStore'
import { createPayrollRun } from '../api/payroll'

export const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']

const currentYear  = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

const runSchema = z.object({
  period_month: z.coerce.number().int().min(1).max(12),
  period_year:  z.coerce.number().int().min(2000).max(2100),
  notes:        z.string().optional(),
})

export default function PayrollRunModal({ open, onClose, onSaved }) {
  const { tenantId } = useTenant()
  const session      = useStore(s => s.session)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm({
      resolver: zodResolver(runSchema),
      defaultValues: { period_month: currentMonth, period_year: currentYear, notes: '' },
    })

  useEffect(() => {
    if (!open) return
    reset({ period_month: currentMonth, period_year: currentYear, notes: '' })
  }, [open, reset])

  const onSubmit = async (data) => {
    try {
      await createPayrollRun(tenantId, data, session?.user?.id)
      toast.success('Payroll run created.')
      onSaved(); onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Payroll Run" size="sm">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Month" error={errors.period_month?.message} {...register('period_month')}>
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </Select>
          <Input
            label="Year"
            type="number" min="2000" max="2100"
            error={errors.period_year?.message}
            {...register('period_year')}
          />
        </div>
        <Input label="Notes (optional)" placeholder="Any notes for this payroll run" {...register('notes')} />
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isSubmitting}>Create Run</Button>
        </div>
      </form>
    </Modal>
  )
}
