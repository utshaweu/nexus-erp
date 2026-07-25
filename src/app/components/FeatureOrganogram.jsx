import { LayoutDashboard } from 'lucide-react'
import { MODULE_ICON_MAP } from '@shared/lib/moduleIcons'

function FeatureChip({ item, color }) {
  const Icon = MODULE_ICON_MAP[item.icon] ?? LayoutDashboard
  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border"
      style={{ backgroundColor: `${color}15`, borderColor: `${color}35` }}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />
      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{item.label}</span>
    </div>
  )
}

function ModuleGroup({ manifest }) {
  const Icon  = manifest.icon
  const color = manifest.color ?? '#6366f1'
  const items = manifest.menuItems ?? []

  return (
    <div
      className="rounded-xl border-2 bg-white dark:bg-surface-900 shadow-sm p-4"
      style={{ borderColor: color }}
    >
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />}
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          {manifest.name}
        </span>
      </div>

      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map(item => (
            <FeatureChip key={item.id ?? item.path} item={item} color={color} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400 dark:text-slate-600 italic">No menu items configured.</p>
      )}
    </div>
  )
}

/**
 * Groups each installed module with its menu items (features) as chips —
 * a visual map of what a tenant actually has access to right now.
 * Wraps naturally at any width — no horizontal scrolling, no fixed layout.
 */
export default function FeatureOrganogram({ modules }) {
  if (modules.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">No installed modules match your search.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 py-2">
      {modules.map(m => <ModuleGroup key={m.id} manifest={m} />)}
    </div>
  )
}
