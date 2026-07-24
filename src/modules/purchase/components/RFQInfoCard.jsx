import { Card, Badge } from '@shared/components/ui'

export default function RFQInfoCard({ rfq, statusInfo, lines }) {
  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300 mb-4">RFQ Info</h3>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Status</span>
          <Badge color={statusInfo.color}>{statusInfo.label}</Badge>
        </div>
        {rfq.deadline && (
          <div className="flex justify-between">
            <span className="text-slate-500">Deadline</span>
            <span className="text-slate-700 dark:text-slate-300">{rfq.deadline}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-slate-500">Items</span>
          <span className="text-slate-700 dark:text-slate-300">{lines.length}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Quoted Amount</span>
          <span className="text-slate-700 dark:text-slate-300">
            {rfq.quoted_amount > 0 ? `$${Number(rfq.quoted_amount).toLocaleString()}` : '—'}
          </span>
        </div>
        {rfq.created_at && (
          <div className="flex justify-between">
            <span className="text-slate-500">Created</span>
            <span className="text-slate-700 dark:text-slate-300">{new Date(rfq.created_at).toLocaleDateString()}</span>
          </div>
        )}
      </div>
    </Card>
  )
}
