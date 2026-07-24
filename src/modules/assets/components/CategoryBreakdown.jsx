import { Card, CardHeader, CardTitle, CardContent } from '@shared/components/ui'

export default function CategoryBreakdown({ loading, categories }) {
  return (
    <Card>
      <CardHeader><CardTitle>Assets by Category</CardTitle></CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-8 rounded bg-surface-200 dark:bg-surface-800 animate-pulse" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">No active assets yet.</p>
        ) : (
          categories.map(cat => (
            <div key={cat.name} className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400 truncate mr-2">{cat.name}</span>
                <span className="text-slate-300 flex-shrink-0">{cat.count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-800">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(4, (cat.count / (categories[0]?.count || 1)) * 100)}%`,
                    backgroundColor: cat.color,
                  }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
