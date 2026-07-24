import { useState, useEffect, Fragment } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button, Modal, Spinner } from '@shared/components/ui'
import registry from '@core/registry/ModuleRegistry'
import { featuresForModule, ROLE_DEFAULTS } from '@core/permissions/permissions'
import PermissionGate from '@shared/components/PermissionGate'
import toast from '@shared/lib/toast'
import { PERM_ACTIONS, fetchPermissionOverrides, savePermissionOverrides } from '../api/users'

// Explicit true/false always wins. A null cell shows what it will actually
// resolve to (mirrors can()'s fallback chain) — faded ✓/✗ instead of a flat
// "—", so e.g. denying a module's View visually cascades to its feature rows
// as a faded ✗ too, not an ambiguous neutral dash.
function cellVisual(value, inherited) {
  if (value === true)  return { symbol: '✓', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25' }
  if (value === false) return { symbol: '✗', cls: 'bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25' }
  return inherited
    ? { symbol: '✓', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/15' }
    : { symbol: '✗', cls: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25 hover:bg-red-500/15' }
}

export default function PermissionModal({ user, tenantId, onClose }) {
  const installedModules = registry.getInstalled()
  // Owners/admins always have full access — same rule as the Users & Permissions
  // panel (src/app/admin/TenantUsersPanel.jsx): overrides cannot be set for them.
  const targetIsAdmin = ['owner', 'admin'].includes(user.role)
  const [overrides, setOverrides] = useState({})
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [expandedModules, setExpandedModules] = useState({})
  const toggleExpand = (moduleId) =>
    setExpandedModules(prev => ({ ...prev, [moduleId]: !prev[moduleId] }))

  useEffect(() => {
    fetchPermissionOverrides(tenantId, user.user_id).then(data => {
      const map = {}
      for (const mod of installedModules) {
        map[mod.id] = PERM_ACTIONS.reduce((acc, a) => ({ ...acc, [a]: null }), {})
        map[mod.id].features = {}
        for (const f of featuresForModule(mod)) {
          map[mod.id].features[f.id] = PERM_ACTIONS.reduce((acc, a) => ({ ...acc, [a]: null }), {})
        }
      }
      for (const row of data) {
        const actions = {
          view:    row.can_view,
          create:  row.can_create,
          edit:    row.can_edit,
          delete:  row.can_delete,
          approve: row.can_approve,
          export:  row.can_export,
        }
        if (row.feature_id) {
          map[row.module_id] ??= { features: {} }
          map[row.module_id].features[row.feature_id] = actions
        } else {
          map[row.module_id] = { ...map[row.module_id], ...actions }
        }
      }
      setOverrides(map)
      setLoading(false)
    })
  }, [user.user_id, tenantId]) // eslint-disable-line react-hooks/exhaustive-deps

  // featureId omitted → toggles the module-wide cell; passed → toggles that one feature's cell.
  const toggle = (moduleId, action, featureId = null) => {
    if (targetIsAdmin) return
    setOverrides(prev => {
      if (featureId) {
        const cur  = prev[moduleId]?.features?.[featureId]?.[action]
        const next = cur === null ? true : cur === true ? false : null
        return {
          ...prev,
          [moduleId]: {
            ...prev[moduleId],
            features: {
              ...prev[moduleId]?.features,
              [featureId]: { ...prev[moduleId]?.features?.[featureId], [action]: next },
            },
          },
        }
      }
      const cur  = prev[moduleId]?.[action]
      const next = cur === null ? true : cur === true ? false : null
      return { ...prev, [moduleId]: { ...prev[moduleId], [action]: next } }
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await savePermissionOverrides(tenantId, user.user_id, overrides)
      toast.success(`Permissions saved for ${user.full_name ?? 'user'}.`)
      onClose()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Permissions — ${user.full_name ?? 'User'}`}
      size="xl"
    >
      {loading ? (
        <div className="flex justify-center py-10"><Spinner className="w-5 h-5" /></div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Click a cell to cycle:{' '}
            <span className="text-emerald-500 font-semibold">✓ allow</span> →{' '}
            <span className="text-red-500 font-semibold">✗ deny</span> →{' '}
            <span className="text-slate-500 font-semibold">faded inherit</span>.
            A faded ✓/✗ shows what the cell will actually resolve to without an explicit override —
            e.g. denying a module's View shows every feature underneath it as a faded ✗ too, until you
            explicitly allow one. Indented rows override a single menu item and win over the module row
            above it — e.g. deny every Configuration row except Company to show only that menu item.
          </p>

          <div className="overflow-x-auto overflow-y-auto max-h-[55vh] rounded-lg border border-surface-200 dark:border-surface-800">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-900">
                  <th className="text-left px-3 py-2.5 font-medium text-slate-500 uppercase tracking-wide">
                    Module
                  </th>
                  {PERM_ACTIONS.map(a => (
                    <th key={a} className="text-center px-3 py-2.5 font-medium text-slate-500 uppercase tracking-wide">
                      {a}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200 dark:divide-surface-800/70">
                {installedModules.map(mod => {
                  const features = featuresForModule(mod)
                  const isOpen   = !!expandedModules[mod.id]
                  return (
                    <Fragment key={mod.id}>
                      <tr className="hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors">
                        <td className="px-3 py-2.5 font-medium text-slate-700 dark:text-slate-300">
                          {features.length > 0 ? (
                            <button
                              onClick={() => toggleExpand(mod.id)}
                              className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white"
                            >
                              {isOpen
                                ? <ChevronDown  className="w-3.5 h-3.5 text-slate-400" />
                                : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                              {mod.name}
                            </button>
                          ) : (
                            <span className="pl-5">{mod.name}</span>
                          )}
                        </td>
                        {PERM_ACTIONS.map(action => {
                          const val = overrides[mod.id]?.[action]
                          const { symbol, cls } = cellVisual(val, ROLE_DEFAULTS[user.role]?.[action] ?? false)
                          return (
                            <td key={action} className="text-center px-3 py-2.5">
                              <button
                                onClick={() => toggle(mod.id, action)}
                                disabled={targetIsAdmin}
                                className={`w-7 h-7 rounded-md text-xs font-bold transition-all border ${cls} ${
                                  targetIsAdmin ? 'opacity-40 cursor-not-allowed' : ''
                                }`}
                              >
                                {symbol}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                      {isOpen && features.map(f => (
                        <tr key={`${mod.id}:${f.id}`} className="bg-surface-50/60 dark:bg-surface-900/40">
                          <td className="px-3 py-1.5 pl-8 text-slate-500 dark:text-slate-400">
                            ↳ {f.label}
                          </td>
                          {PERM_ACTIONS.map(action => {
                            const val = overrides[mod.id]?.features?.[f.id]?.[action]
                            // Inherits the module override if set, else the role default —
                            // mirrors the resolution order in permissions.js can().
                            const inherited = overrides[mod.id]?.[action] ?? ROLE_DEFAULTS[user.role]?.[action] ?? false
                            const { symbol, cls } = cellVisual(val, inherited)
                            return (
                              <td key={action} className="text-center px-3 py-1.5">
                                <button
                                  onClick={() => toggle(mod.id, action, f.id)}
                                  disabled={targetIsAdmin}
                                  className={`w-6 h-6 rounded-md text-xs font-bold transition-all border ${cls} ${
                                    targetIsAdmin ? 'opacity-40 cursor-not-allowed' : ''
                                  }`}
                                >
                                  {symbol}
                                </button>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {targetIsAdmin && (
            <p className="text-xs text-amber-600 dark:text-amber-400/80 bg-amber-500/10 border border-amber-500/20
                          px-3 py-2 rounded-lg">
              Owners and admins have full access to all modules. Overrides cannot be set for these roles.
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={onClose}>
              {targetIsAdmin ? 'Close' : 'Cancel'}
            </Button>
            {!targetIsAdmin && (
              <PermissionGate
                action="edit"
                moduleId="configuration"
                fallback={<Button className="flex-1" disabled>Save (no permission)</Button>}
              >
                <Button className="flex-1" loading={saving} onClick={handleSave}>
                  Save Permissions
                </Button>
              </PermissionGate>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
