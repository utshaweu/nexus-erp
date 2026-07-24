import { useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Modal, Input, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { BILL_STATUS } from '@shared/lib/constants'
import { fetchBillLines, saveBill } from '../api/bills'
import { lineItemSchema, DEFAULT_LINE_ITEM, computeLineItemTotals } from '../api/lineItems'
import LineItemsEditor from './LineItemsEditor'

const billSchema = z.object({
  vendor_id: z.string().min(1, 'Vendor is required'),
  bill_date: z.string().min(1, 'Bill date is required'),
  due_date:  z.string().optional(),
  status:    z.enum(['draft', 'posted', 'paid', 'cancelled']),
  lines:     z.array(lineItemSchema).min(1, 'At least one line item is required'),
})

const DEFAULT_VALUES = {
  vendor_id: '',
  bill_date: new Date().toISOString().slice(0, 10),
  due_date: '', status: 'draft',
  lines: [{ ...DEFAULT_LINE_ITEM }],
}

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function BillModal({ open, onClose, onSaved, bill, vendors, products }) {
  const { tenantId } = useTenant()
  const isEdit = Boolean(bill)

  const {
    register, handleSubmit, reset, control, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(billSchema), defaultValues: DEFAULT_VALUES })

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const watchedLines = watch('lines') || []
  const total = computeLineItemTotals(watchedLines).total_amount

  useEffect(() => {
    if (!open) return
    if (bill) {
      fetchBillLines(bill.id).then(lines => {
        reset({
          vendor_id: bill.vendor_id || '',
          bill_date: bill.bill_date || new Date().toISOString().slice(0, 10),
          due_date:  bill.due_date  || '',
          status:    bill.status    || 'draft',
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
  }, [open, bill, reset])

  const onSubmit = async (data) => {
    try {
      await saveBill(tenantId, bill, data)
      toast.success(isEdit ? 'Bill updated.' : 'Bill created.')
      onSaved(); onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? `Edit ${bill?.bill_number}` : 'New Bill'} size="xl">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-5">

          <div className="grid grid-cols-2 gap-4">
            <Select label="Vendor" error={errors.vendor_id?.message} {...register('vendor_id')}>
              <option value="">Select vendor…</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </Select>
            <Select label="Status" {...register('status')}>
              {Object.entries(BILL_STATUS).map(([v, { label }]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Bill Date" type="date" error={errors.bill_date?.message} {...register('bill_date')} />
            <Input label="Due Date" type="date" {...register('due_date')} />
          </div>

          {errors.lines && (
            <p className="text-xs text-red-500">{errors.lines.message || errors.lines.root?.message}</p>
          )}

          <LineItemsEditor
            fields={fields} register={register} watch={watch} remove={remove} append={append} setValue={setValue}
            products={products} priceField="cost_price" defaultLine={DEFAULT_LINE_ITEM}
          />

          <div className="flex justify-end">
            <div className="w-48 rounded-xl bg-slate-50 dark:bg-surface-800 p-3">
              <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-slate-100">
                <span>Total</span>
                <span className="tabular-nums">${fmt(total)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>Cancel</Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              {isEdit ? 'Save Changes' : 'Create Bill'}
            </Button>
          </div>

        </div>
      </form>
    </Modal>
  )
}
