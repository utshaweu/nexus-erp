import { Package, CheckCircle, XCircle } from 'lucide-react'
import { Button, Badge, Card } from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import registry from '@core/registry/ModuleRegistry'

export default function ModuleCard({ mod, iconColor, installed, installedIds, isProcessing, isCore, onInstall, onUninstall }) {
  return (
    <Card className={`p-4 flex flex-col gap-3 ${installed ? '' : 'opacity-80'}`}>
      <div className="flex items-start gap-3">
        <div
          className="p-2 rounded-lg shrink-0"
          style={{ backgroundColor: `${iconColor}20`, border: `1px solid ${iconColor}30` }}
        >
          <Package className="w-4 h-4" style={{ color: iconColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">{mod.name}</span>
            <span className="text-xs text-slate-500">v{mod.version}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{mod.description}</p>
        </div>
        <Badge color={installed ? 'green' : 'default'} className="shrink-0">
          {installed ? 'Installed' : 'Available'}
        </Badge>
      </div>

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

      <PermissionGate action="edit" moduleId="configuration">
        <div className="flex justify-end pt-1">
          {isCore ? (
            <span className="text-xs text-slate-500 italic">Core module</span>
          ) : installed ? (
            <Button variant="secondary" size="xs" loading={isProcessing} onClick={onUninstall}>
              <XCircle className="w-3.5 h-3.5" />
              Uninstall
            </Button>
          ) : (
            <Button size="xs" loading={isProcessing} onClick={onInstall}>
              <CheckCircle className="w-3.5 h-3.5" />
              Install
            </Button>
          )}
        </div>
      </PermissionGate>
    </Card>
  )
}
