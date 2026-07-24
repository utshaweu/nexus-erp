import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Modal, Input, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { createRFQ } from '../api/rfqs'

const rfqSchema = z.object({
  vendor_id: z.string().min(1, 'Vendor is required'),
  deadline:  z.string().min(1, 'Deadline is required'),
  notes:     z.string().optional(),
})

export default function NewRFQModal({ open, onClose, vendors, onCreated }) {
  const { tenantId } = useTenant()
  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(rfqSchema),
    defaultValues: { vendor_id: '', deadline: '', notes: '' },
  })

  const onSubmit = async (data) => {
    try {
      await createRFQ(tenantId, data)
      toast.success('RFQ created.')
      reset()
      onCreated()
      onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title="New Request for Quotation" size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          <Select label="Vendor" error={errors.vendor_id?.message} {...register('vendor_id')}>
            <option value="">Select vendor…</option>
            {vendors.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </Select>

          <Input
            label="Quotation Deadline"
            type="date"
            error={errors.deadline?.message}
            {...register('deadline')}
          />

          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1.5">
              Notes
            </label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-sm
                         text-slate-900 dark:text-slate-200
                         placeholder:text-slate-400 dark:placeholder:text-slate-600
                         bg-white dark:bg-surface-900
                         border border-surface-200 dark:border-surface-700
                         hover:border-surface-300 dark:hover:border-surface-600
                         focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500
                         transition-colors resize-none"
              placeholder="Requirements, specs…"
              {...register('notes')}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              Create RFQ
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
