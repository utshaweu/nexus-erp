import { Plus, Pencil, Trash2, ShoppingCart } from 'lucide-react'
import { Card, Button, Badge, Table, Thead, Th, Tbody, Tr, Td } from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import { lineMath } from '../api/salesOrders'

export default function OrderLinesTable({
  lines, canEditLines, onAdd, onEdit, onDelete,
  grossSubtotal, totalDiscount, subtotal, taxAmt, couponDiscount, couponCode, total,
}) {
  return (
    <Card>
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300">Order Lines</h3>
          {canEditLines && (
            <PermissionGate action="edit" moduleId="sales">
              <Button size="xs" onClick={onAdd} className="print:hidden">
                <Plus className="w-3.5 h-3.5" />Add Line
              </Button>
            </PermissionGate>
          )}
        </div>

        {lines.length === 0 ? (
          <div className="py-8 text-center">
            <ShoppingCart className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">No line items on this order.</p>
            {canEditLines && (
              <p className="text-slate-600 text-xs mt-1">Click "Add Line" to add products.</p>
            )}
          </div>
        ) : (
          <Table>
            <Thead>
              <Th>Product / Description</Th>
              <Th>Qty</Th>
              <Th>Unit Price</Th>
              <Th>Discount</Th>
              <Th>Tax %</Th>
              <Th>Line Total</Th>
              {canEditLines && <Th></Th>}
            </Thead>
            <Tbody>
              {lines.map(item => {
                const m         = lineMath(item)
                const fixedLine = Number(item.discount_amount) > 0
                return (
                  <Tr key={item.id}>
                    <Td>
                      <span className="font-medium text-slate-900 dark:text-slate-200">{item.product_name}</span>
                      {item.is_gift && <Badge color="green" className="ml-2">Free</Badge>}
                    </Td>
                    <Td>{Number(item.quantity)}</Td>
                    <Td>${Number(item.unit_price).toLocaleString()}</Td>
                    <Td>
                      {m.discount > 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {fixedLine ? `$${Number(item.discount_amount).toLocaleString()}` : `${Number(item.discount_pct)}%`}
                        </span>
                      ) : '—'}
                    </Td>
                    <Td>{Number(item.tax_rate) || 0}%</Td>
                    <Td className="font-semibold">${m.total.toFixed(2)}</Td>
                    {canEditLines && (
                      <Td>
                        {item.is_gift ? (
                          <span className="text-xs text-slate-400 dark:text-slate-500">auto</span>
                        ) : (
                          <div className="flex gap-1">
                            <PermissionGate action="edit" moduleId="sales">
                              <Button variant="ghost" size="xs" onClick={() => onEdit(item)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="danger" size="xs" onClick={() => onDelete(item.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </PermissionGate>
                          </div>
                        )}
                      </Td>
                    )}
                  </Tr>
                )
              })}
            </Tbody>
          </Table>
        )}

        {/* Totals */}
        <div className="mt-4 pt-4 border-t border-surface-200 dark:border-surface-800 space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-500 dark:text-slate-400">
            <span>Subtotal (before discount)</span>
            <span>${grossSubtotal.toLocaleString()}</span>
          </div>
          {totalDiscount > 0 && (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
              <span>Discount</span>
              <span>−${totalDiscount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-500 dark:text-slate-400">
            <span>After Discount</span>
            <span>${subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-slate-500 dark:text-slate-400">
            <span>Tax</span>
            <span>${taxAmt.toFixed(2)}</span>
          </div>
          {couponDiscount > 0 && (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
              <span>Coupon{couponCode ? ` (${couponCode})` : ''}</span>
              <span>−${couponDiscount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-slate-900 dark:text-slate-100 text-base pt-2 border-t border-surface-200 dark:border-surface-800 mt-2">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </Card>
  )
}
