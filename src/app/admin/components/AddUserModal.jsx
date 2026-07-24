import { useState } from 'react'
import { supabase } from '@/shared/api/supabase'
import { clsx } from 'clsx'
import { Button, Modal, Input } from '@shared/components/ui'
import toast from '@shared/lib/toast'

export default function AddUserModal({ open, onClose, tenantId, onAdded }) {
  const [form, setForm] = useState({
    email: '', fullName: '', password: '', role: 'user',
  })
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    if (!form.email || !form.password) {
      toast.error('Email and password are required')
      return
    }
    setSaving(true)
    try {
      // Save current session — signUp() will switch to the new user's session
      const { data: { session: currentSession } } = await supabase.auth.getSession()

      // 1. Create the auth user
      const { data, error: authErr } = await supabase.auth.signUp({
        email:    form.email,
        password: form.password,
        options:  { data: { full_name: form.fullName } },
      })
      if (authErr) throw authErr

      const userId = data.user?.id
      if (!userId) throw new Error('User creation failed')

      // 2. Link user to this tenant via SECURITY DEFINER RPC — bypasses RLS so
      //    the insert works even though the session is now the new user's.
      const { error: setupErr } = await supabase.rpc('setup_tenant_user', {
        p_tenant_id:  tenantId,
        p_user_id:    userId,
        p_role:       form.role,
        p_full_name:  form.fullName || form.email,
        p_module_ids: [],
      })
      if (setupErr) throw setupErr

      // 3. Restore the admin's session so the UI stays on the team panel
      if (currentSession) {
        await supabase.auth.setSession({
          access_token:  currentSession.access_token,
          refresh_token: currentSession.refresh_token,
        })
      }

      toast.success(`User ${form.email} added`)
      onAdded()
      onClose()
      setForm({ email:'', fullName:'', password:'', role:'user' })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add New User" size="sm">
      <div className="space-y-4">
        <Input
          label="Full Name"
          placeholder="e.g. Alice Wang"
          value={form.fullName}
          onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
        />
        <Input
          label="Email *"
          type="email"
          placeholder="user@company.com"
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
        />
        <Input
          label="Temporary Password *"
          type="password"
          placeholder="min. 8 characters"
          value={form.password}
          onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
        />
        <div>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1.5">
            Role
          </label>
          <div className="grid grid-cols-3 gap-2">
            {['manager','user','viewer'].map(role => (
              <button
                key={role}
                onClick={() => setForm(f => ({ ...f, role }))}
                className={clsx(
                  'py-2 px-3 rounded-lg border text-xs font-semibold capitalize transition-all',
                  form.role === role
                    ? 'bg-brand-100 dark:bg-brand-600/20 border-brand-500 text-brand-700 dark:text-brand-300'
                    : 'border-surface-200 dark:border-surface-700 text-slate-500 dark:text-slate-400 hover:border-surface-300 dark:hover:border-surface-600'
                )}
              >
                {role}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleAdd} loading={saving}>Add User</Button>
        </div>
      </div>
    </Modal>
  )
}
