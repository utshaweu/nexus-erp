import { CheckCircle2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@shared/components/ui'
import { clsx } from 'clsx'

export default function RequestWorkflowSidebar({ steps, request }) {
  const isFullyApproved = request.status === 'approved'
  return (
    <Card>
      <CardHeader><CardTitle>Approval Workflow</CardTitle></CardHeader>
      <CardContent>
        {steps.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No workflow configured.</p>
        ) : (
          <div className="space-y-3">
            {steps.map(step => {
              const isDone    = isFullyApproved || (request.current_step > step.step_order && request.status !== 'pending')
              const isCurrent = request.current_step === step.step_order && request.status === 'pending'
              return (
                <div key={step.id} className="flex items-start gap-3">
                  <div className={clsx(
                    'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold border',
                    isDone    ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-300 dark:border-emerald-500/40 text-emerald-600 dark:text-emerald-400' :
                    isCurrent ? 'bg-brand-50 dark:bg-brand-600/20 border-brand-300 dark:border-brand-600/40 text-brand-600 dark:text-brand-400' :
                                'bg-surface-100 dark:bg-surface-800 border-surface-300 dark:border-surface-700 text-slate-400'
                  )}>
                    {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : step.step_order}
                  </div>
                  <div className="flex-1">
                    <p className={clsx('text-sm font-medium',
                      isDone    ? 'text-emerald-600 dark:text-emerald-400' :
                      isCurrent ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'
                    )}>{step.step_name}</p>
                    <p className="text-xs text-slate-500">{step.approver_role}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{step.approval_type === 'all' ? 'All must approve' : 'Any can approve'}</p>
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
