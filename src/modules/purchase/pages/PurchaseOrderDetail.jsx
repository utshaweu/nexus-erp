import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { PageHeader, Card, Button, Spinner } from '@shared/components/ui'
import { CheckCircle, XCircle, Printer, ArrowLeft, Package, Send } from 'lucide-react'
import { useTenant } from '@core/tenant/TenantContext'
import toast from '@shared/lib/toast'
import PermissionGate from '@shared/components/PermissionGate'
import { PURCHASE_ORDER_STATUS as STATUS_BADGE } from '@shared/lib/constants'
import {
  fetchPurchaseOrderDetail, deletePOLine, updatePOStatus, submitPOForApproval,
} from '../api/purchaseOrders'
import POLineModal from '../components/POLineModal'
import POLinesTable from '../components/POLinesTable'
import POInfoCard from '../components/POInfoCard'
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
          <POLinesTable
            lines={lines}
            canEditLines={canEditLines}
            onAdd={openAddLine}
            onEdit={openEditLine}
            onDelete={handleDeleteLine}
            subtotal={subtotal}
            taxAmt={taxAmt}
            total={total}
          />
        </div>

        <div className="space-y-4">
          <POInfoCard order={order} statusInfo={s} lines={lines} subtotal={subtotal} total={total} />

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
