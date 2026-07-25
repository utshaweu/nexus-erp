import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@shared/hooks/useAuth'
import { useTenant } from '@core/tenant/TenantContext'
import { usePermissions } from '@core/permissions/PermissionContext'
import { Button, Input, PasswordInput } from '@shared/components/ui'
import toast from '@shared/lib/toast'

// ── Login Page ────────────────────────────────────────────────
function LoginPage() {
  const { signIn, signUp, resetPasswordForEmail } = useAuth()
  const [mode, setMode] = useState('login')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { email: '', password: '', name: '' },
  })

  const switchMode = (next) => {
    setMode(next)
    reset({ email: '', password: '', name: '' })
  }

  const onSubmit = async (data) => {
    if (mode === 'login') {
      const { error } = await signIn(data.email, data.password)
      if (error) toast.error(error.message)
      else toast.success(`Welcome back, ${data.email}!`)
    } else if (mode === 'register') {
      const { error } = await signUp(data.email, data.password, data.name)
      if (error) toast.error(error.message)
      else toast.info(`Confirmation email sent to ${data.email}. Please check your inbox.`)
    } else {
      const { error } = await resetPasswordForEmail(data.email)
      if (error) toast.error(error.message)
      else toast.success(`Password reset link sent to ${data.email}.`)
      switchMode('login')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-surface-950 flex items-center justify-center p-4 font-sans">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.04] dark:opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(99,102,241,1) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700
                          flex items-center justify-center mx-auto mb-4 shadow-glow">
            <span className="text-white font-display font-bold text-xl">N</span>
          </div>
          <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-white">NexusERP</h1>
          <p className="text-sm text-slate-500 mt-1">Enterprise Resource Planning</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur p-8
                        dark:border-surface-800 dark:bg-surface-900/60">
          <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100 text-lg mb-6">
            {mode === 'login'    && 'Sign in to your account'}
            {mode === 'register' && 'Create an account'}
            {mode === 'forgot'   && 'Reset your password'}
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            {mode === 'register' && (
              <Input
                label="Full Name"
                placeholder="John Smith"
                error={errors.name?.message}
                {...register('name', {
                  validate: v => mode === 'login' || (v?.trim().length > 0) || 'Name is required',
                })}
              />
            )}

            <Input
              label="Email"
              type="email"
              placeholder="you@company.com"
              error={errors.email?.message}
              {...register('email', {
                required: 'Email is required',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Enter a valid email address',
                },
              })}
            />

            {mode !== 'forgot' && (
              <div>
                <PasswordInput
                  label="Password"
                  placeholder="••••••••"
                  error={errors.password?.message}
                  {...register('password', {
                    required: mode !== 'forgot' && 'Password is required',
                    minLength: { value: 6, message: 'At least 6 characters required' },
                  })}
                />
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-xs text-brand-400 hover:text-brand-300 transition-colors mt-1.5"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
            )}

            <Button type="submit" loading={isSubmitting} className="w-full mt-2">
              {mode === 'login'    && 'Sign In'}
              {mode === 'register' && 'Create Account'}
              {mode === 'forgot'   && 'Send Reset Link'}
            </Button>
          </form>

          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-surface-800 text-center">
            {mode === 'forgot' ? (
              <button
                onClick={() => switchMode('login')}
                className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
              >
                Back to sign in
              </button>
            ) : (
              <button
                onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
              >
                {mode === 'login'
                  ? "Don't have an account? Sign up"
                  : 'Already have an account? Sign in'}
              </button>
            )}
          </div>

          {/* Demo hint */}
          <div className="mt-3 p-3 rounded-lg bg-slate-100 border border-slate-200
                          dark:bg-surface-800/50 dark:border-surface-700">
            <p className="text-xs text-slate-500 text-center">
              Admin: <span className="text-slate-600 dark:text-slate-400 font-mono">superadmin@nexuserp.com</span>
              {' / '}
              <span className="text-slate-600 dark:text-slate-400 font-mono">superadmin</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Reset Password Page (landed on via the emailed recovery link) ──
const resetPasswordSchema = z.object({
  newPassword:     z.string().min(6, 'New password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your new password'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path:    ['confirmPassword'],
})

function ResetPasswordPage() {
  const { changePassword, signOut } = useAuth()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  })

  const onSubmit = async ({ newPassword }) => {
    const { error } = await changePassword(newPassword)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Password updated. Please sign in again.')
    signOut()
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-surface-950 flex items-center justify-center p-4 font-sans">
      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700
                          flex items-center justify-center mx-auto mb-4 shadow-glow">
            <span className="text-white font-display font-bold text-xl">N</span>
          </div>
          <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-white">NexusERP</h1>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur p-8
                        dark:border-surface-800 dark:bg-surface-900/60">
          <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100 text-lg mb-6">
            Set a new password
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
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

            <Button type="submit" loading={isSubmitting} className="w-full mt-2">
              Update Password
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ── No-tenant error screen ────────────────────────────────────
function NoTenantScreen({ error, onSignOut }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-surface-950 flex items-center justify-center font-sans">
      <div className="text-center max-w-sm px-4">
        <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-4">
          <span className="text-red-500 dark:text-red-400 text-xl">⚠</span>
        </div>
        <h2 className="font-display font-bold text-slate-900 dark:text-white text-lg mb-2">No Workspace Found</h2>
        <p className="text-slate-600 dark:text-slate-400 text-sm mb-2">
          Your account is not linked to any client workspace.
        </p>
        {error && (
          <p className="text-red-600 dark:text-red-400 text-xs font-mono mb-4 bg-red-500/10 border
                        border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <p className="text-slate-500 text-xs mb-6">
          Contact your system administrator to get access.
        </p>
        <Button variant="secondary" onClick={onSignOut}>Sign Out</Button>
      </div>
    </div>
  )
}

// ── Full-screen boot loader ───────────────────────────────────
function BootLoader({ message = 'Loading…' }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-surface-950 flex items-center justify-center font-sans">
      <div className="text-center">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700
                        flex items-center justify-center mx-auto mb-3">
          <span className="text-white font-display font-bold">N</span>
        </div>
        <Loader2 className="w-5 h-5 text-brand-400 animate-spin mx-auto mb-2" />
        <p className="text-slate-500 text-xs">{message}</p>
      </div>
    </div>
  )
}

// ── AuthGuard (exported) ──────────────────────────────────────
/**
 * AuthGuard
 * ─────────
 * Sequential gate. Each step must resolve before rendering children.
 *
 * Gate order:
 *   1. Auth loading      → BootLoader "Authenticating…"
 *   2. Password recovery → ResetPasswordPage (recovery link just opened)
 *   3. No user           → LoginPage
 *   4. Tenant loading    → BootLoader "Loading workspace…"
 *   5. No tenant         → NoTenantScreen (with sign-out)
 *   6. Permissions loading → BootLoader "Loading permissions…"
 *   7. All ready         → render children (the app layout)
 *
 * Demo mode (VITE_DEMO_MODE=true): skips all gates, injects
 * mock globals so the app renders without any Supabase connection.
 */
export default function AuthGuard({ children }) {
  const { user, loading: authLoading, isRecovery, signOut } = useAuth()
  const { tenant, loading: tenantLoading, error: tenantError } = useTenant()
  const { loading: permLoading }                  = usePermissions()
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true'

  // Demo mode — inject mock data and skip all gates
  if (isDemoMode) {
    if (!window.__erp_user__) {
      window.__erp_user__ = {
        id:          'demo',
        email:       'demo@nexuserp.com',
        name:        'Demo Admin',
        isSuperAdmin: true,
        permissions: {},
      }
      window.__erp_tenant__ = {
        id: 'demo-tenant', name: 'Demo Corp',
        slug: 'demo', plan: 'enterprise', status: 'active',
      }
      window.__erp_tenant_user__ = { role: 'owner', full_name: 'Demo Admin' }
    }
    return children
  }

  // Gate 1 — auth resolving
  if (authLoading)   return <BootLoader message="Authenticating…" />

  // Gate 2 — recovery link just opened, must set a new password first
  if (isRecovery)    return <ResetPasswordPage />

  // Gate 3 — not logged in
  if (!user)         return <LoginPage />

  // Gate 4 — tenant resolving
  if (tenantLoading) return <BootLoader message="Loading workspace…" />

  // Gate 5 — user has no tenant
  if (!tenant && tenantError) return <NoTenantScreen error={tenantError} onSignOut={signOut} />

  // Gate 6 — permissions resolving
  if (permLoading)   return <BootLoader message="Loading permissions…" />

  // Gate 7 — everything ready
  return children
}
