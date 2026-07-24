/** Byte-identical across Products/StockMoves/Warehouses originally — unified here. */
export default function StatChip({ value, label, color }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg
                    bg-slate-50 dark:bg-surface-800
                    border border-surface-200 dark:border-surface-700">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{value}</span>
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
    </div>
  )
}
