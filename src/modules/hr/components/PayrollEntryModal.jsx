import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Modal, Input, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { savePayrollEntry } from '../api/payroll'

const fmt = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const entrySchema = z.object({
  employee_id:  z.string().min(1, 'Employee is required'),
  basic_salary: z.coerce.number().min(0, 'Must be 0 or more'),
  allowances:   z.coerce.number().min(0, 'Must be 0 or more'),
  deductions:   z.coerce.number().min(0, 'Must be 0 or more'),
  notes:        z.string().optional(),
})

export default function PayrollEntryModal({ open, onClose, onSaved, runId, tenantId, employees, entry }) {
  const isEdit = Boolean(entry)

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } =
    useForm({
      resolver: zodResolver(entrySchema),
      defaultValues: { employee_id: '', basic_salary: 0, allowances: 0, deductions: 0, notes: '' },
    })

  const basic      = parseFloat(watch('basic_salary')) || 0
  const allowances = parseFloat(watch('allowances'))   || 0
  const deductions = parseFloat(watch('deductions'))   || 0
  const gross      = basic + allowances
  const net        = Math.max(0, gross - deductions)

  useEffect(() => {
    if (!open) return
    reset(entry
      ? {
          employee_id:  entry.employee_id,
          basic_salary: entry.basic_salary,
          allowances:   entry.allowances,
          deductions:   entry.deductions,
          notes:        entry.notes || '',
        }
      : { employee_id: '', basic_salary: 0, allowances: 0, deductions: 0, notes: '' }
    )
  }, [open, entry, reset])

  const onSubmit = async (data) => {
    try {
      await savePayrollEntry(runId, tenantId, entry, data)
      toast.success(isEdit ? 'Entry updated.' : 'Employee added to payroll.')
      onSaved(); onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Payroll Entry' : 'Add Employee to Payroll'} size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {!isEdit && (
          <Select label="Employee" error={errors.employee_id?.message} {...register('employee_id')}>
            <option value="">— Select employee —</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>
                {e.first_name} {e.last_name} ({e.employee_number})
              </option>
            ))}
          </Select>
        )}
        {isEdit && entry && (
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Editing entry for: {employees.find(e => e.id === entry.employee_id)?.first_name || '—'}
          </p>
        )}

        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Basic Salary"
            type="number" min="0" step="0.01"
            error={errors.basic_salary?.message}
            {...register('basic_salary')}
          />
          <Input
            label="Allowances"
            type="number" min="0" step="0.01"
            error={errors.allowances?.message}
            {...register('allowances')}
          />
          <Input
            label="Deductions"
            type="number" min="0" step="0.01"
            error={errors.deductions?.message}
            {...register('deductions')}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-slate-50 dark:bg-surface-800 text-sm">
          <div>
            <span className="text-slate-500">Gross Salary</span>
            <p className="font-bold text-slate-900 dark:text-slate-100">${fmt(gross)}</p>
          </div>
          <div>
            <span className="text-slate-500">Net Salary</span>
            <p className="font-bold text-pink-600 dark:text-pink-400">${fmt(net)}</p>
          </div>
        </div>

        <Input label="Notes (optional)" placeholder="e.g. includes bonus" {...register('notes')} />

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isSubmitting}>
            {isEdit ? 'Save Changes' : 'Add to Payroll'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
