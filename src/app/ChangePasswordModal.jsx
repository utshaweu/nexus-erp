import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@shared/hooks/useAuth'
import { Modal, PasswordInput, Button } from '@shared/components/ui'
import toast from '@shared/lib/toast'

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword:      z.string().min(6, 'New password must be at least 6 characters'),
  confirmPassword:  z.string().min(1, 'Please confirm your new password'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path:    ['confirmPassword'],
})

export default function ChangePasswordModal({ onClose }) {
  const { user, signIn, changePassword } = useAuth()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const onSubmit = async ({ currentPassword, newPassword }) => {
    // Re-verify identity with the current password before rotating it
    const { error: verifyError } = await signIn(user.email, currentPassword)
    if (verifyError) {
      toast.error('Current password is incorrect')
      return
    }

    const { error } = await changePassword(newPassword)
    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Password changed successfully')
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="Change Password" size="sm">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          <PasswordInput
            label="Current Password"
            placeholder="Enter current password"
            autoComplete="current-password"
            error={errors.currentPassword?.message}
            {...register('currentPassword')}
          />
          <PasswordInput
            label="New Password"
            placeholder="At least 6 characters"
            autoComplete="new-password"
            error={errors.newPassword?.message}
            {...register('newPassword')}
          />
          <PasswordInput
            label="Confirm New Password"
            placeholder="Re-enter new password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              Update Password
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
