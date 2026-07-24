import { Search, Gauge, X } from 'lucide-react'
import { Card } from '@shared/components/ui'

const CAPACITY_FILTERS = [
  { key: 'all',      label: 'All',      match: () => true },
  { key: 'low',      label: 'Low',      match: (p) => p < 40   },
  { key: 'normal',   label: 'Normal',   match: (p) => p >= 40 && p < 70  },
  { key: 'high',     label: 'High',     match: (p) => p >= 70 && p < 90  },
  { key: 'critical', label: 'Critical', match: (p) => p >= 90  },
]

const CAPACITY_COLORS = {
  all:      '#6366f1',
  low:      '#10b981',
  normal:   '#3b82f6',
  high:     '#f59e0b',
  critical: '#ef4444',
}

export function capacityMatch(key) {
  return CAPACITY_FILTERS.find(f => f.key === key)?.match ?? (() => true)
}

export default function WarehouseFilterBar({
  search, onSearchChange, statusFilter, onStatusChange, capacityFilter, onCapacityChange,
  warehouses, filteredCount, hasActiveFilters, onClear,
}) {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-xs
                        px-3 py-2 rounded-lg
                        bg-slate-50 dark:bg-surface-800
                        border border-surface-200 dark:border-surface-700">
          <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search by name, code, location…"
            className="bg-transparent text-sm text-slate-700 dark:text-slate-300
                       placeholder:text-slate-400 dark:placeholder:text-slate-600
                       flex-1 outline-none"
          />
          {search && (
            <button onClick={() => onSearchChange('')} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-surface-800">
          {['all', 'active', 'inactive'].map(s => (
            <button
              key={s}
              onClick={() => onStatusChange(s)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all capitalize ${
                statusFilter === s
                  ? 'bg-white dark:bg-surface-700 text-slate-800 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {s === 'all' ? 'All Status' : s}
            </button>
          ))}
        </div>

        {hasActiveFilters && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                       text-red-500 dark:text-red-400
                       bg-red-50 dark:bg-red-500/10
                       border border-red-200 dark:border-red-500/20
                       hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
          >
            <X className="w-3 h-3" />Clear filters
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
          <Gauge className="w-3.5 h-3.5" />
          Capacity:
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {CAPACITY_FILTERS.map(({ key, label }) => {
            const color = CAPACITY_COLORS[key]
            const isActive = capacityFilter === key
            return (
              <button
                key={key}
                onClick={() => onCapacityChange(key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                            border transition-all ${
                  isActive
                    ? 'text-white border-transparent shadow-sm'
                    : 'bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-surface-600'
                }`}
                style={isActive ? { backgroundColor: color, borderColor: color } : {}}
              >
                {key !== 'all' && (
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.7)' : color }}
                  />
                )}
                {label}
                {key !== 'all' && (
                  <span className={`text-[10px] font-bold ${isActive ? 'opacity-80' : 'opacity-60'}`}>
                    ({warehouses.filter(w => capacityMatch(key)(Number(w.capacity_pct || 0))).length})
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {hasActiveFilters && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{filteredCount}</span> of{' '}
          <span className="font-semibold">{warehouses.length}</span> warehouses
        </p>
      )}
    </Card>
  )
}
