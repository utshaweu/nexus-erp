import { Search } from 'lucide-react'

/** Shared search+status-tab toolbar — byte-identical between Quotations.jsx and SalesOrders.jsx originally. */
export default function ListToolbar({ search, onSearchChange, placeholder, tabs, activeTab, onTabChange, children }) {
  return (
    <div className="flex items-center gap-3 p-4 border-b border-surface-200 dark:border-surface-800 flex-wrap">
      <div className="flex items-center gap-2 max-w-xs px-3 py-1.5 rounded-lg
                      bg-surface-100 dark:bg-surface-800
                      border border-surface-200 dark:border-surface-700">
        <Search className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
        <input
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="bg-transparent text-sm text-slate-700 dark:text-slate-300
                     placeholder:text-slate-400 dark:placeholder:text-slate-600
                     flex-1 outline-none"
        />
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {tabs.map(t => (
          <button
            key={t.value}
            onClick={() => onTabChange(t.value)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              activeTab === t.value
                ? 'bg-brand-600/10 dark:bg-brand-600/20 text-brand-700 dark:text-brand-300 border border-brand-600/20 dark:border-brand-600/30'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {children}
    </div>
  )
}
