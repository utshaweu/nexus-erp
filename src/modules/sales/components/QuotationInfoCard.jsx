import { Card, Badge } from '@shared/components/ui'

export default function QuotationInfoCard({ quote, statusInfo, lines, total }) {
  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300 mb-4">Quotation Info</h3>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Status</span>
          <Badge color={statusInfo.color}>{statusInfo.label}</Badge>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Date</span>
          <span className="text-slate-700 dark:text-slate-300">{quote.quotation_date}</span>
        </div>
        {quote.expiry_date && (
          <div className="flex justify-between">
            <span className="text-slate-500">Expiry</span>
            <span className="text-slate-700 dark:text-slate-300">{quote.expiry_date}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-slate-500">Lines</span>
          <span className="text-slate-700 dark:text-slate-300">{lines.length}</span>
        </div>
        <div className="flex justify-between font-semibold pt-2 border-t border-surface-200 dark:border-surface-800">
          <span className="text-slate-500 dark:text-slate-400">Total</span>
          <span className="text-slate-900 dark:text-slate-100">${total.toFixed(2)}</span>
        </div>
      </div>
    </Card>
  )
}
