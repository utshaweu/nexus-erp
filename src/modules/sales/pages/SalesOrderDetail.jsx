import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  PageHeader, Badge, Card, Button,
  Table, Thead, Th, Tbody, Tr, Td, Spinner,
} from '@shared/components/ui'
import { CheckCircle, XCircle, Printer, ArrowLeft, FileText } from 'lucide-react'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import toast from '@shared/lib/toast'
import PermissionGate from '@shared/components/PermissionGate'
import { SALES_ORDER_STATUS as STATUS_BADGE } from '@shared/lib/constants'

export default function SalesOrderDetail() {
  const { id }       = useParams()
  const { tenantId } = useTenant()
  const [order,   setOrder]   = useState(null)
  const [lines,   setLines]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id || !tenantId) return
    loadOrder()
  }, [id, tenantId])

  async function loadOrder() {
    setLoading(true)
    const [orderRes, linesRes] = await Promise.all([
      supabase
        .from('sales_orders')
        .select('*, customer:customers(name, email, phone, contact_name)')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .single(),
      supabase
        .from('sales_order_lines')
        .select('*')
        .eq('sales_order_id', id)
        .eq('tenant_id', tenantId)
        .order('id'),
    ])

    if (orderRes.error) {
      toast.error('Order not found.')
      setLoading(false)
      return
    }
    setOrder(orderRes.data)
    setLines(linesRes.data || [])
    setLoading(false)
  }

  const updateStatus = async (status) => {
    const { error } = await supabase
      .from('sales_orders')
      .update({ status })
      .eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success(`Order marked as ${status}.`)
    setOrder(o => ({ ...o, status }))
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
        <Link to="/sales/orders" className="text-brand-400 text-sm hover:text-brand-300">
          ← Back to orders
        </Link>
      </div>
    )
  }

  const s        = STATUS_BADGE[order.status] || STATUS_BADGE.draft
  const subtotal = lines.reduce((acc, l) => {
    const lineBase = Number(l.quantity) * Number(l.unit_price)
    const disc     = (Number(l.discount_pct) || 0) / 100
    return acc + lineBase * (1 - disc)
  }, 0)
  const taxAmt = lines.reduce((acc, l) => {
    const lineBase = Number(l.quantity) * Number(l.unit_price)
    const disc     = (Number(l.discount_pct) || 0) / 100
    return acc + lineBase * (1 - disc) * ((Number(l.tax_rate) || 0) / 100)
  }, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title={order.order_number}
        subtitle={`Customer: ${order.customer?.name || '—'}`}
        breadcrumb="Sales / Orders"
        actions={
          <div className="flex items-center gap-2">
            <Link to="/sales/orders">
              <Button variant="secondary" size="sm">
                <ArrowLeft className="w-4 h-4" />Back
              </Button>
            </Link>

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
          <Card>
            <div className="p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-4">Order Lines</h3>
              {lines.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-sm">No line items on this order.</div>
              ) : (
                <Table>
                  <Thead>
                    <Th>Product</Th><Th>Qty</Th><Th>Unit Price</Th><Th>Disc %</Th><Th>Tax %</Th><Th>Total</Th>
                  </Thead>
                  <Tbody>
                    {lines.map(item => {
                      const lineBase  = Number(item.quantity) * Number(item.unit_price)
                      const disc      = (Number(item.discount_pct) || 0) / 100
                      const lineTotal = lineBase * (1 - disc)
                      return (
                        <Tr key={item.id}>
                          <Td><span className="font-medium">{item.product_name}</span></Td>
                          <Td>{Number(item.quantity)}</Td>
                          <Td>${Number(item.unit_price).toLocaleString()}</Td>
                          <Td>{Number(item.discount_pct) || 0}%</Td>
                          <Td>{Number(item.tax_rate) || 0}%</Td>
                          <Td className="font-semibold">${lineTotal.toLocaleString()}</Td>
                        </Tr>
                      )
                    })}
                  </Tbody>
                </Table>
              )}

              <div className="mt-4 pt-4 border-t border-surface-800 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal</span>
                  <span>${subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Tax</span>
                  <span>${taxAmt.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-100 text-base pt-2 border-t border-surface-800 mt-2">
                  <span>Total</span>
                  <span>${(subtotal + taxAmt).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">Order Info</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <Badge color={s.color}>{s.label}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Order Date</span>
                <span className="text-slate-300">{order.order_date}</span>
              </div>
              {order.delivery_date && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Delivery</span>
                  <span className="text-slate-300">{order.delivery_date}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal</span>
                <span className="text-slate-300">${subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-slate-400">Total</span>
                <span className="text-slate-100">${(subtotal + taxAmt).toLocaleString()}</span>
              </div>
            </div>
          </Card>

          {order.customer && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Customer</h3>
              <div className="space-y-1.5 text-sm">
                <p className="font-medium text-slate-200">{order.customer.name}</p>
                {order.customer.contact_name && (
                  <p className="text-slate-400">{order.customer.contact_name}</p>
                )}
                {order.customer.email && (
                  <p className="text-slate-500">{order.customer.email}</p>
                )}
                {order.customer.phone && (
                  <p className="text-slate-500">{order.customer.phone}</p>
                )}
              </div>
            </Card>
          )}

          {order.notes && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-2">Notes</h3>
              <p className="text-sm text-slate-400">{order.notes}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
