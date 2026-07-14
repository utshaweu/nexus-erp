import { Link } from 'react-router-dom'
import { CheckSquare, Eye, Check, X } from 'lucide-react'
import { Badge, Button } from '@shared/components/ui'
import { clsx } from 'clsx'

const TYPE_COLORS = {
  purchase:  '#f59e0b', hr:       '#ec4899', expense: '#3b82f6',
  assets:    '#f97316', accounts: '#10b981', sales:   '#8b5cf6',
}

const PRIORITY = {
  low:    { label: 'Low',    color: 'default' },
  normal: { label: 'Normal', color: 'blue'    },
  high:   { label: 'High',   color: 'yellow'  },
  urgent: { label: 'Urgent', color: 'red'     },
}

export default function ApprovalCard({ item, onApprove, onReject }) {
  const typeColor = TYPE_COLORS[item.module] || '#6366f1'
  const priority  = PRIORITY[item.priority] || PRIORITY.normal

  return (
    <div className="p-4 rounded-xl border border-surface-200 dark:border-surface-800 hover:border-surface-300 dark:hover:border-surface-700 bg-white dark:bg-surface-900/50 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ backgroundColor: `${typeColor}18`, border: `1px solid ${typeColor}30` }}
          >
            <CheckSquare className="w-4 h-4" style={{ color: typeColor }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.title}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {item.request_number} · {new Date(item.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <Badge color={priority.color}>{priority.label}</Badge>
      </div>

      {item.totalSteps > 0 && (
        <div className="flex items-center gap-1.5 mb-3">
          {Array.from({ length: item.totalSteps }, (_, i) => (
            <div
              key={i}
              className={clsx('h-1.5 flex-1 rounded-full transition-all', i < item.current_step ? 'bg-brand-500' : 'bg-surface-200 dark:bg-surface-700')}
            />
          ))}
          <span className="text-xs text-slate-500 ml-1 whitespace-nowrap">Step {item.current_step}/{item.totalSteps}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        {item.amount != null ? (
          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">${Number(item.amount).toLocaleString()}</span>
        ) : (
          <span className="text-xs text-slate-400 italic">No amount</span>
        )}
        <div className="flex gap-2">
          <Link to={`/approval/requests/${item.id}`}>
            <Button variant="ghost" size="xs"><Eye className="w-3.5 h-3.5" /></Button>
          </Link>
          <Button variant="danger"  size="xs" onClick={() => onReject(item)}><X     className="w-3.5 h-3.5" /></Button>
          <Button variant="success" size="xs" onClick={() => onApprove(item)}><Check className="w-3.5 h-3.5" /></Button>
        </div>
      </div>
    </div>
  )
}
