import { Search } from 'lucide-react'

// Literal Tailwind class strings per accent color — kept whole (not built via
// template interpolation) so the JIT scanner can find and generate them.
const COLOR_CLASSES = {
  purple: {
    loadingWrap: 'bg-purple-500/10 border-purple-500/20',
    loadingIcon: 'text-purple-400',
    circleOuter: 'bg-purple-500/5 dark:bg-purple-500/10',
    circleInner: 'bg-purple-500/8 dark:bg-purple-500/15',
    iconWrap:    'bg-gradient-to-br from-purple-500/20 to-violet-600/10 border-purple-500/20',
    icon:        'text-purple-400',
  },
  pink: {
    loadingWrap: 'bg-pink-500/10 border-pink-500/20',
    loadingIcon: 'text-pink-400',
    circleOuter: 'bg-pink-500/5 dark:bg-pink-500/10',
    circleInner: 'bg-pink-500/8 dark:bg-pink-500/15',
    iconWrap:    'bg-gradient-to-br from-pink-500/20 to-rose-600/10 border-pink-500/20',
    icon:        'text-pink-400',
  },
  indigo: {
    loadingWrap: 'bg-indigo-500/10 border-indigo-500/20',
    loadingIcon: 'text-indigo-400',
    circleOuter: 'bg-indigo-500/5 dark:bg-indigo-500/10',
    circleInner: 'bg-indigo-500/8 dark:bg-indigo-500/15',
    iconWrap:    'bg-gradient-to-br from-indigo-500/20 to-blue-600/10 border-indigo-500/20',
    icon:        'text-indigo-400',
  },
}

export function ListLoading({ color, icon: Icon, label }) {
  const c = COLOR_CLASSES[color]
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${c.loadingWrap}`}>
        <Icon className={`w-5 h-5 animate-pulse ${c.loadingIcon}`} />
      </div>
      <p className="text-sm text-slate-400">{label}</p>
    </div>
  )
}

export function ListEmptyState({ color, icon: Icon, searching, title, searchingTitle, description, searchingDescription, action }) {
  const c = COLOR_CLASSES[color]
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="relative mb-6">
        <div className={`absolute inset-0 rounded-full scale-[2.5] ${c.circleOuter}`} />
        <div className={`absolute inset-0 rounded-full scale-[1.8] ${c.circleInner}`} />
        <div className={`relative w-20 h-20 rounded-2xl border flex items-center justify-center ${c.iconWrap}`}>
          {searching ? <Search className="w-9 h-9 text-slate-400" /> : <Icon className={`w-9 h-9 ${c.icon}`} />}
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
