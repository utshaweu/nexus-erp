import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  PageHeader, Badge, Card, Button,
  Table, Thead, Th, Tbody, Tr, Td, Spinner,
} from '@shared/components/ui'
import { CheckCircle, XCircle, Printer, ArrowLeft, Package } from 'lucide-react'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import toast from '@shared/lib/toast'
import PermissionGate from '@shared/components/PermissionGate'

const STATUS_BADGE = {
  draft:     { label: 'Draft',     color: 'default' },
  pending:   { label: 'Pending',   color: 'yellow'  },
  approved:  { label: 'Approved',  color: 'green'   },
  received:  { label: 'Received',  color: 'blue'    },
  cancelled: { label: 'Cancelled', color: 'red'     },
}

export default function PurchaseOrderDetail() {
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
        .from('purchase_orders')
        .select('*, vendor:vendors(name, email, phone, contact_name)')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .single(),
      supabase
        .from('purchase_order_lines')
        .select('*')
        .eq('purchase_order_id', id)
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
      .from('purchase_orders')
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
        <Link to="/purchase/orders" className="text-brand-400 text-sm hover:text-brand-300">
          ← Back to orders
        </Link>
      </div>
    )
  }

  const s        = STATUS_BADGE[order.status] || STATUS_BADGE.draft
  const subtotal = lines.reduce((acc, l) => acc + Number(l.quantity) * Number(l.unit_price), 0)
  const taxAmt   = lines.reduce(
    (acc, l) => acc + Number(l.quantity) * Number(l.unit_price) * (Number(l.tax_rate) || 0) / 100,
    0,
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={order.order_number}
        subtitle={`Vendor: ${order.vendor?.name || '—'}`}
        breadcrumb="Purchase / Orders"
        actions={
          <div className="flex items-center gap-2">
            <Link to="/purchase/orders">
              <Button variant="secondary" size="sm">
                <ArrowLeft className="w-4 h-4" />Back
              </Button>
            </Link>

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
        {/* Order lines */}
        <div className="lg:col-span-2">
          <Card>
            <div className="p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-4">Order Lines</h3>
              {lines.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-sm">No line items on this order.</div>
              ) : (
                <Table>
                  <Thead>
                    <Th>Product</Th><Th>Qty</Th><Th>Unit Price</Th><Th>Tax %</Th><Th>Total</Th>
                  </Thead>
                  <Tbody>
                    {lines.map(item => (
                      <Tr key={item.id}>
                        <Td><span className="font-medium">{item.product_name}</span></Td>
                        <Td>{Number(item.quantity)}</Td>
                        <Td>${Number(item.unit_price).toLocaleString()}</Td>
                        <Td>{Number(item.tax_rate) || 0}%</Td>
                        <Td className="font-semibold">
                          ${(Number(item.quantity) * Number(item.unit_price)).toLocaleString()}
                        </Td>
                      </Tr>
                    ))}
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

        {/* Sidebar */}
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
              {order.expected_date && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Expected</span>
                  <span className="text-slate-300">{order.expected_date}</span>
                </div>
              )}
              {order.reference && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Reference</span>
                  <span className="font-mono text-xs text-slate-300">{order.reference}</span>
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

          {order.vendor && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Vendor</h3>
              <div className="space-y-1.5 text-sm">
                <p className="font-medium text-slate-200">{order.vendor.name}</p>
                {order.vendor.contact_name && (
                  <p className="text-slate-400">{order.vendor.contact_name}</p>
                )}
                {order.vendor.email && (
                  <p className="text-slate-500">{order.vendor.email}</p>
                )}
                {order.vendor.phone && (
                  <p className="text-slate-500">{order.vendor.phone}</p>
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
