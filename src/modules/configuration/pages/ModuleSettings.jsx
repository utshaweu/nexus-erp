import { useState, useEffect } from 'react'
import { Package, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { Button, Badge, Card, PageHeader } from '@shared/components/ui'
import { useTenant } from '@core/tenant/TenantContext'
import registry from '@core/registry/ModuleRegistry'
import PermissionGate from '@shared/components/PermissionGate'

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
            {modules.map(mod => {
              const installed   = installedIds.has(mod.id)
              const isProcessing = processing === mod.id
              const iconColor   = mod.color ?? CATEGORY_ICON_COLOR[category] ?? '#6366f1'
              const isCore      = mod.id === 'configuration'

              return (
                <Card key={mod.id} className={`p-4 flex flex-col gap-3 ${installed ? '' : 'opacity-80'}`}>
                  {/* Header row */}
                  <div className="flex items-start gap-3">
                    <div
                      className="p-2 rounded-lg shrink-0"
                      style={{
                        backgroundColor: `${iconColor}20`,
                        border:          `1px solid ${iconColor}30`,
                      }}
                    >
                      <Package className="w-4 h-4" style={{ color: iconColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                          {mod.name}
                        </span>
                        <span className="text-xs text-slate-500">v{mod.version}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                        {mod.description}
                      </p>
                    </div>
                    <Badge color={installed ? 'green' : 'default'} className="shrink-0">
                      {installed ? 'Installed' : 'Available'}
                    </Badge>
                  </div>

                  {/* Dependencies */}
                  {mod.dependencies?.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-xs text-slate-600">Requires:</span>
                      {mod.dependencies.map(dep => (
                        <Badge key={dep} color={installedIds.has(dep) ? 'blue' : 'yellow'}>
                          {registry.get(dep)?.name ?? dep}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Features */}
                  {mod.features?.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {mod.features.map(f => (
                        <span
                          key={f}
                          className="text-xs px-1.5 py-0.5 rounded
                                     bg-surface-100 dark:bg-surface-800
                                     text-slate-600 dark:text-slate-400"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Action */}
                  <PermissionGate action="edit" moduleId="configuration">
                    <div className="flex justify-end pt-1">
                      {isCore ? (
                        <span className="text-xs text-slate-500 italic">Core module</span>
                      ) : installed ? (
                        <Button
                          variant="secondary"
                          size="xs"
                          loading={isProcessing}
                          onClick={() => handleUninstall(mod.id)}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Uninstall
                        </Button>
                      ) : (
                        <Button
                          size="xs"
                          loading={isProcessing}
                          onClick={() => handleInstall(mod.id)}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Install
                        </Button>
                      )}
                    </div>
                  </PermissionGate>
                </Card>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
