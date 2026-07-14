import { CheckCircle2, XCircle, Clock } from 'lucide-react'
import { Badge, Card } from '@shared/components/ui'
import { clsx } from 'clsx'

const STATUS_CFG = {
  pending:   { label: 'Pending',   color: 'yellow',  Icon: Clock        },
  approved:  { label: 'Approved',  color: 'green',   Icon: CheckCircle2 },
  rejected:  { label: 'Rejected',  color: 'red',     Icon: XCircle      },
  cancelled: { label: 'Cancelled', color: 'default', Icon: XCircle      },
}

const COLORS = {
  approved:  { icon: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/20' },
  rejected:  { icon: 'text-red-600 dark:text-red-400',         bg: 'bg-red-50 dark:bg-red-500/20'         },
  pending:   { icon: 'text-amber-600 dark:text-amber-400',      bg: 'bg-amber-50 dark:bg-amber-500/20'     },
  cancelled: { icon: 'text-slate-500',                          bg: 'bg-surface-100 dark:bg-surface-800'   },
}

export default function RequestStatusBanner({ request }) {
  const cfg = STATUS_CFG[request.status] || STATUS_CFG.pending
  const { Icon } = cfg
  const c = COLORS[request.status] || COLORS.pending
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={clsx('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', c.bg)}>
          <Icon className={clsx('w-5 h-5', c.icon)} />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            Status: <Badge color={cfg.color}>{cfg.label}</Badge>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Submitted {new Date(request.created_at).toLocaleString()}
            {request.workflow && ` · Workflow: ${request.workflow.name}`}
          </p>
        </div>
      </div>
    </Card>
  )
}
