import { useState } from 'react'
import { supabase } from '@/shared/api/supabase'
import { AlertTriangle } from 'lucide-react'
import { Button, Modal, Input } from '@shared/components/ui'
import { clsx } from 'clsx'
import toast from '@shared/lib/toast'
import { ALL_MODULE_IDS } from './moduleMeta'
import ModuleToggle from './ModuleToggle'

export default function CreateTenantModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', slug: '', plan: 'starter',
    adminEmail: '', adminName: '', adminPassword: '',
    modules: [],
  })
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState(1)

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const toggleModule = (id, active) => {
    setForm(prev => ({
      ...prev,
      modules: active
        ? [...prev.modules, id]
        : prev.modules.filter(m => m !== id),
    }))
  }

  const handleNameChange = (name) => {
    update('name', name)
    update('slug', name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
  }

  const handleCreate = async () => {
    if (!form.name || !form.adminEmail || !form.adminPassword) {
      toast.error('Please fill all required fields')
      return
    }
    setSaving(true)
    try {
      // Save the super admin session tokens so we can restore them after signUp
      // switches the client session to the newly-created user.
      const { data: { session: adminSession } } = await supabase.auth.getSession()

      // 1. Create the tenant row — super admin session is still active here
      const { data: tenant, error: tenantErr } = await supabase
        .from('tenants')
        .insert({ name: form.name, slug: form.slug, plan: form.plan })
        .select()
        .single()
      if (tenantErr) throw tenantErr

      // 2. Create the auth user — session switches to new user after this call
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email:    form.adminEmail,
        password: form.adminPassword,
        options:  { data: { full_name: form.adminName, role: 'admin' } },
      })
      if (authErr) throw authErr

      const userId = authData.user?.id
      if (!userId) throw new Error('User creation failed — check Supabase Auth settings')

      // 3. Create membership + install modules via SECURITY DEFINER RPC.
      //    This bypasses RLS so it works even though the client is now in the
      //    new user's session. The function allows a freshly-created user with
      //    no existing memberships to link themselves to their first tenant.
      const { error: setupErr } = await supabase.rpc('setup_tenant_user', {
        p_tenant_id:  tenant.id,
        p_user_id:    userId,
        p_role:       'owner',
        p_full_name:  form.adminName || form.adminEmail,
        p_module_ids: form.modules,
      })
      if (setupErr) throw setupErr

      // 4. Restore super admin session so the UI stays on the admin panel
      if (adminSession) {
        await supabase.auth.setSession({
          access_token:  adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        })
      }

      toast.success(`Tenant "${form.name}" created successfully`)
      onCreated(tenant)
      onClose()
      setForm({ name:'', slug:'', plan:'starter', adminEmail:'', adminName:'', adminPassword:'', modules:[] })
      setStep(1)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const steps = ['Details', 'Modules', 'Admin User']

  return (
    <Modal open={open} onClose={onClose} title="New Client / Tenant" size="lg">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <button
              onClick={() => setStep(i + 1)}
              className={clsx(
                'w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-all',
                step === i + 1
                  ? 'bg-brand-600 text-white'
                  : step > i + 1
                  ? 'bg-emerald-600 text-white'
                  : 'bg-surface-200 dark:bg-surface-800 text-slate-500'
              )}
            >
              {step > i + 1 ? '✓' : i + 1}
            </button>
            <span className={clsx(
              'text-xs font-medium',
              step === i + 1 ? 'text-slate-800 dark:text-slate-200' : 'text-slate-500'
            )}>{s}</span>
            {i < steps.length - 1 && (
              <div className={clsx('h-px w-8 mx-1', step > i + 1 ? 'bg-emerald-600' : 'bg-surface-200 dark:bg-surface-700')} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1 — Tenant details */}
      {step === 1 && (
        <div className="space-y-4">
          <Input
            label="Client / Company Name *"
            placeholder="e.g. Prince Bazar"
            value={form.name}
            onChange={e => handleNameChange(e.target.value)}
          />
          <Input
            label="URL Slug *"
            placeholder="prince-bazar"
            value={form.slug}
            onChange={e => update('slug', e.target.value)}
          />
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1.5">
              Plan
            </label>
            <div className="flex gap-3">
              {['starter', 'growth', 'enterprise'].map(plan => (
                <button
                  key={plan}
                  onClick={() => update('plan', plan)}
                  className={clsx(
                    'flex-1 py-2 px-3 rounded-lg border text-xs font-semibold capitalize transition-all',
                    form.plan === plan
                      ? 'bg-brand-100 dark:bg-brand-600/20 border-brand-500 text-brand-700 dark:text-brand-300'
                      : 'border-surface-200 dark:border-surface-700 text-slate-500 dark:text-slate-400 hover:border-surface-300 dark:hover:border-surface-600'
                  )}
                >
                  {plan}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={() => setStep(2)} disabled={!form.name || !form.slug}>
              Next: Select Modules →
            </Button>
          </div>
        </div>
      )}

      {/* Step 2 — Module selection */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Choose which modules <strong className="text-slate-800 dark:text-slate-200">{form.name}</strong> will have access to.
            These can be changed later.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {ALL_MODULE_IDS.map(id => (
              <ModuleToggle
                key={id}
                moduleId={id}
                active={form.modules.includes(id)}
                onChange={toggleModule}
              />
            ))}
          </div>
          <p className="text-xs text-slate-500">
            {form.modules.length} module{form.modules.length !== 1 ? 's' : ''} selected
          </p>
          <div className="flex justify-between pt-2">
            <Button variant="secondary" onClick={() => setStep(1)}>← Back</Button>
            <Button onClick={() => setStep(3)}>Next: Admin User →</Button>
          </div>
        </div>
      )}

      {/* Step 3 — Admin user creation */}
      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Create the first admin user for <strong className="text-slate-800 dark:text-slate-200">{form.name}</strong>.
          </p>
          <Input
            label="Admin Full Name"
            placeholder="e.g. John Smith"
            value={form.adminName}
            onChange={e => update('adminName', e.target.value)}
          />
          <Input
            label="Admin Email *"
            type="email"
            placeholder="admin@company.com"
            value={form.adminEmail}
            onChange={e => update('adminEmail', e.target.value)}
          />
          <Input
            label="Temporary Password *"
            type="password"
            placeholder="min. 8 characters"
            value={form.adminPassword}
            onChange={e => update('adminPassword', e.target.value)}
          />

          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5" />
            A confirmation email will be sent. The user must confirm before logging in.
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="secondary" onClick={() => setStep(2)}>← Back</Button>
            <Button onClick={handleCreate} loading={saving}>
              Create Tenant
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
