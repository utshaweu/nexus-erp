import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Modal, Input, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { savePosition } from '../api/positions'

const positionSchema = z.object({
  title:         z.string().trim().min(1, 'Title is required'),
  department_id: z.string().optional(),
  description:   z.string().optional(),
})

export default function PositionModal({ open, onClose, onSaved, tenantId, position, departments }) {
  const isEdit = Boolean(position)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm({
      resolver: zodResolver(positionSchema),
      defaultValues: { title: '', department_id: '', description: '' },
    })

  useEffect(() => {
    if (!open) return
    reset(position
      ? { title: position.title, department_id: position.department_id || '', description: position.description || '' }
      : { title: '', department_id: '', description: '' }
    )
  }, [open, position, reset])

  const onSubmit = async (data) => {
    try {
      await savePosition(tenantId, position, data)
      toast.success(isEdit ? 'Position updated.' : 'Position created.')
      onSaved(); onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Position' : 'New Position'} size="sm">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Input
          label="Position Title"
          placeholder="e.g. Senior Developer"
          error={errors.title?.message}
          {...register('title')}
        />
        <Select label="Department (optional)" {...register('department_id')}>
          <option value="">— None —</option>
          {departments.filter(d => d.is_active).map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </Select>
        <Input
          label="Description (optional)"
          placeholder="Brief description of this role"
          {...register('description')}
        />
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isSubmitting}>
            {isEdit ? 'Save Changes' : 'Create Position'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
