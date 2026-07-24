import { Card, Badge } from '@shared/components/ui'

export default function POInfoCard({ order, statusInfo, lines, subtotal, total }) {
  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300 mb-4">Order Info</h3>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Status</span>
          <Badge color={statusInfo.color}>{statusInfo.label}</Badge>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Order Date</span>
          <span className="text-slate-700 dark:text-slate-300">{order.order_date}</span>
        </div>
        {order.expected_date && (
          <div className="flex justify-between">
            <span className="text-slate-500">Expected</span>
            <span className="text-slate-700 dark:text-slate-300">{order.expected_date}</span>
          </div>
        )}
        {order.reference && (
          <div className="flex justify-between">
            <span className="text-slate-500">Reference</span>
            <span className="font-mono text-xs text-slate-700 dark:text-slate-300">{order.reference}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-slate-500">Lines</span>
          <span className="text-slate-700 dark:text-slate-300">{lines.length}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Subtotal</span>
          <span className="text-slate-700 dark:text-slate-300">${subtotal.toLocaleString()}</span>
        </div>
        <div className="flex justify-between font-semibold pt-2 border-t border-surface-200 dark:border-surface-800">
          <span className="text-slate-400">Total</span>
          <span className="text-slate-900 dark:text-slate-100">${total.toLocaleString()}</span>
        </div>
      </div>
    </Card>
  )
}
