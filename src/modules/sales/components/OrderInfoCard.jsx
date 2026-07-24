import { Link } from 'react-router-dom'
import { Card, Badge } from '@shared/components/ui'

export default function OrderInfoCard({ order, statusInfo, pendingRequest, lines, totalDiscount, total }) {
  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300 mb-4">Order Info</h3>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Status</span>
          <Badge color={statusInfo.color}>{statusInfo.label}</Badge>
        </div>
        {pendingRequest && (
          <div className="flex justify-between">
            <span className="text-slate-500">Approval</span>
            <Link
              to={`/approval/requests/${pendingRequest.id}`}
              className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
            >
              {pendingRequest.request_number} · Pending
            </Link>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-slate-500">Order Date</span>
          <span className="text-slate-700 dark:text-slate-300">{order.order_date}</span>
        </div>
        {order.delivery_date && (
          <div className="flex justify-between">
            <span className="text-slate-500">Delivery</span>
            <span className="text-slate-700 dark:text-slate-300">{order.delivery_date}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-slate-500">Lines</span>
          <span className="text-slate-700 dark:text-slate-300">{lines.length}</span>
        </div>
        {totalDiscount > 0 && (
          <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
            <span>Discount</span>
            <span>−${totalDiscount.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold pt-2 border-t border-surface-200 dark:border-surface-800">
          <span className="text-slate-500 dark:text-slate-400">Total</span>
          <span className="text-slate-900 dark:text-slate-100">${total.toFixed(2)}</span>
        </div>
      </div>
    </Card>
  )
}
