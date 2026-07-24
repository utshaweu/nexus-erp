import { Plus, Warehouse } from 'lucide-react'
import { Button } from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'

export default function EmptyWarehouses({ onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-blue-500/5 dark:bg-blue-500/10 scale-[2.5]" />
        <div className="absolute inset-0 rounded-full bg-blue-500/8 dark:bg-blue-500/15 scale-[1.8]" />
        <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/10
                        border border-blue-500/20 flex items-center justify-center">
          <Warehouse className="w-9 h-9 text-blue-400" />
        </div>
      </div>
      <h3 className="text-lg font-display font-bold text-slate-800 dark:text-slate-200 mb-2">
        No warehouses yet
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-xs mb-6">
        Create your first warehouse to start managing stock locations and inventory movements.
      </p>
      <PermissionGate action="create" moduleId="inventory">
        <Button onClick={onAdd} className="gap-2">
          <Plus className="w-4 h-4" />Create First Warehouse
        </Button>
      </PermissionGate>
    </div>
  )
}
