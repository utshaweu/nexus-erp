import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal, Button, Input, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { createQuotation } from '../api/quotations'

const quotationSchema = z.object({
  customer_id:    z.string().min(1, 'Customer is required'),
  quotation_date: z.string().min(1, 'Date is required'),
  expiry_date:    z.string().optional(),
  notes:          z.string().optional(),
})

export default function NewQuotationModal({ open, onClose, customers, onCreated }) {
  const { tenantId } = useTenant()
  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(quotationSchema),
    defaultValues: { customer_id: '', quotation_date: '', expiry_date: '', notes: '' },
  })

  const onSubmit = async (data) => {
    try {
      await createQuotation(tenantId, data)
      toast.success('Quotation created.')
      reset()
      onCreated()
      onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title="New Quotation" size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          <Select label="Customer" error={errors.customer_id?.message} {...register('customer_id')}>
            <option value="">Select customer…</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Quotation Date"
              type="date"
              error={errors.quotation_date?.message}
              {...register('quotation_date')}
            />
            <Input
              label="Expiry Date"
              type="date"
              {...register('expiry_date')}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1.5">
              Notes
            </label>
            <textarea
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm
                         text-slate-900 dark:text-slate-200
                         placeholder:text-slate-400 dark:placeholder:text-slate-600
                         bg-white dark:bg-surface-900
                         border border-surface-200 dark:border-surface-700
                         hover:border-surface-300 dark:hover:border-surface-600
                         focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500
                         transition-colors resize-none"
              placeholder="Optional notes…"
              {...register('notes')}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              Create Quotation
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
