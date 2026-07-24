import { Card } from '@shared/components/ui'

/** Shared by RFQDetail and PurchaseOrderDetail sidebars — nearly identical originally. */
export default function VendorInfoCard({ vendor }) {
  if (!vendor) return null
  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300 mb-3">Vendor</h3>
      <div className="space-y-1.5 text-sm">
        <p className="font-medium text-slate-900 dark:text-slate-200">{vendor.name}</p>
        {vendor.contact_name && (
          <p className="text-slate-700 dark:text-slate-400">{vendor.contact_name}</p>
        )}
        {vendor.email && <p className="text-slate-500">{vendor.email}</p>}
        {vendor.phone && <p className="text-slate-500">{vendor.phone}</p>}
      </div>
    </Card>
  )
}
