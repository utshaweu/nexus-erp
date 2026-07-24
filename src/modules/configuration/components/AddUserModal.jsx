import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus } from 'lucide-react'
import { Button, Modal, Input, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { addTenantUser, ROLE_OPTIONS } from '../api/users'

const addUserSchema = z.object({
  email:     z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  full_name: z.string().trim().optional(),
  role:      z.enum(['owner', 'admin', 'manager', 'user', 'viewer'], {
    errorMap: () => ({ message: 'Select a valid role' }),
  }),
})

export default function AddUserModal({ onClose, onAdded }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(addUserSchema),
    defaultValues: { email: '', full_name: '', role: 'user' },
  })

  const onSubmit = async (data) => {
    try {
      await addTenantUser(data)
      toast.success(`${data.email} added to the tenant.`)
      onAdded()
      onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <Modal open onClose={onClose} title="Add User to Tenant" size="sm">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            The user must already have a NexusERP account. Enter their registered email address.
          </p>

          <Input
            label="Email Address"
            type="email"
            placeholder="user@example.com"
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Full Name (optional)"
            placeholder="Jane Smith"
            {...register('full_name')}
          />
          <Select
            label="Role"
            {...register('role')}
          >
            {ROLE_OPTIONS.map(r => (
              <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
            ))}
          </Select>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              <Plus className="w-4 h-4" />Add User
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
