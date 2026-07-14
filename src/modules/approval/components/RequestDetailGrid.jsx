import { Badge, Card, CardHeader, CardTitle, CardContent } from '@shared/components/ui'
import registry from '@core/registry/ModuleRegistry'

const PRIORITY = {
  low:    { label: 'Low',    color: 'default' },
  normal: { label: 'Normal', color: 'blue'    },
  high:   { label: 'High',   color: 'yellow'  },
  urgent: { label: 'Urgent', color: 'red'     },
}

export default function RequestDetailGrid({ request }) {
  return (
    <Card>
      <CardHeader><CardTitle>Request Details</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <p className="text-xs text-slate-500 mb-1">Request #</p>
            <p className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200">{request.request_number}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Module</p>
            <p className="text-sm text-slate-700 dark:text-slate-300 capitalize">{request.module}</p>
          </div>
          {request.feature && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Feature</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {registry.get(request.module)?.menuItems?.find(mi => mi.path === request.feature)?.label || request.feature}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-slate-500 mb-1">Priority</p>
            <Badge color={PRIORITY[request.priority]?.color}>{PRIORITY[request.priority]?.label || request.priority}</Badge>
          </div>
          {request.amount != null && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Amount</p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">${Number(request.amount).toLocaleString()}</p>
            </div>
          )}
          {request.record_type && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Record Type</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">{request.record_type}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-slate-500 mb-1">Current Step</p>
            <p className="text-sm text-slate-700 dark:text-slate-300">Step {request.current_step}</p>
          </div>
        </div>
        {request.description && (
          <div>
            <p className="text-xs text-slate-500 mb-1">Description</p>
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{request.description}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
