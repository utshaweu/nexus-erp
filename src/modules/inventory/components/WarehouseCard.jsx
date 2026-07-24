import { Warehouse, MapPin, Pencil, Trash2, CheckCircle2, XCircle } from 'lucide-react'
import { Button, Badge } from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'

function capacityConfig(pct) {
  if (pct >= 90) return { color: '#ef4444', label: 'Critical', badge: 'red'    }
  if (pct >= 70) return { color: '#f59e0b', label: 'High',     badge: 'yellow' }
  if (pct >= 40) return { color: '#3b82f6', label: 'Normal',   badge: 'blue'   }
  return              { color: '#10b981', label: 'Low',      badge: 'green'  }
}

export default function WarehouseCard({ warehouse: wh, onEdit, onDelete }) {
  const pct    = Math.min(Number(wh.capacity_pct || 0), 100)
  const capCfg = capacityConfig(pct)

  return (
    <div className="group relative rounded-2xl overflow-hidden
                    bg-white dark:bg-surface-900
                    border border-surface-200 dark:border-surface-800
                    shadow-sm hover:shadow-md dark:hover:shadow-surface-800/60
                    transition-all duration-200 hover:-translate-y-0.5">

      <div className="h-1 w-full" style={{ backgroundColor: capCfg.color }} />

      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${capCfg.color}18`, border: `1px solid ${capCfg.color}35` }}
          >
            <Warehouse className="w-5 h-5" style={{ color: capCfg.color }} />
          </div>

          <div className="flex items-center gap-1.5">
            <Badge color={wh.status === 'active' ? 'green' : 'default'}>
              {wh.status === 'active'
                ? <><CheckCircle2 className="w-3 h-3 inline mr-0.5" />Active</>
                : <><XCircle     className="w-3 h-3 inline mr-0.5" />Inactive</>}
            </Badge>
          </div>
        </div>

        <h3 className="font-display font-bold text-base text-slate-900 dark:text-slate-100 leading-tight">
          {wh.name}
        </h3>
        <p className="mt-0.5 text-xs font-mono font-medium text-slate-400 dark:text-slate-500 tracking-wider">
          {wh.code}
        </p>

        {wh.location && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{wh.location}</span>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-surface-100 dark:border-surface-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Capacity Used
            </span>
            <div className="flex items-center gap-2">
              <Badge color={capCfg.badge} className="text-[10px]">{capCfg.label}</Badge>
              <span className="text-xs font-bold" style={{ color: capCfg.color }}>{pct}%</span>
            </div>
          </div>
          <div className="h-2 rounded-full bg-slate-100 dark:bg-surface-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: capCfg.color }}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <PermissionGate action="edit" moduleId="inventory">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => onEdit(wh)}
            >
              <Pencil className="w-3.5 h-3.5" />Edit
            </Button>
          </PermissionGate>
          <PermissionGate action="delete" moduleId="inventory">
            <Button
              variant="danger"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => onDelete(wh)}
            >
              <Trash2 className="w-3.5 h-3.5" />Delete
            </Button>
          </PermissionGate>
        </div>
      </div>
    </div>
  )
}
