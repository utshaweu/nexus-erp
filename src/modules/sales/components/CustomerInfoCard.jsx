import { Card } from '@shared/components/ui'

/** Sidebar "Customer" card — byte-identical between QuotationDetail.jsx and SalesOrderDetail.jsx originally. */
export default function CustomerInfoCard({ customer }) {
  if (!customer) return null
  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300 mb-3">Customer</h3>
      <div className="space-y-1.5 text-sm">
        <p className="font-medium text-slate-900 dark:text-slate-200">{customer.name}</p>
        {customer.contact_name && (
          <p className="text-slate-600 dark:text-slate-400">{customer.contact_name}</p>
        )}
        {customer.email && (
          <p className="text-slate-500">{customer.email}</p>
        )}
        {customer.phone && (
          <p className="text-slate-500">{customer.phone}</p>
        )}
      </div>
    </Card>
  )
}
