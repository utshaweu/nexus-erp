import { Trash2 } from 'lucide-react'

export default function SavedFiltersBar({ savedFilters, onApply, onDelete }) {
  if (savedFilters.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-slate-500">Saved:</span>
      {savedFilters.map(sf => (
        <span key={sf.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full
                                      text-xs font-medium
                                      bg-purple-50 dark:bg-purple-500/10
                                      border border-purple-200 dark:border-purple-500/30
                                      text-purple-700 dark:text-purple-300">
          <button onClick={() => onApply(sf)} className="hover:underline">{sf.name}</button>
          <button onClick={() => onDelete(sf.id)} className="ml-0.5 hover:text-red-500 transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        </span>
      ))}
    </div>
  )
}
