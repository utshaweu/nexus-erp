import { CheckCircle2, XCircle, User } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@shared/components/ui'
import { clsx } from 'clsx'

const ACTION_CFG = {
  approved:  { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/20', Icon: CheckCircle2 },
  rejected:  { text: 'text-red-600 dark:text-red-400',         bg: 'bg-red-50 dark:bg-red-500/20',         Icon: XCircle      },
  delegated: { text: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-50 dark:bg-blue-500/20',       Icon: User         },
}

function actorName(actor) {
  if (!actor) return 'Unknown'
  return actor.raw_user_meta_data?.full_name || actor.email || actor.id
}

export default function RequestAuditTrail({ actions }) {
  return (
    <Card>
      <CardHeader><CardTitle>Approval History</CardTitle></CardHeader>
      <CardContent>
        {actions.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No actions taken yet.</p>
        ) : (
          <div className="space-y-3">
            {actions.map(act => {
              const cfg = ACTION_CFG[act.action] || ACTION_CFG.approved
              const { Icon } = cfg
              return (
                <div key={act.id} className="flex items-start gap-3 p-3 rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
                  <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', cfg.bg)}>
                    <Icon className={clsx('w-4 h-4', cfg.text)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 capitalize">{act.action}</p>
                      <span className="text-xs text-slate-500 flex-shrink-0">{new Date(act.acted_at).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Step {act.step_number} · By {actorName(act.actor)}</p>
                    {act.comment && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 italic">"{act.comment}"</p>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
