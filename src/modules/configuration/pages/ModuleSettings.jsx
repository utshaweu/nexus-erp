import { useState, useEffect } from 'react'
import { CheckCircle, AlertCircle } from 'lucide-react'
import { PageHeader } from '@shared/components/ui'
import { useTenant } from '@core/tenant/TenantContext'
import registry from '@core/registry/ModuleRegistry'
import ModuleCard from '../components/ModuleCard'

const CATEGORY_ICON_COLOR = {
  System:     '#64748b',
  Finance:    '#0ea5e9',
  Operations: '#10b981',
  HR:         '#a855f7',
  Analytics:  '#f59e0b',
}

export default function ModuleSettings() {
  const { tenantId } = useTenant()
  const [allModules,   setAllModules]   = useState([])
  const [installedIds, setInstalledIds] = useState(new Set())
  const [processing,   setProcessing]   = useState(null)
  const [flash,        setFlash]        = useState(null) // { type, text }

  const refresh = () => {
    setAllModules(registry.getAll())
    setInstalledIds(new Set(registry.getInstalled().map(m => m.id)))
  }

  useEffect(() => {
    refresh()
    return registry.subscribe(() => refresh())
  }, [])

  const showFlash = (type, text) => {
    setFlash({ type, text })
    setTimeout(() => setFlash(null), 4000)
  }

  const handleInstall = async (moduleId) => {
    setProcessing(moduleId)
    const result = await registry.install(moduleId, tenantId)
    if (result.success) {
      const names = result.installed.join(', ')
      showFlash('success', `Installed: ${names}`)
    } else {
      showFlash('error', result.error)
    }
    refresh()
    setProcessing(null)
  }

  const handleUninstall = async (moduleId) => {
    const manifest = registry.get(moduleId)
    if (!window.confirm(`Uninstall "${manifest?.name}"? It will disappear from the sidebar.`)) return
    setProcessing(moduleId)
    const result = await registry.uninstall(moduleId, tenantId)
    if (result.success) {
      showFlash('success', `"${manifest?.name}" uninstalled.`)
    } else {
      showFlash('error', result.error)
    }
    refresh()
    setProcessing(null)
  }

  // Group modules by category
  const byCategory = allModules.reduce((acc, m) => {
    const cat = m.category ?? 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(m)
    return acc
  }, {})

  const installedCount = installedIds.size
  const totalCount     = allModules.length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Module Settings"
        subtitle={`${installedCount} of ${totalCount} modules installed`}
        breadcrumb="Configuration / Module Settings"
      />

      {/* Flash message */}
      {flash && (
        <div className={`flex items-start gap-2 px-4 py-3 rounded-lg text-sm border ${
          flash.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400'
            : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400'
        }`}>
          {flash.type === 'success'
            ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          }
          {flash.text}
        </div>
      )}

      {/* Module groups */}
      {Object.entries(byCategory).map(([category, modules]) => (
        <div key={category}>
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-widest mb-3">
            {category}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {modules.map(mod => (
              <ModuleCard
                key={mod.id}
                mod={mod}
                iconColor={mod.color ?? CATEGORY_ICON_COLOR[category] ?? '#6366f1'}
                installed={installedIds.has(mod.id)}
                installedIds={installedIds}
                isProcessing={processing === mod.id}
                isCore={mod.id === 'configuration'}
                onInstall={() => handleInstall(mod.id)}
                onUninstall={() => handleUninstall(mod.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
