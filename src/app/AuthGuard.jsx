import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@shared/hooks/useAuth'
import { useTenant } from '@core/tenant/TenantContext'
import { usePermissions } from '@core/permissions/PermissionContext'
import { Button, Input } from '@shared/components/ui'
import toast from '@shared/lib/toast'

// ── Login Page ────────────────────────────────────────────────
function LoginPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode]     = useState('login')
  const [showPw, setShowPw] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { email: 'superadmin@nexuserp.com', password: 'superadmin', name: '' },
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
    } else {
      const { error } = await signUp(data.email, data.password, data.name)
      if (error) toast.error(error.message)
      else toast.info(`Confirmation email sent to ${data.email}. Please check your inbox.`)
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
            {mode === 'login' ? 'Sign in to your account' : 'Create an account'}
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

            {/* Password with show/hide toggle */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 pr-10 rounded-lg text-sm
                             text-slate-800 placeholder:text-slate-400
                             bg-white border border-slate-300
                             hover:border-slate-400 focus:outline-none focus:ring-1
                             focus:ring-brand-500 focus:border-brand-500 transition-colors
                             dark:text-slate-200 dark:placeholder:text-slate-600
                             dark:bg-surface-900 dark:border-surface-700
                             dark:hover:border-surface-600"
                  {...register('password', {
                    required: 'Password is required',
                    minLength: { value: 6, message: 'At least 6 characters required' },
                  })}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2
                             text-slate-400 hover:text-slate-600
                             dark:text-slate-500 dark:hover:text-slate-300"
                >
                  {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-500">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" loading={isSubmitting} className="w-full mt-2">
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-surface-800 text-center">
            <button
              onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
              className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
            >
              {mode === 'login'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </button>
          </div>

          {/* Demo hint */}
          <div className="mt-3 p-3 rounded-lg bg-slate-100 border border-slate-200
                          dark:bg-surface-800/50 dark:border-surface-700">
            <p className="text-xs text-slate-500 text-center">
              Demo: <span className="text-slate-600 dark:text-slate-400 font-mono">demo@nexuserp.com</span>
              {' / '}
              <span className="text-slate-600 dark:text-slate-400 font-mono">demo123456</span>
            </p>
          </div>
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
 *   1. Auth loading    → BootLoader "Authenticating…"
 *   2. No user         → LoginPage
 *   3. Tenant loading  → BootLoader "Loading workspace…"
 *   4. No tenant       → NoTenantScreen (with sign-out)
 *   5. Permissions loading → BootLoader "Loading permissions…"
 *   6. All ready       → render children (the app layout)
 *
 * Demo mode (VITE_DEMO_MODE=true): skips all gates, injects
 * mock globals so the app renders without any Supabase connection.
 */
export default function AuthGuard({ children }) {
  const { user, loading: authLoading, signOut }   = useAuth()
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

  // Gate 2 — not logged in
  if (!user)         return <LoginPage />

  // Gate 3 — tenant resolving
  if (tenantLoading) return <BootLoader message="Loading workspace…" />

  // Gate 4 — user has no tenant
  if (!tenant && tenantError) return <NoTenantScreen error={tenantError} onSignOut={signOut} />

  // Gate 5 — permissions resolving
  if (permLoading)   return <BootLoader message="Loading permissions…" />

  // Gate 6 — everything ready
  return children
}
