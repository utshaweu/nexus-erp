import { useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Modal, Input, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { INVOICE_STATUS } from '@shared/lib/constants'
import { fetchInvoiceLines, saveInvoice } from '../api/invoices'
import { lineItemSchema, DEFAULT_LINE_ITEM, computeLineItemTotals } from '../api/lineItems'
import LineItemsEditor from './LineItemsEditor'

const invoiceSchema = z.object({
  customer_id:  z.string().min(1, 'Customer is required'),
  invoice_date: z.string().min(1, 'Invoice date is required'),
  due_date:     z.string().optional(),
  notes:        z.string().optional(),
  status:       z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']),
  lines:        z.array(lineItemSchema).min(1, 'At least one line item is required'),
})

const DEFAULT_VALUES = {
  customer_id: '',
  invoice_date: new Date().toISOString().slice(0, 10),
  due_date: '', notes: '', status: 'draft',
  lines: [{ ...DEFAULT_LINE_ITEM }],
}

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function InvoiceModal({ open, onClose, onSaved, invoice, customers, products }) {
  const { tenantId } = useTenant()
  const isEdit = Boolean(invoice)

  const {
    register, handleSubmit, reset, control, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(invoiceSchema), defaultValues: DEFAULT_VALUES })

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const watchedLines = watch('lines') || []
  const totals = computeLineItemTotals(watchedLines)

  useEffect(() => {
    if (!open) return
    if (invoice) {
      fetchInvoiceLines(invoice.id).then(lines => {
        reset({
          customer_id:  invoice.customer_id  || '',
          invoice_date: invoice.invoice_date || new Date().toISOString().slice(0, 10),
          due_date:     invoice.due_date      || '',
          notes:        invoice.notes         || '',
          status:       invoice.status        || 'draft',
          lines: lines.length
            ? lines.map(l => ({
                description: l.description, quantity: Number(l.quantity),
                unit_price: Number(l.unit_price), tax_rate: Number(l.tax_rate),
              }))
            : [{ ...DEFAULT_LINE_ITEM }],
        })
      })
    } else {
      reset(DEFAULT_VALUES)
    }
  }, [open, invoice, reset])

  const onSubmit = async (data) => {
    try {
      await saveInvoice(tenantId, invoice, data)
      toast.success(isEdit ? 'Invoice updated.' : 'Invoice created.')
      onSaved(); onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? `Edit ${invoice?.invoice_number}` : 'New Invoice'} size="xl">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-5">

          <div className="grid grid-cols-2 gap-4">
            <Select label="Customer" error={errors.customer_id?.message} {...register('customer_id')}>
              <option value="">Select customer…</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select label="Status" {...register('status')}>
              {Object.entries(INVOICE_STATUS).map(([v, { label }]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Invoice Date" type="date" error={errors.invoice_date?.message} {...register('invoice_date')} />
            <Input label="Due Date" type="date" {...register('due_date')} />
          </div>

          {errors.lines && (
            <p className="text-xs text-red-500">{errors.lines.message || errors.lines.root?.message}</p>
          )}

          <LineItemsEditor
            fields={fields} register={register} watch={watch} remove={remove} append={append} setValue={setValue}
            products={products} priceField="sale_price" defaultLine={DEFAULT_LINE_ITEM}
          />

          <div className="flex justify-end">
            <div className="w-56 space-y-1.5 rounded-xl bg-slate-50 dark:bg-surface-800 p-3">
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Subtotal</span>
                <span className="tabular-nums">${fmt(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Tax</span>
                <span className="tabular-nums">${fmt(totals.tax_amount)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-slate-100
                              pt-1.5 border-t border-surface-200 dark:border-surface-700">
                <span>Total</span>
                <span className="tabular-nums">${fmt(totals.total_amount)}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Notes (optional)
            </label>
            <textarea
              rows={2}
              placeholder="Internal notes or payment instructions…"
              className="w-full rounded-lg border border-surface-200 dark:border-surface-700
                         bg-slate-50 dark:bg-surface-800
                         text-sm text-slate-800 dark:text-slate-200
                         px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              {...register('notes')}
            />
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>Cancel</Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              {isEdit ? 'Save Changes' : 'Create Invoice'}
            </Button>
          </div>

        </div>
      </form>
    </Modal>
  )
}
