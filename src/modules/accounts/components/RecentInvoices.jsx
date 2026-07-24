import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@shared/components/ui'
import { INVOICE_STATUS } from '@shared/lib/constants'

export default function RecentInvoices({ loading, invoices }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Recent Invoices</CardTitle>
          <Link to="/accounts/invoices">
            <span className="text-xs text-brand-500 hover:text-brand-400 transition-colors">
              View all →
            </span>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 text-center text-sm text-slate-400">Loading…</div>
        ) : invoices.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-slate-400">No invoices yet.</p>
            <Link to="/accounts/invoices" className="mt-3 inline-block">
              <Button size="xs" variant="outline" className="gap-1">
                <Plus className="w-3 h-3" />Create one
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map(inv => (
              <div
                key={inv.invoice_number}
                className="flex items-center justify-between py-2
                           border-b border-surface-200 dark:border-surface-800 last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                    {inv.customer?.name || '—'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {inv.invoice_number} · Due {inv.due_date || '—'}
                  </p>
                </div>
                <div className="text-right ml-3 flex-shrink-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    ${Number(inv.total_amount || 0).toLocaleString()}
                  </p>
                  <Badge color={INVOICE_STATUS[inv.status]?.color || 'default'}>
                    {INVOICE_STATUS[inv.status]?.label || inv.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
