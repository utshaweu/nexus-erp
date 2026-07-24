import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Modal, Input } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { saveDepartment } from '../api/departments'

const deptSchema = z.object({
  name:        z.string().trim().min(1, 'Name is required'),
  description: z.string().optional(),
})

export default function DeptModal({ open, onClose, onSaved, tenantId, dept }) {
  const isEdit = Boolean(dept)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm({ resolver: zodResolver(deptSchema), defaultValues: { name: '', description: '' } })

  useEffect(() => {
    if (!open) return
    reset(dept ? { name: dept.name, description: dept.description || '' } : { name: '', description: '' })
  }, [open, dept, reset])

  const onSubmit = async (data) => {
    try {
      await saveDepartment(tenantId, dept, data)
      toast.success(isEdit ? 'Department updated.' : 'Department created.')
      onSaved(); onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Department' : 'New Department'} size="sm">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Input
          label="Department Name"
          placeholder="e.g. Engineering"
          error={errors.name?.message}
          {...register('name')}
        />
        <Input
          label="Description (optional)"
          placeholder="Brief description"
          {...register('description')}
        />
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isSubmitting}>
            {isEdit ? 'Save Changes' : 'Create Department'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
