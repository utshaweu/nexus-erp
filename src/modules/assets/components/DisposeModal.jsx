import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertTriangle } from 'lucide-react'
import { Button, Modal, Input } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { disposeAsset } from '../api/assets'

const disposeSchema = z.object({
  disposal_date:   z.string().min(1, 'Disposal date is required'),
  disposal_amount: z.coerce.number({ invalid_type_error: 'Enter a valid amount' }).min(0),
  notes:           z.string().optional(),
})

const DEFAULT_VALUES = { disposal_date: new Date().toISOString().slice(0, 10), disposal_amount: 0, notes: '' }

export default function DisposeModal({ open, onClose, onSaved, asset }) {
  const { tenantId } = useTenant()
  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(disposeSchema), defaultValues: DEFAULT_VALUES })

  useEffect(() => { if (open) reset(DEFAULT_VALUES) }, [open, reset])

  const onSubmit = async (data) => {
    try {
      const { submitted } = await disposeAsset(tenantId, asset, data)
      toast.success(submitted ? 'Disposal request submitted for approval.' : 'Asset disposed.')
      onSaved(); onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Dispose Asset" size="sm">
      <div className="mb-4 flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-red-700 dark:text-red-400">
          This will mark <strong>{asset?.name}</strong> as disposed and cancel all remaining depreciation entries.
        </p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Input label="Disposal Date" type="date" error={errors.disposal_date?.message} {...register('disposal_date')} />
        <Input label="Disposal / Sale Amount" type="number" min="0" step="0.01" placeholder="0.00" error={errors.disposal_amount?.message} {...register('disposal_amount')} />
        <Input label="Notes (optional)" placeholder="Reason for disposal, sale details…" {...register('notes')} />
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="danger" className="flex-1" loading={isSubmitting}>Dispose Asset</Button>
        </div>
      </form>
    </Modal>
  )
}
