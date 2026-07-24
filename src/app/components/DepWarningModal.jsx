import { AlertTriangle } from 'lucide-react'
import { Button, Modal } from '@shared/components/ui'
import registry from '@core/registry/ModuleRegistry'

export default function DepWarningModal({ moduleId, onConfirm, onCancel }) {
  const manifest      = registry.get(moduleId)
  const uninstalledDeps = (manifest?.dependencies ?? [])
    .filter(id => !registry.isInstalled(id))
  if (!uninstalledDeps.length) return null

  const depNames = uninstalledDeps
    .map(id => registry.get(id)?.name ?? id)
    .join(', ')

  return (
    <Modal open onClose={onCancel} title="Dependencies Required" size="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-lg
                        bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Additional modules required</p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Installing{' '}
              <strong className="text-slate-800 dark:text-slate-200">{manifest?.name}</strong>{' '}
              will also install:
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-300 font-medium mt-1">{depNames}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button className="flex-1" onClick={onConfirm}>Install All</Button>
        </div>
      </div>
    </Modal>
  )
}
