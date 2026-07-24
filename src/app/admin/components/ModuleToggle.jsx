import { clsx } from 'clsx'
import { CheckCircle2 } from 'lucide-react'
import { MODULE_META } from './moduleMeta'

export default function ModuleToggle({ moduleId, active, onChange, disabled }) {
  const meta = MODULE_META[moduleId]
  return (
    <button
      onClick={() => onChange(moduleId, !active)}
      disabled={disabled}
      className={clsx(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
        active
          ? 'border-opacity-40 text-white'
          : 'border-surface-200 dark:border-surface-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:border-surface-300 dark:hover:border-surface-600',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      style={active ? {
        backgroundColor: `${meta.color}20`,
        borderColor: `${meta.color}50`,
        color: meta.color,
      } : {}}
    >
      <span>{meta.emoji}</span>
      <span>{meta.label}</span>
      {active
        ? <CheckCircle2 className="w-3 h-3 ml-auto" />
        : <div className="w-3 h-3 rounded-full border border-surface-300 dark:border-surface-600 ml-auto" />
      }
    </button>
  )
}
