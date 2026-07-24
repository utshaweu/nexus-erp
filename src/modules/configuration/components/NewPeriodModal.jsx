import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Modal, Input } from '@shared/components/ui'
import toast from '@shared/lib/toast'

const periodSchema = z
  .object({
    name:       z.string().trim().min(1, 'Period name is required').max(100),
    start_date: z.string().min(1, 'Start date is required'),
    end_date:   z.string().min(1, 'End date is required'),
  })
  .refine(d => d.start_date < d.end_date, {
    message: 'End date must be after start date',
    path:    ['end_date'],
  })

export default function NewPeriodModal({ onClose, onSave }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(periodSchema),
    defaultValues: { name: '', start_date: '', end_date: '' },
  })

  const onSubmit = async (data) => {
    const err = await onSave(data)
    if (err) {
      toast.error(err)
    } else {
      toast.success('Fiscal period created.')
      onClose()
    }
  }

  return (
    <Modal open onClose={onClose} title="New Fiscal Period" size="sm">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          <Input
            label="Period Name"
            placeholder="e.g. FY 2025-26 Q1"
            error={errors.name?.message}
            {...register('name')}
          />
          <div className="grid grid-cols-2 gap-4">
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
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              Create Period
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
