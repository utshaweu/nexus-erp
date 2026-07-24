import { Star, Phone, Mail, MapPin, Trash2, Pencil } from 'lucide-react'
import { Button, Badge, Card } from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'

function Stars({ rating }) {
  const r = Math.round(Number(rating) || 0)
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className="w-3 h-3"
          fill={i <= r ? '#f59e0b' : 'none'}
          stroke={i <= r ? '#f59e0b' : '#94a3b8'}
        />
      ))}
      <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">
        {Number(rating) || 0}
      </span>
    </div>
  )
}

export default function VendorCard({ vendor, onEdit, onDelete }) {
  const statusColor =
    vendor.status === 'active'      ? 'green'   :
    vendor.status === 'blacklisted' ? 'red'      : 'default'

  return (
    <Card className="p-5 hover:border-slate-300 dark:hover:border-surface-700 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 mr-2">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
            {vendor.name}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">{vendor.category}</p>
        </div>
        <Badge color={statusColor}>{vendor.status}</Badge>
      </div>

      <Stars rating={vendor.rating} />

      <div className="mt-3 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
        {vendor.email && (
          <div className="flex items-center gap-1.5">
            <Mail className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{vendor.email}</span>
          </div>
        )}
        {vendor.phone && (
          <div className="flex items-center gap-1.5">
            <Phone className="w-3 h-3 flex-shrink-0" />
            <span>{vendor.phone}</span>
          </div>
        )}
        {vendor.country && (
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span>{vendor.country}</span>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-surface-200 dark:border-surface-800 flex items-center justify-between">
        {vendor.contact_name
          ? <span className="text-xs text-slate-500 truncate mr-2">{vendor.contact_name}</span>
          : <span />
        }
        <div className="flex gap-1 flex-shrink-0">
          <PermissionGate action="edit" moduleId="purchase">
            <Button variant="ghost" size="xs" onClick={() => onEdit(vendor)}>
              <Pencil className="w-3 h-3" />
            </Button>
          </PermissionGate>
          <PermissionGate action="delete" moduleId="purchase">
            <Button variant="danger" size="xs" onClick={() => onDelete(vendor)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </PermissionGate>
        </div>
      </div>
    </Card>
  )
}
