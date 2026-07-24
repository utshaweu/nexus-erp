import { useState, useEffect } from 'react'
import { supabase } from '@/shared/api/supabase'
import { Button, Modal } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { ALL_MODULE_IDS } from './moduleMeta'
import ModuleToggle from './ModuleToggle'

export default function TenantModulesModal({ tenant, open, onClose }) {
  const [modules, setModules] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !tenant) return
    supabase
      .from('tenant_modules')
      .select('module_id')
      .eq('tenant_id', tenant.id)
      .then(({ data }) => setModules(data?.map(r => r.module_id) ?? []))
  }, [open, tenant])

  const toggleModule = (id, active) => {
    setModules(prev => active ? [...prev, id] : prev.filter(m => m !== id))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('tenant_modules').delete().eq('tenant_id', tenant.id)
      if (modules.length > 0) {
        await supabase.from('tenant_modules').insert(
          modules.map(module_id => ({
            tenant_id: tenant.id,
            module_id,
            installed_by: user?.id,
          }))
        )
      }
      toast.success('Modules updated')
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Modules — ${tenant?.name}`}
      size="md"
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Toggle modules on/off for this client. Changes take effect on their next login.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {ALL_MODULE_IDS.map(id => (
            <ModuleToggle
              key={id}
              moduleId={id}
              active={modules.includes(id)}
              onChange={toggleModule}
            />
          ))}
        </div>
        <div className="flex justify-between items-center pt-2">
          <span className="text-xs text-slate-500">
            {modules.length} module{modules.length !== 1 ? 's' : ''} active
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>Save Changes</Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
