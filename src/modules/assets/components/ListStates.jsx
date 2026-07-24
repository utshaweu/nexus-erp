import { Search } from 'lucide-react'

export function ListLoading({ icon: Icon, label }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
        <Icon className="w-5 h-5 text-orange-400 animate-pulse" />
      </div>
      <p className="text-sm text-slate-400">{label}</p>
    </div>
  )
}

/** `circles`: AssetList's empty state has two nested glow circles, Maintenance's has one — kept configurable to match each exactly. */
export function ListEmptyState({ icon: Icon, searching, title, searchingTitle, description, searchingDescription, action, circles = 2 }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-orange-500/5 dark:bg-orange-500/10 scale-[2.5]" />
        {circles > 1 && (
          <div className="absolute inset-0 rounded-full bg-orange-500/8 dark:bg-orange-500/15 scale-[1.8]" />
        )}
        <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-600/10
                        border border-orange-500/20 flex items-center justify-center">
          {searching ? <Search className="w-9 h-9 text-slate-400" /> : <Icon className="w-9 h-9 text-orange-400" />}
        </div>
      </div>
      <h3 className="text-base font-display font-bold text-slate-800 dark:text-slate-200 mb-1">
        {searching ? searchingTitle : title}
      </h3>
      <p className="text-sm text-slate-500 text-center max-w-xs mb-5">
        {searching ? searchingDescription : description}
      </p>
      {!searching && action}
    </div>
  )
}
