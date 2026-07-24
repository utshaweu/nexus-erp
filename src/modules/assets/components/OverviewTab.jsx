import { Hash, MapPin, ShieldCheck, Calendar } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@shared/components/ui'
import { DEPRECIATION_METHODS } from '@shared/lib/constants'

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function OverviewTab({ asset }) {
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle>Asset Details</CardTitle></CardHeader>
        <CardContent className="space-y-3 pt-0">
          {[
            { icon: Hash,        label: 'Asset Number',     value: asset.asset_number },
            { icon: Calendar,    label: 'Purchase Date',    value: asset.purchase_date },
            { icon: MapPin,      label: 'Location',         value: asset.location || '—' },
            { icon: Hash,        label: 'Serial / Tag No.', value: asset.serial_number || '—' },
            { icon: ShieldCheck, label: 'Warranty Expiry',  value: asset.warranty_expiry || '—' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 py-2 border-b border-surface-100 dark:border-surface-800 last:border-0">
              <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span className="text-xs text-slate-500 w-32 flex-shrink-0">{label}</span>
              <span className="text-sm text-slate-800 dark:text-slate-200 font-medium">{value}</span>
            </div>
          ))}
          {asset.description && (
            <div className="pt-1">
              <p className="text-xs text-slate-500 mb-1">Description</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">{asset.description}</p>
            </div>
          )}
          {asset.notes && (
            <div className="pt-1">
              <p className="text-xs text-slate-500 mb-1">Notes</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">{asset.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Financial Summary</CardTitle></CardHeader>
        <CardContent className="space-y-3 pt-0">
          {[
            { label: 'Purchase Cost',           value: `$${fmt(asset.purchase_cost)}` },
            { label: 'Salvage Value',            value: `$${fmt(asset.salvage_value)}` },
            { label: 'Depreciable Amount',       value: `$${fmt(asset.purchase_cost - asset.salvage_value)}` },
            { label: 'Accumulated Depreciation', value: `$${fmt(asset.accumulated_depreciation)}` },
            { label: 'Current Book Value',       value: `$${fmt(asset.book_value)}` },
            { label: 'Depreciation Method',      value: DEPRECIATION_METHODS[asset.depreciation_method]?.label || asset.depreciation_method },
            { label: 'Useful Life',              value: `${asset.useful_life_years} year${asset.useful_life_years !== 1 ? 's' : ''}` },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-surface-100 dark:border-surface-800 last:border-0">
              <span className="text-xs text-slate-500">{label}</span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{value}</span>
            </div>
          ))}
          {asset.status === 'disposed' && (
            <div className="pt-2 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">Disposed</p>
              <p className="text-xs text-red-600 dark:text-red-400">
                Date: {asset.disposal_date} · Amount: ${fmt(asset.disposal_amount)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
