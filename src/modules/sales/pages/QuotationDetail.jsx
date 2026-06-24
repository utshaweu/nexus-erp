import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  PageHeader, Badge, Card, Button, Modal, Input, Select,
  Table, Thead, Th, Tbody, Tr, Td, Spinner,
} from '@shared/components/ui'
import { CheckCircle, XCircle, Printer, ArrowLeft, ShoppingCart, FileText, Send, Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import toast from '@shared/lib/toast'
import PermissionGate from '@shared/components/PermissionGate'
import { QUOTATION_STATUS as STATUS_BADGE } from '@shared/lib/constants'

const lineSchema = z.object({
  product_name: z.string().trim().min(1, 'Product is required'),
  quantity:     z.coerce.number({ invalid_type_error: 'Enter a number' }).positive('Must be > 0'),
  unit_price:   z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0, 'Must be ≥ 0'),
  discount_pct: z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0).max(100).default(0),
  tax_rate:     z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0).max(100).default(0),
})

// Shared line math (percentage discount on the base, then tax on the net)
function lineMath({ quantity, unit_price, discount_pct, tax_rate }) {
  const base = (Number(quantity) || 0) * (Number(unit_price) || 0)
  const net  = base * (1 - (Number(discount_pct) || 0) / 100)
  const tax  = net * ((Number(tax_rate) || 0) / 100)
  return { base, discount: base - net, net, tax, total: net + tax }
}

// ── LineModal ─────────────────────────────────────────────────────────────────

function LineModal({ open, onClose, line, lines = [], quotationId, tenantId, onSaved }) {
  const isEdit = Boolean(line)
  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(lineSchema),
    defaultValues: { product_name: '', quantity: 1, unit_price: 0, discount_pct: 0, tax_rate: 0 },
  })

  const watchQty   = watch('quantity', 1)
  const watchPrice = watch('unit_price', 0)
  const watchDisc  = watch('discount_pct', 0)
  const watchTax   = watch('tax_rate', 0)

  const [allProducts,     setAllProducts]     = useState([])
  const [selectedProduct, setSelectedProduct] = useState('')

  // Load active inventory products once the modal opens, then seed the form
  useEffect(() => {
    if (!open) return
    let active = true
    ;(async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, sale_price')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .order('name')
      if (!active) return
      const prods = data || []
      setAllProducts(prods)

      reset(line
        ? { product_name: line.product_name, quantity: Number(line.quantity), unit_price: Number(line.unit_price), discount_pct: Number(line.discount_pct) || 0, tax_rate: Number(line.tax_rate) || 0 }
        : { product_name: '', quantity: 1, unit_price: 0, discount_pct: 0, tax_rate: 0 })

      const match = line ? prods.find(p => p.name === line.product_name) : null
      setSelectedProduct(match ? match.id : '')
    })()
    return () => { active = false }
  }, [open, line, reset, tenantId])

  const handleProductChange = (e) => {
    const val = e.target.value
    setSelectedProduct(val)
    setValue('discount_pct', 0)
    setValue('tax_rate', 0)
    const p = allProducts.find(prod => prod.id === val)
    if (p) {
      setValue('product_name', p.name)
      setValue('unit_price', Number(p.sale_price) || 0)
    } else {
      setValue('product_name', '')
    }
  }

  const preview = lineMath({ quantity: watchQty, unit_price: watchPrice, discount_pct: watchDisc, tax_rate: watchTax })

  const onSubmit = async (data) => {
    // Block duplicate products on the same quotation (ignore the row being edited)
    const dupe = (lines || []).some(l =>
      l.id !== line?.id &&
      (l.product_name || '').trim().toLowerCase() === data.product_name.trim().toLowerCase()
    )
    if (dupe) { toast.error('This item is already on the quotation.'); return }

    const q = Number(data.quantity)
    const p = Number(data.unit_price)
    const d = Number(data.discount_pct) || 0
    const t = Number(data.tax_rate) || 0
    const { total } = lineMath({ quantity: q, unit_price: p, discount_pct: d, tax_rate: t })

    if (isEdit) {
      const { error } = await supabase
        .from('quotation_lines')
        .update({ product_name: data.product_name, quantity: q, unit_price: p, discount_pct: d, tax_rate: t, total_price: total })
        .eq('id', line.id)
      if (error) { toast.error(error.message); return }
      toast.success('Line updated.')
    } else {
      const { error } = await supabase
        .from('quotation_lines')
        .insert({ tenant_id: tenantId, quotation_id: quotationId, product_name: data.product_name, quantity: q, unit_price: p, discount_pct: d, tax_rate: t, total_price: total })
      if (error) { toast.error(error.message); return }
      toast.success('Line added.')
    }
    onSaved()
    onClose()
  }

  const handleClose = () => { reset(); setSelectedProduct(''); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? 'Edit Line Item' : 'Add Line Item'} size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          {/* Product — choose from inventory */}
          <div>
            <Select label="Product / Description" value={selectedProduct} onChange={handleProductChange}>
              <option value="">Select a product…</option>
              {allProducts.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
            {errors.product_name && (
              <p className="text-red-500 dark:text-red-400 text-xs mt-1">{errors.product_name.message}</p>
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
          <div className="rounded-lg bg-surface-100 dark:bg-surface-800 px-4 py-3 text-sm space-y-1">
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Base ({Number(watchQty) || 0} × ${(Number(watchPrice) || 0).toLocaleString()})</span>
              <span>${preview.base.toLocaleString()}</span>
            </div>
            {preview.discount > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Discount ({Number(watchDisc) || 0}%)</span>
                <span>−${preview.discount.toLocaleString()}</span>
              </div>
            )}
            {preview.tax > 0 && (
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Tax ({Number(watchTax) || 0}%)</span>
                <span>+${preview.tax.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-slate-900 dark:text-slate-100 pt-1 border-t border-surface-200 dark:border-surface-700">
              <span>Line Total</span>
              <span>${preview.total.toFixed(2)}</span>
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

// ── QuotationDetail ─────────────────────────────────────────────────────────────

export default function QuotationDetail() {
  const { id }       = useParams()
  const navigate     = useNavigate()
  const { tenantId } = useTenant()
  const [quote,         setQuote]         = useState(null)
  const [lines,         setLines]         = useState([])
  const [loading,       setLoading]       = useState(true)
  const [converting,    setConverting]    = useState(false)
  const [showLineModal, setShowLineModal] = useState(false)
  const [editingLine,   setEditingLine]   = useState(null)

  const canEditLines = quote && quote.status === 'draft'

  const loadQuote = useCallback(async () => {
    if (!id || !tenantId) return
    setLoading(true)
    const [qRes, linesRes] = await Promise.all([
      supabase
        .from('quotations')
        .select('*, customer:customers(name, email, phone, contact_name)')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .single(),
      supabase
        .from('quotation_lines')
        .select('*')
        .eq('quotation_id', id)
        .eq('tenant_id', tenantId)
        .order('id'),
    ])
    if (qRes.error) { toast.error('Quotation not found.'); setLoading(false); return }
    setQuote(qRes.data)
    setLines(linesRes.data || [])
    setLoading(false)
  }, [id, tenantId])

  useEffect(() => { loadQuote() }, [loadQuote])

  const syncTotals = async () => {
    const { data: fresh } = await supabase
      .from('quotation_lines')
      .select('quantity, unit_price, discount_pct, tax_rate')
      .eq('quotation_id', id)
      .eq('tenant_id', tenantId)
    const all      = fresh || []
    const subtotal = all.reduce((a, l) => a + lineMath(l).net, 0)
    const taxAmt   = all.reduce((a, l) => a + lineMath(l).tax, 0)
    await supabase
      .from('quotations')
      .update({ subtotal, tax_amount: taxAmt, total_amount: subtotal + taxAmt })
      .eq('id', id)
  }

  const handleLineSaved = async () => {
    await syncTotals()
    await loadQuote()
  }

  const handleDeleteLine = async (lineId) => {
    if (!window.confirm('Remove this line item?')) return
    const { error } = await supabase.from('quotation_lines').delete().eq('id', lineId)
    if (error) { toast.error(error.message); return }
    toast.success('Line removed.')
    await handleLineSaved()
  }

  const openAddLine    = () => { setEditingLine(null); setShowLineModal(true) }
  const openEditLine   = (l) => { setEditingLine(l); setShowLineModal(true) }
  const closeLineModal = () => { setShowLineModal(false); setEditingLine(null) }

  const updateStatus = async (status) => {
    const { error } = await supabase.from('quotations').update({ status }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success(`Quotation marked as ${STATUS_BADGE[status]?.label || status}.`)
    setQuote(q => ({ ...q, status }))
  }

  // Convert an accepted quotation → new draft Sales Order, copy line items
  const convertToOrder = async () => {
    if (!window.confirm('Convert this quotation to a sales order?')) return
    setConverting(true)
    try {
      const { data: orderNumber, error: rpcErr } = await supabase.rpc('generate_so_number')
      if (rpcErr) { toast.error('Failed to generate order number.'); return }

      const today = new Date().toISOString().slice(0, 10)
      const { data: so, error: soErr } = await supabase
        .from('sales_orders')
        .insert({
          tenant_id:    tenantId,
          order_number: orderNumber,
          customer_id:  quote.customer_id,
          order_date:   today,
          delivery_date: quote.expiry_date || null,
          status:       'draft',
          notes:        quote.notes || null,
          subtotal:     Number(quote.subtotal) || 0,
          tax_amount:   Number(quote.tax_amount) || 0,
          total_amount: Number(quote.total_amount) || 0,
        })
        .select('id')
        .single()
      if (soErr) { toast.error(soErr.message); return }

      if (lines.length > 0) {
        const soLines = lines.map(l => ({
          tenant_id:      tenantId,
          sales_order_id: so.id,
          product_name:   l.product_name,
          quantity:       Number(l.quantity),
          unit_price:     Number(l.unit_price),
          discount_pct:   Number(l.discount_pct) || 0,
          discount_amount: 0,
          tax_rate:       Number(l.tax_rate) || 0,
          total_price:    Number(l.total_price) || 0,
        }))
        const { error: linesErr } = await supabase.from('sales_order_lines').insert(soLines)
        if (linesErr) { toast.error(linesErr.message); return }
      }

      toast.success(`Converted to ${orderNumber}.`)
      navigate(`/sales/orders/${so.id}`)
    } finally {
      setConverting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="w-6 h-6" />
      </div>
    )
  }

  if (!quote) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 mb-2">Quotation not found.</p>
        <Link to="/sales/quotations" className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 text-sm">
          ← Back to quotations
        </Link>
      </div>
    )
  }

  const s        = STATUS_BADGE[quote.status] || STATUS_BADGE.draft
  const subtotal = lines.reduce((a, l) => a + lineMath(l).net, 0)
  const taxAmt   = lines.reduce((a, l) => a + lineMath(l).tax, 0)
  const total    = subtotal + taxAmt

  return (
    <div className="space-y-6">
      <PageHeader
        title={quote.quotation_number}
        subtitle={`Customer: ${quote.customer?.name || '—'}`}
        breadcrumb="Sales / Quotations"
        actions={
          <div className="flex items-center gap-2 print:hidden">
            <Link to="/sales/quotations">
              <Button variant="secondary" size="sm">
                <ArrowLeft className="w-4 h-4" />Back
              </Button>
            </Link>

            <PermissionGate action="edit" moduleId="sales">
              {quote.status === 'draft' && (
                <Button
                  variant="success"
                  size="sm"
                  disabled={lines.length === 0}
                  title={lines.length === 0 ? 'Add at least one line item first' : undefined}
                  onClick={() => updateStatus('sent')}
                >
                  <Send className="w-4 h-4" />Send to Customer
                </Button>
              )}
            </PermissionGate>

            <PermissionGate action="approve" moduleId="sales">
              {quote.status === 'sent' && (
                <>
                  <Button variant="success" size="sm" onClick={() => updateStatus('accepted')}>
                    <CheckCircle className="w-4 h-4" />Mark Accepted
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => updateStatus('expired')}>
                    <FileText className="w-4 h-4" />Mark Expired
                  </Button>
                </>
              )}
            </PermissionGate>

            {quote.status === 'accepted' && (
              <PermissionGate action="create" moduleId="sales">
                <Button variant="outline" size="sm" loading={converting} onClick={convertToOrder}>
                  <ShoppingCart className="w-4 h-4" />Convert to Sales Order
                </Button>
              </PermissionGate>
            )}

            {['draft', 'sent'].includes(quote.status) && (
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
        {/* Quotation lines */}
        <div className="lg:col-span-2">
          <Card>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300">Line Items</h3>
                {canEditLines && (
                  <PermissionGate action="edit" moduleId="sales">
                    <Button size="xs" onClick={openAddLine} className="print:hidden">
                      <Plus className="w-3.5 h-3.5" />Add Line
                    </Button>
                  </PermissionGate>
                )}
              </div>

              {lines.length === 0 ? (
                <div className="py-8 text-center">
                  <ShoppingCart className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">No line items on this quotation.</p>
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
                      const m = lineMath(item)
                      return (
                        <Tr key={item.id}>
                          <Td>
                            <span className="font-medium text-slate-900 dark:text-slate-200">{item.product_name}</span>
                          </Td>
                          <Td>{Number(item.quantity)}</Td>
                          <Td>${Number(item.unit_price).toLocaleString()}</Td>
                          <Td>
                            {Number(item.discount_pct) > 0
                              ? <span className="text-emerald-600 dark:text-emerald-400">{Number(item.discount_pct)}%</span>
                              : '—'}
                          </Td>
                          <Td>{Number(item.tax_rate) || 0}%</Td>
                          <Td className="font-semibold">${m.total.toFixed(2)}</Td>
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
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300 mb-4">Quotation Info</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <Badge color={s.color}>{s.label}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date</span>
                <span className="text-slate-700 dark:text-slate-300">{quote.quotation_date}</span>
              </div>
              {quote.expiry_date && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Expiry</span>
                  <span className="text-slate-700 dark:text-slate-300">{quote.expiry_date}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Lines</span>
                <span className="text-slate-700 dark:text-slate-300">{lines.length}</span>
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t border-surface-200 dark:border-surface-800">
                <span className="text-slate-500 dark:text-slate-400">Total</span>
                <span className="text-slate-900 dark:text-slate-100">${total.toFixed(2)}</span>
              </div>
            </div>
          </Card>

          {quote.customer && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300 mb-3">Customer</h3>
              <div className="space-y-1.5 text-sm">
                <p className="font-medium text-slate-900 dark:text-slate-200">{quote.customer.name}</p>
                {quote.customer.contact_name && (
                  <p className="text-slate-600 dark:text-slate-400">{quote.customer.contact_name}</p>
                )}
                {quote.customer.email && (
                  <p className="text-slate-500">{quote.customer.email}</p>
                )}
                {quote.customer.phone && (
                  <p className="text-slate-500">{quote.customer.phone}</p>
                )}
              </div>
            </Card>
          )}

          {quote.notes && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300 mb-2">Notes</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{quote.notes}</p>
            </Card>
          )}
        </div>
      </div>

      <LineModal
        open={showLineModal}
        onClose={closeLineModal}
        line={editingLine}
        lines={lines}
        quotationId={id}
        tenantId={tenantId}
        onSaved={handleLineSaved}
      />
    </div>
  )
}
