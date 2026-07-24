import { TrendingDown } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Spinner } from '@shared/components/ui'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const fmtVal = (n) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
  return `$${Number(n).toFixed(0)}`
}

export default function ProjectedValueChart({ loading, data }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader><CardTitle>Projected Book Value</CardTitle></CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[200px] flex items-center justify-center">
            <Spinner className="w-6 h-6" />
          </div>
        ) : data.length < 2 ? (
          <div className="h-[200px] flex flex-col items-center justify-center gap-2 text-sm text-slate-500">
            <TrendingDown className="w-8 h-8 text-slate-300 dark:text-slate-700" />
            No depreciation schedule data. Create assets to see projections.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="assetGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmtVal(v)} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                formatter={v => [`$${Number(v).toLocaleString()}`, 'Book Value']}
              />
              <Area type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} fill="url(#assetGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
