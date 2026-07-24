import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  PageHeader, Badge, Card, Button, Table, Thead, Th, Tbody, Tr, Td, Spinner,
} from '@shared/components/ui'
import { CheckCircle, XCircle, Printer, ArrowLeft, Package, Plus, Pencil, Trash2, Send } from 'lucide-react'
import { useTenant } from '@core/tenant/TenantContext'
import toast from '@shared/lib/toast'
import PermissionGate from '@shared/components/PermissionGate'
import { PURCHASE_ORDER_STATUS as STATUS_BADGE } from '@shared/lib/constants'
import {
  fetchPurchaseOrderDetail, deletePOLine, updatePOStatus, submitPOForApproval,
} from '../api/purchaseOrders'
import POLineModal from '../components/POLineModal'
import VendorInfoCard from '../components/VendorInfoCard'

export default function PurchaseOrderDetail() {
  const { id }       = useParams()
  const { tenantId } = useTenant()
  const [order,         setOrder]         = useState(null)
  const [lines,         setLines]         = useState([])
  const [loading,       setLoading]       = useState(true)
  const [showLineModal, setShowLineModal] = useState(false)
  const [editingLine,   setEditingLine]   = useState(null)

  const canEditLines = order && ['draft', 'pending'].includes(order.status)

  const loadOrder = useCallback(async () => {
    if (!id || !tenantId) return
    setLoading(true)
    try {
      const { order, lines } = await fetchPurchaseOrderDetail(id, tenantId)
      setOrder(order)
      setLines(lines)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [id, tenantId])

  useEffect(() => { loadOrder() }, [loadOrder])

  const handleDeleteLine = async (lineId) => {
    if (!window.confirm('Remove this line item?')) return
    try {
      await deletePOLine(lineId, id, tenantId)
      toast.success('Line removed.')
      loadOrder()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const openAddLine = () => { setEditingLine(null); setShowLineModal(true) }
  const openEditLine = (l) => { setEditingLine(l); setShowLineModal(true) }
  const closeLineModal = () => { setShowLineModal(false); setEditingLine(null) }

  const updateStatus = async (status) => {
    try {
      await updatePOStatus(id, status)
      toast.success(`Order marked as ${status}.`)
      setOrder(o => ({ ...o, status }))
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleSubmitForApproval = async () => {
    try {
      const result = await submitPOForApproval(tenantId, order, lines, total, window.__erp_user__?.id)
      toast.success(
        result.submitted
          ? `Submitted for approval as ${result.request.request_number}.`
          : 'Order marked as pending.'
      )
      setOrder(o => ({ ...o, status: 'pending' }))
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="w-6 h-6" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 mb-2">Order not found.</p>
        <Link to="/purchase/orders" className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 text-sm">
          ← Back to orders
        </Link>
      </div>
    )
  }

  const s        = STATUS_BADGE[order.status] || STATUS_BADGE.draft
  const subtotal = lines.reduce((a, l) => a + Number(l.quantity) * Number(l.unit_price), 0)
  const taxAmt   = lines.reduce((a, l) => a + Number(l.quantity) * Number(l.unit_price) * ((Number(l.tax_rate) || 0) / 100), 0)
  const total    = subtotal + taxAmt

  return (
    <div className="space-y-6">
      <PageHeader
        title={order.order_number}
        subtitle={`Vendor: ${order.vendor?.name || '—'}`}
        breadcrumb="Purchase / Orders"
        actions={
          <div className="flex items-center gap-2 print:hidden">
            <Link to="/purchase/orders">
              <Button variant="secondary" size="sm">
                <ArrowLeft className="w-4 h-4" />Back
              </Button>
            </Link>

            <PermissionGate action="edit" moduleId="purchase">
              {order.status === 'draft' && (
                <Button
                  variant="success"
                  size="sm"
                  disabled={lines.length === 0}
                  title={lines.length === 0 ? 'Add at least one line item first' : undefined}
                  onClick={handleSubmitForApproval}
                >
                  <Send className="w-4 h-4" />Submit for Approval
                </Button>
              )}
            </PermissionGate>

            <PermissionGate action="approve" moduleId="purchase">
              {order.status === 'pending' && (
                <>
                  <Button variant="success" size="sm" onClick={() => updateStatus('approved')}>
                    <CheckCircle className="w-4 h-4" />Approve
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => updateStatus('cancelled')}>
                    <XCircle className="w-4 h-4" />Cancel
                  </Button>
                </>
              )}
            </PermissionGate>

            {order.status === 'approved' && (
              <PermissionGate action="edit" moduleId="purchase">
                <Button variant="outline" size="sm" onClick={() => updateStatus('received')}>
                  <Package className="w-4 h-4" />Mark Received
                </Button>
              </PermissionGate>
            )}

            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="w-4 h-4" />Print
            </Button>
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300">Order Lines</h3>
                {canEditLines && (
                  <PermissionGate action="edit" moduleId="purchase">
                    <Button size="xs" onClick={openAddLine} className="print:hidden">
                      <Plus className="w-3.5 h-3.5" />Add Line
                    </Button>
                  </PermissionGate>
                )}
              </div>

              {lines.length === 0 ? (
                <div className="py-8 text-center">
                  <Package className="w-8 h-8 text-slate-600 mx-auto mb-2" />
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
                    <Th>Tax %</Th>
                    <Th>Line Total</Th>
                    {canEditLines && <Th></Th>}
                  </Thead>
                  <Tbody>
                    {lines.map(item => {
                      const lineTotal = Number(item.quantity) * Number(item.unit_price)
                      return (
                        <Tr key={item.id}>
                          <Td>
                            <span className="font-medium text-slate-900 dark:text-slate-200">{item.product_name}</span>
                          </Td>
                          <Td>{Number(item.quantity)}</Td>
                          <Td>${Number(item.unit_price).toLocaleString()}</Td>
                          <Td>{Number(item.tax_rate) || 0}%</Td>
                          <Td className="font-semibold">${lineTotal.toLocaleString()}</Td>
                          {canEditLines && (
                            <Td>
                              <div className="flex gap-1">
                                <PermissionGate action="edit" moduleId="purchase">
                                  <Button variant="ghost" size="xs" onClick={() => openEditLine(item)}>
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button variant="danger" size="xs" onClick={() => handleDeleteLine(item.id)}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </PermissionGate>
                              </div>
                            </Td>
                          )}
                        </Tr>
                      )
                    })}
                  </Tbody>
                </Table>
              )}

              <div className="mt-4 pt-4 border-t border-surface-200 dark:border-surface-800 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Subtotal</span>
                  <span>${subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Tax</span>
                  <span>${taxAmt.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 dark:text-slate-100 text-base pt-2 border-t border-surface-200 dark:border-surface-800 mt-2">
                  <span>Total</span>
                  <span>${total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300 mb-4">Order Info</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <Badge color={s.color}>{s.label}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Order Date</span>
                <span className="text-slate-700 dark:text-slate-300">{order.order_date}</span>
              </div>
              {order.expected_date && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Expected</span>
                  <span className="text-slate-700 dark:text-slate-300">{order.expected_date}</span>
                </div>
              )}
              {order.reference && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Reference</span>
                  <span className="font-mono text-xs text-slate-700 dark:text-slate-300">{order.reference}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Lines</span>
                <span className="text-slate-700 dark:text-slate-300">{lines.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal</span>
                <span className="text-slate-700 dark:text-slate-300">${subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t border-surface-200 dark:border-surface-800">
                <span className="text-slate-400">Total</span>
                <span className="text-slate-900 dark:text-slate-100">${total.toLocaleString()}</span>
              </div>
            </div>
          </Card>

          <VendorInfoCard vendor={order.vendor} />

          {order.notes && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300 mb-2">Notes</h3>
              <p className="text-sm text-slate-400">{order.notes}</p>
            </Card>
          )}
        </div>
      </div>

      <POLineModal
        open={showLineModal}
        onClose={closeLineModal}
        line={editingLine}
        lines={lines}
        orderId={id}
        tenantId={tenantId}
        onSaved={loadOrder}
      />
    </div>
  )
}
