import { Card, Button, Input } from '@shared/components/ui'

export default function CouponCard({ order, couponDiscount, canEditLines, couponInput, onCouponInputChange, onApply, onRemove }) {
  if (!order.coupon_code && !canEditLines) return null

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300 mb-3">Coupon</h3>
      {order.coupon_code ? (
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-mono text-sm text-emerald-600 dark:text-emerald-400">{order.coupon_code}</p>
            <p className="text-xs text-slate-500">−${couponDiscount.toLocaleString()} applied</p>
          </div>
          {canEditLines && (
            <Button variant="danger" size="xs" onClick={onRemove}>Remove</Button>
          )}
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              placeholder="Enter coupon code…"
              value={couponInput}
              onChange={e => onCouponInputChange(e.target.value)}
            />
          </div>
          <Button size="sm" onClick={onApply}>Apply</Button>
        </div>
      )}
    </Card>
  )
}
