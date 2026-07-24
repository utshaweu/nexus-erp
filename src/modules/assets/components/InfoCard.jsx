import { Card } from '@shared/components/ui'

export default function InfoCard({ icon: Icon, label, value, sub, color = '#f97316' }) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg flex-shrink-0" style={{ backgroundColor: `${color}20`, border: `1px solid ${color}30` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">{label}</p>
          <p className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
        </div>
      </div>
    </Card>
  )
}
