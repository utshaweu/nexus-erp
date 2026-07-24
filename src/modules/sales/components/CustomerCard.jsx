import { Mail, Phone, MapPin, Trash2, Pencil } from 'lucide-react'
import { Button, Badge, Card } from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'

export default function CustomerCard({ customer, onEdit, onDelete }) {
  return (
    <Card className="p-5 hover:border-slate-300 dark:hover:border-surface-700 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 mr-2">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">{customer.name}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{customer.industry || 'General'}</p>
        </div>
        <Badge color={customer.status === 'active' ? 'green' : 'default'}>{customer.status}</Badge>
      </div>

      <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400 mb-4">
        {customer.email && (
          <div className="flex items-center gap-1.5">
            <Mail className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{customer.email}</span>
          </div>
        )}
        {customer.phone && (
          <div className="flex items-center gap-1.5">
            <Phone className="w-3 h-3 flex-shrink-0" />
            <span>{customer.phone}</span>
          </div>
        )}
        {customer.country && (
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span>{customer.country}</span>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-surface-200 dark:border-surface-800 flex items-center justify-between">
        {customer.contact_name
          ? <span className="text-xs text-slate-500 truncate mr-2">{customer.contact_name}</span>
          : <span />
        }
        <div className="flex gap-1 flex-shrink-0">
          <PermissionGate action="edit" moduleId="sales">
            <Button variant="ghost" size="xs" onClick={() => onEdit(customer)}>
              <Pencil className="w-3 h-3" />
            </Button>
          </PermissionGate>
          <PermissionGate action="delete" moduleId="sales">
            <Button variant="danger" size="xs" onClick={() => onDelete(customer)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </PermissionGate>
        </div>
      </div>
    </Card>
  )
}
