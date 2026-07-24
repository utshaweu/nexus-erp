import { Link } from 'react-router-dom'
import { Package, ArrowRight } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner } from '@shared/components/ui'

export default function LowStockPanel({ loading, lowStock }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Low Stock</CardTitle>
          {lowStock.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-xs
                             font-bold flex items-center justify-center">
              {lowStock.length}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner className="w-5 h-5" />
          </div>
        ) : lowStock.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20
                            flex items-center justify-center">
              <Package className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">All stocked up</p>
              <p className="text-xs text-slate-400 mt-0.5">No items below reorder level</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {lowStock.map((item, i) => {
              const qty = Number(item.qty_on_hand)
              const isOut = qty <= 0
              return (
                <div
                  key={i}
                  className={`p-3 rounded-xl border transition-colors ${
                    isOut
                      ? 'bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20'
                      : 'bg-amber-50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {item.product_name}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {item.sku} · {item.warehouse_name}
                      </p>
                    </div>
                    <Badge color={isOut ? 'red' : 'yellow'} className="flex-shrink-0">
                      {isOut ? 'Out' : `${qty} left`}
                    </Badge>
                  </div>
                </div>
              )
            })}

            <Link
              to="/inventory/stock"
              className="flex items-center justify-center gap-1.5 py-2 text-xs font-medium
                         text-brand-600 dark:text-brand-400
                         hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
            >
              View all stock moves <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
