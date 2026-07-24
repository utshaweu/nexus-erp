import { Card, CardHeader, CardTitle, CardContent } from '@shared/components/ui'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

export default function DeptPieChart({ deptData }) {
  return (
    <Card>
      <CardHeader><CardTitle>By Department</CardTitle></CardHeader>
      <CardContent>
        {deptData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[180px] text-slate-500 text-sm">
            No data yet
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={deptData}
                  cx="50%" cy="50%"
                  outerRadius={70}
                  dataKey="value"
                  stroke="none"
                >
                  {deptData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-2">
              {deptData.map(d => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                    {d.name}
                  </span>
                  <span className="font-medium text-slate-300">{d.value}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
