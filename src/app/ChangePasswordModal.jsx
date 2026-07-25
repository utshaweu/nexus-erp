import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@shared/hooks/useAuth'
import { Modal, Button } from '@shared/components/ui'
import toast from '@shared/lib/toast'

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword:      z.string().min(6, 'New password must be at least 6 characters'),
  confirmPassword:  z.string().min(1, 'Please confirm your new password'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path:    ['confirmPassword'],
})

// Same show/hide pattern as the login form (AuthGuard.jsx) — the shared
// Input component has no built-in toggle slot for password fields.
function PasswordField({ label, placeholder, autoComplete, error, register }) {
  const [show, setShow] = useState(false)

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`w-full px-3 py-2 pr-10 rounded-lg text-sm
                     text-slate-900 dark:text-slate-200
                     placeholder:text-slate-400 dark:placeholder:text-slate-600
                     bg-white dark:bg-surface-900
                     border border-surface-200 dark:border-surface-700
                     hover:border-surface-300 dark:hover:border-surface-600
                     focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500
                     transition-colors
                     ${error ? 'border-red-500 focus:ring-red-500' : ''}`}
          {...register}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2
                     text-slate-400 hover:text-slate-600
                     dark:text-slate-500 dark:hover:text-slate-300"
        >
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
    </div>
  )
}

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
          <PasswordField
            label="Current Password"
            placeholder="Enter current password"
            autoComplete="current-password"
            error={errors.currentPassword?.message}
            register={register('currentPassword')}
          />
          <PasswordField
            label="New Password"
            placeholder="At least 6 characters"
            autoComplete="new-password"
            error={errors.newPassword?.message}
            register={register('newPassword')}
          />
          <PasswordField
            label="Confirm New Password"
            placeholder="Re-enter new password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            register={register('confirmPassword')}
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
