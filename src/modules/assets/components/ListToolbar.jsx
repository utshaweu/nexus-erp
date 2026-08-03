import { Search } from 'lucide-react'

/**
 * Search box + optional extra filter (asset picker, via `children`) + status
 * tab strip, shared by the assets list pages. Any of search/children/tabs
 * may be omitted — Depreciation has no search box, Categories has no tabs.
 */
export default function ListToolbar({ search, onSearchChange, placeholder, tabs, activeTab, onTabChange, children }) {
  return (
    <div className="flex items-center gap-3 p-4 border-b border-surface-200 dark:border-surface-800 flex-wrap">
      {search !== undefined && (
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-xs
                        px-3 py-2 rounded-lg
                        bg-slate-50 dark:bg-surface-800
                        border border-surface-200 dark:border-surface-700">
          <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={placeholder}
            className="bg-transparent text-sm text-slate-700 dark:text-slate-300
                       placeholder:text-slate-400 dark:placeholder:text-slate-600
                       flex-1 outline-none"
          />
        </div>
      )}

      {children}

      {tabs && (
        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-surface-800 overflow-x-auto scrollbar-thin max-w-full">
          {tabs.map(t => (
            <button
              key={t.value}
              onClick={() => onTabChange(t.value)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex-shrink-0 ${
                activeTab === t.value
                  ? 'bg-white dark:bg-surface-700 text-slate-800 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
