import { Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { Button, Badge, Table, Thead, Th, Tbody, Tr, Td } from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import { OFFER_TYPES, OFFER_APPLIES_TO_LABELS } from '@shared/lib/constants'
import { getEffectiveStatus, discountLabel } from '../api/offers'
import CopyButton from './CopyButton'

const STATUS_COLORS = { active: 'green', inactive: 'default', expired: 'red', upcoming: 'yellow' }
const STATUS_LABELS = { active: 'Active', inactive: 'Inactive', expired: 'Expired', upcoming: 'Upcoming' }

export default function OffersTable({ offers, onEdit, onToggle, onDelete }) {
  return (
    <Table>
      <Thead>
        <Th>Name</Th>
        <Th>Type</Th>
        <Th>Discount</Th>
        <Th>Coupon Code</Th>
        <Th>Applies To</Th>
        <Th>Valid Period</Th>
        <Th>Usage</Th>
        <Th>Status</Th>
        <Th></Th>
      </Thead>
      <Tbody>
        {offers.map(offer => {
          const effStatus = getEffectiveStatus(offer)
          const typeInfo  = OFFER_TYPES[offer.offer_type] || OFFER_TYPES.percentage
          return (
            <Tr key={offer.id}>
              <Td>
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-200">{offer.name}</p>
                  {offer.description && (
                    <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[160px]">{offer.description}</p>
                  )}
                </div>
              </Td>
              <Td>
                <Badge color={typeInfo.color}>{typeInfo.label}</Badge>
              </Td>
              <Td>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{discountLabel(offer)}</span>
                {Number(offer.minimum_amount) > 0 && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Min. ${Number(offer.minimum_amount).toLocaleString()}
                  </p>
                )}
              </Td>
              <Td>
                {offer.coupon_code
                  ? <CopyButton code={offer.coupon_code} />
                  : <span className="text-slate-600">—</span>
                }
              </Td>
              <Td>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {OFFER_APPLIES_TO_LABELS[offer.applies_to] || '—'}
                </span>
                {offer.applies_to !== 'all' && offer.applies_to_ref && (
                  <p className="text-xs text-slate-500 mt-0.5">{offer.applies_to_ref}</p>
                )}
              </Td>
              <Td>
                {offer.start_date || offer.end_date ? (
                  <div className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
                    {offer.start_date && <div>From: {offer.start_date}</div>}
                    {offer.end_date   && <div>To: {offer.end_date}</div>}
                  </div>
                ) : (
                  <span className="text-slate-600 text-xs">No limit</span>
                )}
              </Td>
              <Td>
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {Number(offer.usage_count)}
                  {offer.usage_limit
                    ? <span className="text-slate-500"> / {offer.usage_limit}</span>
                    : <span className="text-slate-600"> / ∞</span>
                  }
                </span>
              </Td>
              <Td>
                <Badge color={STATUS_COLORS[effStatus]}>
                  {STATUS_LABELS[effStatus]}
                </Badge>
              </Td>
              <Td>
                <div className="flex items-center gap-1">
                  <PermissionGate action="edit" moduleId="sales">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => onEdit(offer)}
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => onToggle(offer)}
                      title={offer.is_active ? 'Deactivate' : 'Activate'}
                      className={offer.is_active ? 'text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300' : 'text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300'}
                    >
                      {offer.is_active
                        ? <ToggleRight className="w-3.5 h-3.5" />
                        : <ToggleLeft  className="w-3.5 h-3.5" />
                      }
                    </Button>
                  </PermissionGate>
                  <PermissionGate action="delete" moduleId="sales">
                    <Button
                      variant="danger"
                      size="xs"
                      onClick={() => onDelete(offer.id, offer.name)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </PermissionGate>
                </div>
              </Td>
            </Tr>
          )
        })}
      </Tbody>
    </Table>
  )
}
