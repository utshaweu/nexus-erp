import { Package } from 'lucide-react'
import registry from '@core/registry/ModuleRegistry'

const DEFAULT_MODULE_COLOR = '#64748b'

// Resolves display metadata (label/color/icon) for a module id from the live
// registry, so it stays in sync with whatever modules are installed rather
// than a hardcoded list. Falls back gracefully if a workflow references a
// module that has since been uninstalled.
export function getModuleMeta(moduleId) {
  const manifest = registry.get(moduleId)
  return {
    label: manifest?.name || moduleId || 'Unknown',
    color: manifest?.color || DEFAULT_MODULE_COLOR,
    Icon:  manifest?.icon || Package,
  }
}

/** A module's own menu items as {value,label} feature options, cascading from the selected module. */
export function getModuleFeatureOptions(moduleId) {
  if (!moduleId) return []
  return (registry.get(moduleId)?.menuItems || []).map(mi => ({ value: mi.path, label: mi.label }))
}
