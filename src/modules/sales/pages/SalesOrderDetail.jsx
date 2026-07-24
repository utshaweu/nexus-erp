import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { PageHeader, Card, Button, Spinner } from '@shared/components/ui'
import { CheckCircle, XCircle, Printer, ArrowLeft, FileText, Send } from 'lucide-react'
import { useTenant } from '@core/tenant/TenantContext'
import toast from '@shared/lib/toast'
import PermissionGate from '@shared/components/PermissionGate'
import { SALES_ORDER_STATUS as STATUS_BADGE } from '@shared/lib/constants'
import {
  fetchSalesOrderDetail, deleteOrderLine, updateOrderStatus, submitSOForApproval,
  applyCoupon, removeCoupon, fetchApprovalState, lineMath,
} from '../api/salesOrders'
import OrderLineModal from '../components/OrderLineModal'
import OrderLinesTable from '../components/OrderLinesTable'
import OrderInfoCard from '../components/OrderInfoCard'
import CouponCard from '../components/CouponCard'
import CustomerInfoCard from '../components/CustomerInfoCard'

export default function SalesOrderDetail() {
  const { id }       = useParams()
  const { tenantId } = useTenant()
  const [order,          setOrder]          = useState(null)
  const [lines,          setLines]          = useState([])
  const [loading,        setLoading]        = useState(true)
  const [showLineModal,  setShowLineModal]  = useState(false)
  const [editingLine,    setEditingLine]    = useState(null)
  const [couponInput,    setCouponInput]    = useState('')
  const [activeWorkflow, setActiveWorkflow] = useState(null)
  const [pendingRequest, setPendingRequest] = useState(null)

  const canEditLines = order && ['draft'].includes(order.status)

  const loadOrder = useCallback(async () => {
    if (!id || !tenantId) return
    setLoading(true)
    try {
      const { order, lines } = await fetchSalesOrderDetail(id, tenantId)
      setOrder(order)
      setLines(lines)
    } catch (err) {
      toast.error('Order not found.')
    } finally {
      setLoading(false)
    }
  }, [id, tenantId])

  useEffect(() => { loadOrder() }, [loadOrder])

  const loadApprovalState = useCallback(async () => {
    if (!id || !tenantId) return
    const { activeWorkflow, pendingRequest } = await fetchApprovalState(tenantId, id)
    setActiveWorkflow(activeWorkflow)
    setPendingRequest(pendingRequest)
  }, [id, tenantId])

  useEffect(() => { loadApprovalState() }, [loadApprovalState])

  const handleSubmitForApproval = async () => {
    try {
      const result = await submitSOForApproval(tenantId, order, lines, total, window.__erp_user__?.id)
      if (result.submitted) {
        setPendingRequest(result.request)
        toast.success(`Submitted for approval as ${result.request.request_number}.`)
      }
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleDeleteLine = async (lineId) => {
    if (!window.confirm('Remove this line item?')) return
    try {
      await deleteOrderLine(lineId, tenantId, id)
      toast.success('Line removed.')
      loadOrder()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleApplyCoupon = async () => {
    const code = couponInput.trim()
    if (!code) return
    try {
      await applyCoupon(tenantId, id, code, lines)
      toast.success('Coupon applied.')
      setCouponInput('')
      loadOrder()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleRemoveCoupon = async () => {
    try {
      await removeCoupon(tenantId, id, order, lines)
      toast.success('Coupon removed.')
      loadOrder()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const openAddLine  = ()  => { setEditingLine(null); setShowLineModal(true) }
  const openEditLine = (l) => { setEditingLine(l);    setShowLineModal(true) }
  const closeModal   = ()  => { setShowLineModal(false); setEditingLine(null) }

  const updateStatus = async (status) => {
    try {
      await updateOrderStatus(id, status)
      toast.success(`Order marked as ${status}.`)
      setOrder(o => ({ ...o, status }))
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
        <Link to="/sales/orders" className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 text-sm">
          ← Back to orders
        </Link>
      </div>
    )
  }

  const s              = STATUS_BADGE[order.status] || STATUS_BADGE.draft
  const subtotal        = lines.reduce((a, l) => a + lineMath(l).net, 0)
  const taxAmt          = lines.reduce((a, l) => a + lineMath(l).tax, 0)
  const totalDiscount   = lines.reduce((a, l) => a + lineMath(l).discount, 0)
  const grossSubtotal   = subtotal + totalDiscount
  const couponDiscount  = Number(order.coupon_discount) || 0
  const total           = Math.max(0, subtotal + taxAmt - couponDiscount)

  return (
    <div className="space-y-6">
      <PageHeader
        title={order.order_number}
        subtitle={`Customer: ${order.customer?.name || '—'}`}
        breadcrumb="Sales / Orders"
        actions={
          <div className="flex items-center gap-2 print:hidden">
            <Link to="/sales/orders">
              <Button variant="secondary" size="sm">
                <ArrowLeft className="w-4 h-4" />Back
              </Button>
            </Link>

            {order.status === 'draft' && activeWorkflow && !pendingRequest && (
              <PermissionGate action="edit" moduleId="sales">
                <Button variant="outline" size="sm" onClick={handleSubmitForApproval}>
                  <Send className="w-4 h-4" />Submit for Approval
                </Button>
              </PermissionGate>
            )}

            <PermissionGate action="approve" moduleId="sales">
              {order.status === 'draft' && (
                <Button variant="success" size="sm" onClick={() => updateStatus('confirmed')}>
                  <CheckCircle className="w-4 h-4" />Confirm
                </Button>
              )}
            </PermissionGate>

            {order.status === 'confirmed' && (
              <PermissionGate action="edit" moduleId="sales">
                <Button variant="outline" size="sm" onClick={() => updateStatus('invoiced')}>
                  <FileText className="w-4 h-4" />Invoice
                </Button>
              </PermissionGate>
            )}

            {order.status === 'invoiced' && (
              <PermissionGate action="edit" moduleId="sales">
                <Button variant="success" size="sm" onClick={() => updateStatus('done')}>
                  <CheckCircle className="w-4 h-4" />Mark Done
                </Button>
              </PermissionGate>
            )}

            {['draft', 'confirmed'].includes(order.status) && (
              <PermissionGate action="approve" moduleId="sales">
                <Button variant="danger" size="sm" onClick={() => updateStatus('cancelled')}>
                  <XCircle className="w-4 h-4" />Cancel
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
          <OrderLinesTable
            lines={lines}
            canEditLines={canEditLines}
            onAdd={openAddLine}
            onEdit={openEditLine}
            onDelete={handleDeleteLine}
            grossSubtotal={grossSubtotal}
            totalDiscount={totalDiscount}
            subtotal={subtotal}
            taxAmt={taxAmt}
            couponDiscount={couponDiscount}
            couponCode={order.coupon_code}
            total={total}
          />
        </div>

        <div className="space-y-4">
          <OrderInfoCard
            order={order}
            statusInfo={s}
            pendingRequest={pendingRequest}
            lines={lines}
            totalDiscount={totalDiscount}
            total={total}
          />

          <CouponCard
            order={order}
            couponDiscount={couponDiscount}
            canEditLines={canEditLines}
            couponInput={couponInput}
            onCouponInputChange={setCouponInput}
            onApply={handleApplyCoupon}
            onRemove={handleRemoveCoupon}
          />

          <CustomerInfoCard customer={order.customer} />

          {order.notes && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300 mb-2">Notes</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{order.notes}</p>
            </Card>
          )}
        </div>
      </div>

      <OrderLineModal
        open={showLineModal}
        onClose={closeModal}
        line={editingLine}
        lines={lines}
        orderId={id}
        tenantId={tenantId}
        customerName={order.customer?.name}
        onSaved={loadOrder}
      />
    </div>
  )
}
