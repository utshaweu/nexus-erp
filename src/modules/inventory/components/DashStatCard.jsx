import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Card } from '@shared/components/ui'

export default function DashStatCard({ label, value, icon: Icon, color, loading, to }) {
  const inner = (
    <Card className={`p-5 group transition-all duration-200 ${to ? 'hover:-translate-y-0.5 hover:shadow-md cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest truncate">
            {label}
          </p>
          {loading ? (
            <div className="mt-2 h-8 w-20 bg-surface-200 dark:bg-surface-800 rounded animate-pulse" />
          ) : (
            <p className="mt-1.5 text-2xl font-display font-bold text-slate-900 dark:text-slate-100">
              {value}
            </p>
          )}
        </div>
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0
                     transition-transform duration-200 group-hover:scale-110"
          style={{ backgroundColor: `${color}18`, border: `1px solid ${color}35` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
      {to && (
        <div className="mt-3 flex items-center gap-1 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity"
             style={{ color }}>
          View details <ArrowRight className="w-3 h-3" />
        </div>
      )}
    </Card>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}
