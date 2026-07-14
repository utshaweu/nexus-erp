import { Settings, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { Badge, Button } from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import registry from '@core/registry/ModuleRegistry'
import { clsx } from 'clsx'
import { getModuleMeta } from './moduleMeta'

export default function WorkflowCard({ workflow, onEdit, onToggle, onDelete }) {
  const meta  = getModuleMeta(workflow.module)
  const steps = workflow.steps || []
  const { Icon } = meta

  return (
    <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900/60 overflow-hidden hover:shadow-md dark:hover:shadow-brand-500/5 transition-all duration-200">
      {/* Colored top accent */}
      <div className="h-1 w-full" style={{ backgroundColor: meta.color }} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${meta.color}18` }}>
              <Icon className="w-5 h-5" style={{ color: meta.color }} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 leading-tight">{workflow.name}</h3>
              {workflow.trigger_condition && (
                <p className="text-xs text-slate-500 mt-0.5">{workflow.trigger_condition}</p>
              )}
              {workflow.feature && (
                <span
                  className="inline-block mt-1 text-xs px-1.5 py-0.5 rounded font-medium"
                  style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
                >
                  {registry.get(workflow.module)?.menuItems?.find(mi => mi.path === workflow.feature)?.label || workflow.feature}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge color={workflow.is_active ? 'green' : 'default'}>
              {workflow.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>

        {/* Steps visualization */}
        {steps.length === 0 ? (
          <p className="text-xs text-slate-400 italic mb-4">No steps configured.</p>
        ) : (
          <div className="space-y-2 mb-5">
            {steps.map((step, i) => (
              <div key={step.id || i} className="flex items-center gap-2">
                {/* Connector line */}
                <div className="flex flex-col items-center flex-shrink-0 self-stretch">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border flex-shrink-0"
                    style={{ backgroundColor: `${meta.color}18`, borderColor: `${meta.color}40`, color: meta.color }}
                  >
                    {i + 1}
                  </div>
                  {i < steps.length - 1 && (
                    <div className="w-px flex-1 mt-1" style={{ backgroundColor: `${meta.color}25` }} />
                  )}
                </div>
                <div className="flex-1 flex items-center justify-between px-3 py-2 rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 mb-0.5">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{step.step_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{step.approver_role}</span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-medium"
                      style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
                    >
                      {step.approval_type === 'any' ? 'Any' : 'All'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-surface-100 dark:border-surface-800">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              {steps.length} step{steps.length !== 1 ? 's' : ''}
            </span>
            <span className="w-1 h-1 rounded-full bg-surface-300 dark:bg-surface-600" />
            <span className={clsx('text-xs font-medium', workflow.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400')}>
              {workflow.is_active ? '● Active' : '○ Inactive'}
            </span>
          </div>
          <PermissionGate action="edit" moduleId="approval">
            <div className="flex items-center gap-1">
              <button
                onClick={() => onToggle(workflow)}
                title={workflow.is_active ? 'Deactivate' : 'Activate'}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
              >
                {workflow.is_active
                  ? <ToggleRight className="w-4 h-4 text-emerald-500" />
                  : <ToggleLeft  className="w-4 h-4" />
                }
              </button>
              <Button variant="ghost" size="xs" onClick={() => onEdit(workflow)}>
                <Settings className="w-3.5 h-3.5" />Edit
              </Button>
              <button
                onClick={() => onDelete(workflow)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </PermissionGate>
        </div>
      </div>
    </div>
  )
}
