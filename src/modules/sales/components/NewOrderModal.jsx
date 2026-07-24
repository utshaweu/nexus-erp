import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal, Button, Input, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { createSalesOrder } from '../api/salesOrders'

const orderSchema = z.object({
  customer_id:   z.string().min(1, 'Customer is required'),
  reference:     z.string().optional(),
  order_date:    z.string().min(1, 'Order date is required'),
  delivery_date: z.string().optional(),
  notes:         z.string().optional(),
})

export default function NewOrderModal({ open, onClose, customers, onCreated }) {
  const { tenantId } = useTenant()
  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(orderSchema),
    defaultValues: { customer_id: '', reference: '', order_date: '', delivery_date: '', notes: '' },
  })

  const onSubmit = async (data) => {
    try {
      await createSalesOrder(tenantId, data)
      toast.success('Sales order created.')
      reset()
      onCreated()
      onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title="New Sales Order" size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          <Select label="Customer" error={errors.customer_id?.message} {...register('customer_id')}>
            <option value="">Select customer…</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>

          <Input
            label="Reference"
            placeholder="Customer PO / external ref…"
            error={errors.reference?.message}
            {...register('reference')}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Order Date"
              type="date"
              error={errors.order_date?.message}
              {...register('order_date')}
            />
            <Input
              label="Delivery Date"
              type="date"
              {...register('delivery_date')}
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
              Create Order
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
