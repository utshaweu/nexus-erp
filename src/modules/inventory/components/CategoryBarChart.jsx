import { Package, TrendingUp } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Spinner } from '@shared/components/ui'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700
                    rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">{label}</p>
      <p className="text-blue-600 dark:text-blue-400">{payload[0].value} products</p>
    </div>
  )
}

export default function CategoryBarChart({ loading, catData, totalProducts }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Products by Category</CardTitle>
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400
                          bg-emerald-50 dark:bg-emerald-500/10
                          px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/20">
            <TrendingUp className="w-3 h-3" />
            <span>{totalProducts} total</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-[220px]">
            <Spinner className="w-6 h-6" />
          </div>
        ) : catData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[220px] gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-surface-800
                            flex items-center justify-center">
              <Package className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm text-slate-400">No products yet — add products to see chart.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={catData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:[&>line]:stroke-surface-800" />
              <XAxis
                dataKey="cat"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="qty" name="Products" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
