import { useState } from 'react'
import { clsx } from 'clsx'
import { CheckCircle2, Download, Trash2, ChevronRight, Lock } from 'lucide-react'
import { useModule } from '@shared/hooks/useModule'
import { Button, Badge, Modal } from '@shared/components/ui'
import registry from '@core/registry/ModuleRegistry'
import DepWarningModal from './DepWarningModal'

const CATEGORY_COLOR = {
  Operations:        'blue',
  Finance:           'purple',
  'Human Resources': 'red',
  System:            'default',
  Analytics:         'cyan',
}

export default function ModuleCard({ manifest }) {
  const { isInstalled, install, uninstall, isLoading, canManage } = useModule()
  const [showDep, setShowDep]       = useState(false)
  const [showDetail, setShowDetail] = useState(false)

  const Icon      = manifest.icon
  const installed = isInstalled(manifest.id)
  const loading   = isLoading(manifest.id)

  const handleInstall = () => {
    const uninstalledDeps = (manifest.dependencies ?? [])
      .filter(id => !registry.isInstalled(id))
    uninstalledDeps.length > 0
      ? setShowDep(true)
      : install(manifest.id)
  }

  const handleUninstall = () => {
    if (confirm(`Uninstall ${manifest.name}? This cannot be undone.`)) {
      uninstall(manifest.id)
    }
  }

  return (
    <>
      <div className={clsx(
        'group relative rounded-xl border transition-all duration-200',
        'bg-white hover:bg-surface-50 dark:bg-surface-900/50 dark:hover:bg-surface-900',
        installed
          ? 'border-brand-600/40 shadow-glow'
          : 'border-surface-200 hover:border-surface-300 dark:border-surface-800 dark:hover:border-surface-700'
      )}>

        {/* Installed badge */}
        {installed && (
          <div className="absolute top-3 right-3">
            <span className="flex items-center gap-1 text-xs
                             text-emerald-700 dark:text-emerald-400
                             bg-emerald-50 dark:bg-emerald-500/10
                             border border-emerald-200 dark:border-emerald-500/20
                             px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" />
              Installed
            </span>
          </div>
        )}

        <div className="p-5">
          {/* Icon + title */}
          <div className="flex items-start gap-4 mb-4">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: `${manifest.color}18`,
                border:          `1.5px solid ${manifest.color}35`,
              }}
            >
              <Icon className="w-5 h-5" style={{ color: manifest.color }} />
            </div>
            <div className="min-w-0 flex-1 pr-16">
              <h3 className="font-display font-semibold text-slate-900 dark:text-slate-100 text-sm leading-tight">
                {manifest.name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge color={CATEGORY_COLOR[manifest.category] ?? 'default'}>
                  {manifest.category}
                </Badge>
                <span className="text-xs text-slate-500 font-mono">v{manifest.version}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <p className="text-xs text-slate-500 leading-relaxed mb-4 line-clamp-2">
            {manifest.description}
          </p>

          {/* Feature list preview */}
          <div className="mb-4 space-y-1">
            {(manifest.features ?? []).slice(0, 3).map(f => (
              <div key={f} className="flex items-center gap-1.5 text-xs text-slate-500">
                <div
                  className="w-1 h-1 rounded-full flex-shrink-0"
                  style={{ backgroundColor: manifest.color }}
                />
                {f}
              </div>
            ))}
            {(manifest.features ?? []).length > 3 && (
              <button
                onClick={() => setShowDetail(true)}
                className="text-xs text-brand-600 dark:text-brand-400
                           hover:text-brand-500 dark:hover:text-brand-300
                           flex items-center gap-1 mt-1"
              >
                +{manifest.features.length - 3} more <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Dependency note */}
          {(manifest.dependencies ?? []).length > 0 && (
            <div className="mb-4 px-2.5 py-2 rounded-lg
                            bg-surface-100 border border-surface-200
                            dark:bg-surface-800 dark:border-surface-700">
              <p className="text-xs text-slate-500">
                <span className="text-slate-600 dark:text-slate-400">Requires: </span>
                {manifest.dependencies.map((id, i) => {
                  const dep    = registry.get(id)
                  const active = registry.isInstalled(id)
                  return (
                    <span key={id}>
                      {i > 0 && ', '}
                      <span className={active ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                        {dep?.name ?? id}
                      </span>
                    </span>
                  )
                })}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {!installed ? (
              <Button
                onClick={canManage ? handleInstall : undefined}
                loading={loading}
                size="sm"
                className="flex-1"
                disabled={!canManage}
                title={canManage ? '' : 'Only admins can install modules'}
              >
                {!loading && (canManage
                  ? <Download className="w-3.5 h-3.5" />
                  : <Lock    className="w-3.5 h-3.5" />
                )}
                {canManage ? 'Install' : 'Admin only'}
              </Button>
            ) : (
              <>
                <Button variant="secondary" size="sm" onClick={() => setShowDetail(true)} className="flex-1">
                  Details
                </Button>
                {canManage && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleUninstall}
                    loading={loading}
                    className="px-3"
                  >
                    {!loading && <Trash2 className="w-3.5 h-3.5" />}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Dependency warning */}
      {showDep && (
        <DepWarningModal
          moduleId={manifest.id}
          onConfirm={() => { setShowDep(false); install(manifest.id) }}
          onCancel={() => setShowDep(false)}
        />
      )}

      {/* Details modal */}
      <Modal open={showDetail} onClose={() => setShowDetail(false)} title={manifest.name} size="md">
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: `${manifest.color}18`, border: `1.5px solid ${manifest.color}35` }}
            >
              <Icon className="w-7 h-7" style={{ color: manifest.color }} />
            </div>
            <div>
              <h3 className="font-display font-bold text-slate-900 dark:text-white">{manifest.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge color={CATEGORY_COLOR[manifest.category] ?? 'default'}>
                  {manifest.category}
                </Badge>
                <span className="text-xs text-slate-500 font-mono">v{manifest.version}</span>
                {installed && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" /> Installed
                  </span>
                )}
              </div>
            </div>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-400">{manifest.description}</p>

          <div>
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
              Features
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {(manifest.features ?? []).map(f => (
                <div key={f} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: manifest.color }} />
                  {f}
                </div>
              ))}
            </div>
          </div>

          {!installed && canManage && (
            <Button
              onClick={() => { setShowDetail(false); handleInstall() }}
              className="w-full"
            >
              <Download className="w-4 h-4" />
              Install {manifest.name}
            </Button>
          )}
        </div>
      </Modal>
    </>
  )
}
