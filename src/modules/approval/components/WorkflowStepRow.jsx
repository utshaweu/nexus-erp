import { GripVertical, Trash2 } from 'lucide-react'
import { Input } from '@shared/components/ui'
import { clsx } from 'clsx'

const ROLE_OPTIONS = [
  { value: 'owner',   label: 'Owner'   },
  { value: 'admin',   label: 'Admin'   },
  { value: 'manager', label: 'Manager' },
  { value: 'user',    label: 'User'    },
]

export default function WorkflowStepRow({
  index, register, errors, onRemove, canRemove, tenantUsers,
  onDragStart, onDragOver, onDrop, onDragEnd, isDragging,
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={clsx(
        'flex items-start gap-3 p-3 rounded-xl bg-surface-50 dark:bg-surface-900 border transition-opacity',
        isDragging ? 'border-brand-400 dark:border-brand-500 opacity-40' : 'border-surface-200 dark:border-surface-700',
      )}
    >
      <div className="flex flex-col items-center gap-1 pt-1 flex-shrink-0">
        <div
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          title="Drag to reorder"
          className="cursor-grab active:cursor-grabbing touch-none p-0.5 -m-0.5 rounded hover:bg-surface-200 dark:hover:bg-surface-700"
        >
          <GripVertical className="w-4 h-4 text-slate-300 dark:text-slate-600" />
        </div>
        <div className="w-5 h-5 rounded-full bg-brand-50 dark:bg-brand-500/15 border border-brand-200 dark:border-brand-500/30 flex items-center justify-center">
          <span className="text-xs font-bold text-brand-600 dark:text-brand-400">{index + 1}</span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 gap-2 min-w-0">
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="Step name"
            error={errors.steps?.[index]?.step_name?.message}
            {...register(`steps.${index}.step_name`)}
          />
          <div>
            <select
              {...register(`steps.${index}.approver_role`)}
              className="w-full px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">Select approver...</option>
              <optgroup label="By Role">
                {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </optgroup>
              {tenantUsers.length > 0 && (
                <optgroup label="Specific User">
                  {tenantUsers.map(u => (
                    <option key={u.user_id} value={u.full_name || u.user_id}>
                      {u.full_name || u.user_id} ({u.role})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {errors.steps?.[index]?.approver_role && (
              <p className="mt-1 text-xs text-red-500">{errors.steps[index].approver_role.message}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" value="any" {...register(`steps.${index}.approval_type`)} className="accent-brand-600" />
            <span className="text-xs text-slate-600 dark:text-slate-400">Any approver</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" value="all" {...register(`steps.${index}.approval_type`)} className="accent-brand-600" />
            <span className="text-xs text-slate-600 dark:text-slate-400">All must approve</span>
          </label>
        </div>
      </div>

      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="mt-1 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex-shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
