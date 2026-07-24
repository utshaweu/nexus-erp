import { useState, useEffect, Fragment } from 'react'
import { supabase } from '@/shared/api/supabase'
import { ChevronDown, ChevronUp, ChevronRight, Save } from 'lucide-react'
import { Button } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { ACTIONS, ROLE_DEFAULTS, featuresForModule } from '@core/permissions/permissions'
import registry from '@core/registry/ModuleRegistry'
import PermissionCell from './PermissionCell'

const ACTION_LABELS = {
  [ACTIONS.VIEW]:    { label: 'View',    short: 'V' },
  [ACTIONS.CREATE]:  { label: 'Create',  short: 'C' },
  [ACTIONS.EDIT]:    { label: 'Edit',    short: 'E' },
  [ACTIONS.DELETE]:  { label: 'Delete',  short: 'D' },
  [ACTIONS.APPROVE]: { label: 'Approve', short: 'A' },
  [ACTIONS.EXPORT]:  { label: 'Export',  short: 'X' },
}

const ALL_ACTIONS = Object.values(ACTIONS)

export default function UserPermissionEditor({ user, tenantId, onSaved }) {
  const [matrix, setMatrix] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [expandedModules, setExpandedModules] = useState({})
  const toggleModuleExpand = (moduleId) =>
    setExpandedModules(prev => ({ ...prev, [moduleId]: !prev[moduleId] }))

  const installedModules = registry.getInstalled()

  useEffect(() => {
    if (!user || !tenantId) return
    let active = true

    const load = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('tenant_user_permissions')
          .select('module_id, feature_id, can_view, can_create, can_edit, can_delete, can_approve, can_export')
          .eq('tenant_id', tenantId)
          .eq('user_id',   user.user_id)

        if (error) throw error
        if (!active) return

        const loadedModule  = {}
        const loadedFeature = {} // moduleId -> featureId -> actions
        for (const row of data ?? []) {
          const actions = {
            [ACTIONS.VIEW]:    row.can_view,
            [ACTIONS.CREATE]:  row.can_create,
            [ACTIONS.EDIT]:    row.can_edit,
            [ACTIONS.DELETE]:  row.can_delete,
            [ACTIONS.APPROVE]: row.can_approve,
            [ACTIONS.EXPORT]:  row.can_export,
          }
          if (row.feature_id) {
            loadedFeature[row.module_id] ??= {}
            loadedFeature[row.module_id][row.feature_id] = actions
          } else {
            loadedModule[row.module_id] = actions
          }
        }

        const emptyActions = () => ({
          [ACTIONS.VIEW]: null, [ACTIONS.CREATE]: null, [ACTIONS.EDIT]: null,
          [ACTIONS.DELETE]: null, [ACTIONS.APPROVE]: null, [ACTIONS.EXPORT]: null,
        })

        const full = {}
        for (const mod of installedModules) {
          full[mod.id] = loadedModule[mod.id] ?? emptyActions()
          full[mod.id].features = {}
          for (const f of featuresForModule(mod)) {
            full[mod.id].features[f.id] = loadedFeature[mod.id]?.[f.id] ?? emptyActions()
          }
        }
        setMatrix(full)
      } catch (err) {
        toast.error('Failed to load permissions: ' + err.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [user?.user_id, tenantId]) // eslint-disable-line react-hooks/exhaustive-deps

  // featureId omitted → edits the module-wide cell; passed → edits that one feature's cell.
  const handleCellChange = (moduleId, action, value, featureId = null) => {
    setMatrix(prev => {
      if (featureId) {
        return {
          ...prev,
          [moduleId]: {
            ...prev[moduleId],
            features: {
              ...prev[moduleId]?.features,
              [featureId]: { ...prev[moduleId]?.features?.[featureId], [action]: value },
            },
          },
        }
      }
      return { ...prev, [moduleId]: { ...prev[moduleId], [action]: value } }
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const rows = []
      for (const [module_id, actions] of Object.entries(matrix)) {
        if (ALL_ACTIONS.some(a => actions[a] !== null)) {
          rows.push({
            tenant_id: tenantId, user_id: user.user_id, module_id, feature_id: '',
            can_view: actions[ACTIONS.VIEW], can_create: actions[ACTIONS.CREATE],
            can_edit: actions[ACTIONS.EDIT], can_delete: actions[ACTIONS.DELETE],
            can_approve: actions[ACTIONS.APPROVE], can_export: actions[ACTIONS.EXPORT],
            updated_at: new Date().toISOString(),
          })
        }
        for (const [feature_id, fActions] of Object.entries(actions.features ?? {})) {
          if (ALL_ACTIONS.some(a => fActions[a] !== null)) {
            rows.push({
              tenant_id: tenantId, user_id: user.user_id, module_id, feature_id,
              can_view: fActions[ACTIONS.VIEW], can_create: fActions[ACTIONS.CREATE],
              can_edit: fActions[ACTIONS.EDIT], can_delete: fActions[ACTIONS.DELETE],
              can_approve: fActions[ACTIONS.APPROVE], can_export: fActions[ACTIONS.EXPORT],
              updated_at: new Date().toISOString(),
            })
          }
        }
      }

      const { error: delErr } = await supabase
        .from('tenant_user_permissions')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('user_id',   user.user_id)

      if (delErr) throw delErr

      if (rows.length > 0) {
        const { error: insErr } = await supabase
          .from('tenant_user_permissions')
          .insert(rows)
        if (insErr) throw insErr
      }

      toast.success(`Permissions saved for ${user.full_name}`)
      onSaved?.()
    } catch (err) {
      toast.error('Save failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="py-8 text-center text-slate-500 text-sm">
        Loading permissions…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-md bg-emerald-500/20 border border-emerald-500/40
                           text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">✓</span>
          Explicit allow
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-md bg-red-500/20 border border-red-500/40
                           text-red-600 dark:text-red-400 flex items-center justify-center font-bold text-xs">✗</span>
          Explicit deny
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-md bg-emerald-500/10 border border-emerald-500/25
                           text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">✓</span>
          Inherited, resolves allowed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-md bg-red-500/10 border border-red-500/25
                           text-red-600 dark:text-red-400 flex items-center justify-center font-bold text-xs">✗</span>
          Inherited, resolves denied
        </span>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        A feature row inherits its module's row (if set) before falling back to the role default — denying a
        module's View cascades to every feature underneath it as a faded ✗, until you explicitly allow one.
      </p>

      {/* Matrix */}
      <div className="overflow-x-auto overflow-y-auto max-h-[55vh]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-white dark:bg-surface-900">
              <th className="text-left py-2 px-3 text-slate-500 font-medium w-36">Module</th>
              {ALL_ACTIONS.map(action => (
                <th key={action} className="py-2 px-1 text-center text-slate-500 font-medium w-10">
                  {ACTION_LABELS[action].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {installedModules.map(mod => {
              const roleDefaults = ROLE_DEFAULTS[user.role] ?? {}
              const modMatrix    = matrix[mod.id] ?? {}
              const Icon         = mod.icon
              const disabled     = ['owner','admin'].includes(user.role)
              const features     = featuresForModule(mod)
              const isOpen       = !!expandedModules[mod.id]

              return (
                <Fragment key={mod.id}>
                  <tr className="border-t border-surface-200 dark:border-surface-800">
                    <td className="py-2 px-3">
                      {features.length > 0 ? (
                        <button
                          onClick={() => toggleModuleExpand(mod.id)}
                          className="flex items-center gap-2 hover:text-slate-900 dark:hover:text-white"
                        >
                          {isOpen
                            ? <ChevronDown  className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            : <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
                          <div
                            className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor:`${mod.color}20`, border:`1px solid ${mod.color}30` }}
                          >
                            <Icon className="w-3 h-3" style={{ color: mod.color }} />
                          </div>
                          <span className="text-slate-700 dark:text-slate-300 font-medium">{mod.name}</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 pl-[22px]">
                          <div
                            className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor:`${mod.color}20`, border:`1px solid ${mod.color}30` }}
                          >
                            <Icon className="w-3 h-3" style={{ color: mod.color }} />
                          </div>
                          <span className="text-slate-700 dark:text-slate-300 font-medium">{mod.name}</span>
                        </div>
                      )}
                    </td>
                    {ALL_ACTIONS.map(action => (
                      <td key={action} className="py-2 px-1 text-center">
                        <div className="flex justify-center">
                          <PermissionCell
                            value={modMatrix[action] ?? null}
                            roleDefault={roleDefaults[action] ?? false}
                            onChange={(val) => handleCellChange(mod.id, action, val)}
                            disabled={disabled}
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                  {isOpen && features.map(f => {
                    const fMatrix = modMatrix.features?.[f.id] ?? {}
                    return (
                      <tr key={`${mod.id}:${f.id}`} className="bg-surface-50/60 dark:bg-surface-900/40">
                        <td className="py-1.5 pl-8 pr-3 text-slate-500 dark:text-slate-400">
                          ↳ {f.label}
                        </td>
                        {ALL_ACTIONS.map(action => (
                          <td key={action} className="py-1.5 px-1 text-center">
                            <div className="flex justify-center">
                              <PermissionCell
                                value={fMatrix[action] ?? null}
                                // Inherits the module override if set, else the role default —
                                // mirrors the resolution order in permissions.js can().
                                roleDefault={modMatrix[action] ?? roleDefaults[action] ?? false}
                                onChange={(val) => handleCellChange(mod.id, action, val, f.id)}
                                disabled={disabled}
                              />
                            </div>
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {['owner','admin'].includes(user.role) && (
        <p className="text-xs text-amber-600 dark:text-amber-400/80 bg-amber-500/10 border border-amber-500/20
                      px-3 py-2 rounded-lg">
          Owners and admins have full access to all modules. Overrides cannot be set for these roles.
        </p>
      )}

      {!['owner','admin'].includes(user.role) && (
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} loading={saving}>
            <Save className="w-4 h-4" />
            Save Permissions
          </Button>
        </div>
      )}
    </div>
  )
}
