export default function ReportTabBar({ tabs, activeTab, onChange }) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-surface-800 w-fit">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === t.id
              ? 'bg-white dark:bg-surface-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
