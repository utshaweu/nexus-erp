import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  PageHeader, Badge, Card, Button, Modal, Input,
  Table, Thead, Th, Tbody, Tr, Td, Spinner,
} from '@shared/components/ui'
import { CheckCircle, XCircle, Printer, ArrowLeft, FileText, ShoppingCart, Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import toast from '@shared/lib/toast'
import PermissionGate from '@shared/components/PermissionGate'
import { SALES_ORDER_STATUS as STATUS_BADGE } from '@shared/lib/constants'

const lineSchema = z.object({
  product_name: z.string().trim().min(1, 'Product name is required'),
  quantity:     z.coerce.number({ invalid_type_error: 'Enter a number' }).positive('Must be > 0'),
  unit_price:   z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0, 'Must be ≥ 0'),
  discount_pct: z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0).max(100).default(0),
  tax_rate:     z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0).max(100).default(0),
})

// ── LineModal ─────────────────────────────────────────────────────────────────

function LineModal({ open, onClose, line, orderId, tenantId, onSaved }) {
  const isEdit = Boolean(line)
  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(lineSchema),
    defaultValues: { product_name: '', quantity: 1, unit_price: 0, discount_pct: 0, tax_rate: 0 },
  })

  const watchQty      = watch('quantity', 1)
  const watchPrice    = watch('unit_price', 0)
  const watchDiscount = watch('discount_pct', 0)
  const watchTax      = watch('tax_rate', 0)

  // Product search state
  const [products,   setProducts]   = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showDrop,   setShowDrop]   = useState(false)

  useEffect(() => {
    if (!open) return
    const vals = line
      ? { product_name: line.product_name, quantity: Number(line.quantity), unit_price: Number(line.unit_price), discount_pct: Number(line.discount_pct) || 0, tax_rate: Number(line.tax_rate) || 0 }
      : { product_name: '', quantity: 1, unit_price: 0, discount_pct: 0, tax_rate: 0 }
    reset(vals)
    setSearchTerm(line?.product_name ?? '')
    setProducts([])
    setShowDrop(false)
  }, [open, line, reset])

  // Debounced product search from inventory
  useEffect(() => {
    if (!searchTerm || searchTerm.length < 2) { setProducts([]); setShowDrop(false); return }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, sale_price, cost_price')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .ilike('name', `%${searchTerm}%`)
        .limit(6)
      if (data?.length) { setProducts(data); setShowDrop(true) }
      else { setProducts([]); setShowDrop(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [searchTerm, tenantId])

  const pickProduct = (p) => {
    setValue('product_name', p.name)
    setValue('unit_price', Number(p.sale_price) || 0)
    setSearchTerm(p.name)
    setProducts([])
    setShowDrop(false)
  }

  // Live line total preview
  const qty        = Number(watchQty) || 0
  const price      = Number(watchPrice) || 0
  const disc       = (Number(watchDiscount) || 0) / 100
  const tax        = (Number(watchTax) || 0) / 100
  const lineBase   = qty * price
  const discounted = lineBase * (1 - disc)
  const lineTotal  = discounted * (1 + tax)

  const onSubmit = async (data) => {
    const q  = Number(data.quantity)
    const p  = Number(data.unit_price)
    const d  = (Number(data.discount_pct) || 0) / 100
    const t  = (Number(data.tax_rate)     || 0) / 100
    const base  = q * p
    const after = base * (1 - d)
    const total = after * (1 + t)

    if (isEdit) {
      const { error } = await supabase
        .from('sales_order_lines')
        .update({ product_name: data.product_name, quantity: q, unit_price: p, discount_pct: Number(data.discount_pct) || 0, tax_rate: Number(data.tax_rate) || 0, total_price: total })
        .eq('id', line.id)
      if (error) { toast.error(error.message); return }
      toast.success('Line updated.')
    } else {
      const { error } = await supabase
        .from('sales_order_lines')
        .insert({ tenant_id: tenantId, sales_order_id: orderId, product_name: data.product_name, quantity: q, unit_price: p, discount_pct: Number(data.discount_pct) || 0, tax_rate: Number(data.tax_rate) || 0, total_price: total })
      if (error) { toast.error(error.message); return }
      toast.success('Line added.')
    }
    onSaved()
    onClose()
  }

  const handleClose = () => { reset(); setSearchTerm(''); setProducts([]); setShowDrop(false); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? 'Edit Line Item' : 'Add Line Item'} size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          {/* Product name with inventory search */}
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1.5">
              Product / Description
            </label>
            <div className="relative">
              <input
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value)
                  setValue('product_name', e.target.value)
                }}
                onBlur={() => setTimeout(() => setShowDrop(false), 150)}
                placeholder="Type to search inventory or enter manually…"
                className="w-full px-3 py-2 rounded-lg text-sm
                           text-slate-900 dark:text-slate-200
                           placeholder:text-slate-400 dark:placeholder:text-slate-600
                           bg-white dark:bg-surface-900
                           border border-surface-200 dark:border-surface-700
                           hover:border-surface-300 dark:hover:border-surface-600
                           focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500
                           transition-colors"
              />
              {showDrop && products.length > 0 && (
                <div className="absolute z-50 top-full mt-1 w-full bg-surface-900 border border-surface-700 rounded-lg shadow-xl overflow-hidden">
                  {products.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={() => pickProduct(p)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-surface-800 flex items-center justify-between"
                    >
                      <span className="text-slate-200">{p.name}</span>
                      <span className="text-slate-500 text-xs">Sale: ${Number(p.sale_price || 0).toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {errors.product_name && (
              <p className="text-red-400 text-xs mt-1">{errors.product_name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
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
              label="Discount %"
              type="number"
              step="0.01"
              min="0"
              max="100"
              placeholder="0"
              error={errors.discount_pct?.message}
              {...register('discount_pct')}
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

          {/* Live preview */}
          <div className="rounded-lg bg-surface-800 px-4 py-3 text-sm space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>Base ({qty} × ${price.toLocaleString()})</span>
              <span>${lineBase.toLocaleString()}</span>
            </div>
            {disc > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Discount ({Number(watchDiscount)}%)</span>
                <span>−${(lineBase * disc).toLocaleString()}</span>
              </div>
            )}
            {tax > 0 && (
              <div className="flex justify-between text-slate-400">
                <span>Tax ({Number(watchTax)}%)</span>
                <span>+${(discounted * tax).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-slate-100 pt-1 border-t border-surface-700">
              <span>Line Total</span>
              <span>${lineTotal.toFixed(2)}</span>
            </div>
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

// ── SalesOrderDetail ──────────────────────────────────────────────────────────

export default function SalesOrderDetail() {
  const { id }       = useParams()
  const { tenantId } = useTenant()
  const [order,         setOrder]         = useState(null)
  const [lines,         setLines]         = useState([])
  const [loading,       setLoading]       = useState(true)
  const [showLineModal, setShowLineModal] = useState(false)
  const [editingLine,   setEditingLine]   = useState(null)

  const canEditLines = order && ['draft'].includes(order.status)

  const loadOrder = useCallback(async () => {
    if (!id || !tenantId) return
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
    if (orderRes.error) { toast.error('Order not found.'); setLoading(false); return }
    setOrder(orderRes.data)
    setLines(linesRes.data || [])
    setLoading(false)
  }, [id, tenantId])

  useEffect(() => { loadOrder() }, [loadOrder])

  const syncTotals = async () => {
    const { data: fresh } = await supabase
      .from('sales_order_lines')
      .select('quantity, unit_price, discount_pct, tax_rate')
      .eq('sales_order_id', id)
      .eq('tenant_id', tenantId)
    const all      = fresh || []
    const subtotal = all.reduce((a, l) => {
      const base = Number(l.quantity) * Number(l.unit_price)
      const disc = (Number(l.discount_pct) || 0) / 100
      return a + base * (1 - disc)
    }, 0)
    const taxAmt = all.reduce((a, l) => {
      const base = Number(l.quantity) * Number(l.unit_price)
      const disc = (Number(l.discount_pct) || 0) / 100
      const tax  = (Number(l.tax_rate) || 0) / 100
      return a + base * (1 - disc) * tax
    }, 0)
    await supabase
      .from('sales_orders')
      .update({ subtotal, tax_amount: taxAmt, total_amount: subtotal + taxAmt })
      .eq('id', id)
  }

  const handleLineSaved = async () => {
    await syncTotals()
    await loadOrder()
  }

  const handleDeleteLine = async (lineId) => {
    if (!window.confirm('Remove this line item?')) return
    const { error } = await supabase.from('sales_order_lines').delete().eq('id', lineId)
    if (error) { toast.error(error.message); return }
    toast.success('Line removed.')
    await handleLineSaved()
  }

  const openAddLine  = ()  => { setEditingLine(null); setShowLineModal(true) }
  const openEditLine = (l) => { setEditingLine(l);    setShowLineModal(true) }
  const closeModal   = ()  => { setShowLineModal(false); setEditingLine(null) }

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
  const subtotal = lines.reduce((a, l) => {
    const base = Number(l.quantity) * Number(l.unit_price)
    const disc = (Number(l.discount_pct) || 0) / 100
    return a + base * (1 - disc)
  }, 0)
  const taxAmt = lines.reduce((a, l) => {
    const base = Number(l.quantity) * Number(l.unit_price)
    const disc = (Number(l.discount_pct) || 0) / 100
    const tax  = (Number(l.tax_rate) || 0) / 100
    return a + base * (1 - disc) * tax
  }, 0)
  const totalDiscount = lines.reduce((a, l) => {
    const base = Number(l.quantity) * Number(l.unit_price)
    const disc = (Number(l.discount_pct) || 0) / 100
    return a + base * disc
  }, 0)
  const total = subtotal + taxAmt

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
        {/* Order lines */}
        <div className="lg:col-span-2">
          <Card>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-300">Order Lines</h3>
                {canEditLines && (
                  <PermissionGate action="edit" moduleId="sales">
                    <Button size="xs" onClick={openAddLine}>
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
                    <Th>Disc %</Th>
                    <Th>Tax %</Th>
                    <Th>Line Total</Th>
                    {canEditLines && <Th></Th>}
                  </Thead>
                  <Tbody>
                    {lines.map(item => {
                      const base    = Number(item.quantity) * Number(item.unit_price)
                      const disc    = (Number(item.discount_pct) || 0) / 100
                      const tax     = (Number(item.tax_rate) || 0) / 100
                      const lineTotal = base * (1 - disc) * (1 + tax)
                      return (
                        <Tr key={item.id}>
                          <Td>
                            <span className="font-medium text-slate-200">{item.product_name}</span>
                          </Td>
                          <Td>{Number(item.quantity)}</Td>
                          <Td>${Number(item.unit_price).toLocaleString()}</Td>
                          <Td>
                            {Number(item.discount_pct) > 0 ? (
                              <span className="text-emerald-400">{Number(item.discount_pct)}%</span>
                            ) : '—'}
                          </Td>
                          <Td>{Number(item.tax_rate) || 0}%</Td>
                          <Td className="font-semibold">${lineTotal.toFixed(2)}</Td>
                          {canEditLines && (
                            <Td>
                              <div className="flex gap-1">
                                <PermissionGate action="edit" moduleId="sales">
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
              <div className="mt-4 pt-4 border-t border-surface-800 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal (before discount)</span>
                  <span>${lines.reduce((a, l) => a + Number(l.quantity) * Number(l.unit_price), 0).toLocaleString()}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Discount</span>
                    <span>−${totalDiscount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-400">
                  <span>After Discount</span>
                  <span>${subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Tax</span>
                  <span>${taxAmt.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-100 text-base pt-2 border-t border-surface-800 mt-2">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
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
              {order.delivery_date && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Delivery</span>
                  <span className="text-slate-300">{order.delivery_date}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Lines</span>
                <span className="text-slate-300">{lines.length}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Discount</span>
                  <span>−${totalDiscount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold pt-2 border-t border-surface-800">
                <span className="text-slate-400">Total</span>
                <span className="text-slate-100">${total.toFixed(2)}</span>
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

      <LineModal
        open={showLineModal}
        onClose={closeModal}
        line={editingLine}
        orderId={id}
        tenantId={tenantId}
        onSaved={handleLineSaved}
      />
    </div>
  )
}
