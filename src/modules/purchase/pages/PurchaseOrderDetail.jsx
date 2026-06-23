import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  PageHeader, Badge, Card, Button, Modal, Input, Select,
  Table, Thead, Th, Tbody, Tr, Td, Spinner,
} from '@shared/components/ui'
import { CheckCircle, XCircle, Printer, ArrowLeft, Package, Plus, Pencil, Trash2, Send } from 'lucide-react'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import toast from '@shared/lib/toast'
import PermissionGate from '@shared/components/PermissionGate'
import { PURCHASE_ORDER_STATUS as STATUS_BADGE } from '@shared/lib/constants'

const lineSchema = z.object({
  product_name: z.string().trim().min(1, 'Product name is required'),
  quantity:     z.coerce.number({ invalid_type_error: 'Enter a number' }).positive('Must be > 0'),
  unit_price:   z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0, 'Must be ≥ 0'),
  tax_rate:     z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0).max(100).default(0),
})

// ── LineModal ─────────────────────────────────────────────────────────────────

function LineModal({ open, onClose, line, lines = [], orderId, tenantId, onSaved }) {
  const isEdit = Boolean(line)
  const {
    register, handleSubmit, reset, setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(lineSchema),
    defaultValues: { product_name: '', quantity: 1, unit_price: 0, tax_rate: 0 },
  })

  // Inventory products for the dropdown
  const [allProducts, setAllProducts] = useState([])
  const [selectedId,  setSelectedId]  = useState('')

  // Load active inventory products once the modal opens, then seed the form
  useEffect(() => {
    if (!open) return
    let active = true
    ;(async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, cost_price')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .order('name')
      if (!active) return
      const list = data || []
      setAllProducts(list)

      const vals = line
        ? { product_name: line.product_name, quantity: Number(line.quantity), unit_price: Number(line.unit_price), tax_rate: Number(line.tax_rate) || 0 }
        : { product_name: '', quantity: 1, unit_price: 0, tax_rate: 0 }
      reset(vals)

      // Pre-select the matching inventory product when editing
      const match = line ? list.find(p => p.name === line.product_name) : null
      setSelectedId(match ? match.id : '')
    })()
    return () => { active = false }
  }, [open, line, reset, tenantId])

  const handleProductChange = (e) => {
    const val = e.target.value
    setSelectedId(val)
    const p = allProducts.find(prod => prod.id === val)
    if (p) {
      setValue('product_name', p.name)
      setValue('unit_price', Number(p.cost_price) || 0)
    } else {
      setValue('product_name', '')
    }
  }

  const onSubmit = async (data) => {
    // Block duplicate products on the same order (ignore the row being edited)
    const dupe = (lines || []).some(l =>
      l.id !== line?.id &&
      (l.product_name || '').trim().toLowerCase() === data.product_name.trim().toLowerCase()
    )
    if (dupe) { toast.error('This item is already on the order.'); return }

    const qty   = Number(data.quantity)
    const price = Number(data.unit_price)
    const tax   = Number(data.tax_rate) || 0
    const total = qty * price + qty * price * tax / 100

    if (isEdit) {
      const { error } = await supabase
        .from('purchase_order_lines')
        .update({ product_name: data.product_name, quantity: qty, unit_price: price, tax_rate: tax, total_price: total })
        .eq('id', line.id)
      if (error) { toast.error(error.message); return }
      toast.success('Line updated.')
    } else {
      const { error } = await supabase
        .from('purchase_order_lines')
        .insert({ tenant_id: tenantId, purchase_order_id: orderId, product_name: data.product_name, quantity: qty, unit_price: price, tax_rate: tax, total_price: total })
      if (error) { toast.error(error.message); return }
      toast.success('Line added.')
    }
    onSaved()
    onClose()
  }

  const handleClose = () => { reset(); setSelectedId(''); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? 'Edit Line Item' : 'Add Line Item'} size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          {/* Product — choose from inventory */}
          <div>
            <Select
              label="Product / Description"
              value={selectedId}
              onChange={handleProductChange}
            >
              <option value="">Select a product…</option>
              {allProducts.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
            {errors.product_name && (
              <p className="text-red-500 dark:text-red-400 text-xs mt-1">{errors.product_name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Quantity"
              type="number"
              step="0.01"
              min="0.01"
              error={errors.quantity?.message}
              {...register('quantity')}
            />
            <Input
              label="Unit Price ($)"
              type="number"
              step="0.01"
              min="0"
              error={errors.unit_price?.message}
              {...register('unit_price')}
            />
            <Input
              label="Tax %"
              type="number"
              step="0.01"
              min="0"
              max="100"
              placeholder="0"
              error={errors.tax_rate?.message}
              {...register('tax_rate')}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              {isEdit ? 'Save Changes' : 'Add Line'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

// ── PurchaseOrderDetail ───────────────────────────────────────────────────────

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
    if (orderRes.error) { toast.error('Order not found.'); setLoading(false); return }
    setOrder(orderRes.data)
    setLines(linesRes.data || [])
    setLoading(false)
  }, [id, tenantId])

  useEffect(() => { loadOrder() }, [loadOrder])

  const syncTotals = async () => {
    const { data: fresh } = await supabase
      .from('purchase_order_lines')
      .select('quantity, unit_price, tax_rate')
      .eq('purchase_order_id', id)
      .eq('tenant_id', tenantId)
    const all      = fresh || []
    const subtotal = all.reduce((a, l) => a + Number(l.quantity) * Number(l.unit_price), 0)
    const taxAmt   = all.reduce((a, l) => a + Number(l.quantity) * Number(l.unit_price) * ((Number(l.tax_rate) || 0) / 100), 0)
    await supabase
      .from('purchase_orders')
      .update({ subtotal, tax_amount: taxAmt, total_amount: subtotal + taxAmt })
      .eq('id', id)
  }

  const handleLineSaved = async () => {
    await syncTotals()
    await loadOrder()
  }

  const handleDeleteLine = async (lineId) => {
    if (!window.confirm('Remove this line item?')) return
    const { error } = await supabase.from('purchase_order_lines').delete().eq('id', lineId)
    if (error) { toast.error(error.message); return }
    toast.success('Line removed.')
    await handleLineSaved()
  }

  const openAddLine = () => { setEditingLine(null); setShowLineModal(true) }
  const openEditLine = (l) => { setEditingLine(l); setShowLineModal(true) }
  const closeLineModal = () => { setShowLineModal(false); setEditingLine(null) }

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
                  onClick={() => updateStatus('pending')}
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
        {/* Order lines */}
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

              {/* Totals */}
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

        {/* Sidebar */}
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

          {order.vendor && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300 mb-3">Vendor</h3>
              <div className="space-y-1.5 text-sm">
                <p className="font-medium text-slate-900 dark:text-slate-200">{order.vendor.name}</p>
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
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300 mb-2">Notes</h3>
              <p className="text-sm text-slate-400">{order.notes}</p>
            </Card>
          )}
        </div>
      </div>

      <LineModal
        open={showLineModal}
        onClose={closeLineModal}
        line={editingLine}
        lines={lines}
        orderId={id}
        tenantId={tenantId}
        onSaved={handleLineSaved}
      />
    </div>
  )
}
