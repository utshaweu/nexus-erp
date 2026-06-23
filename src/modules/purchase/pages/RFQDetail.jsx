import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  PageHeader, Badge, Card, Button, Modal, Input, Select,
  Table, Thead, Th, Tbody, Tr, Td, Spinner,
} from '@shared/components/ui'
import { CheckCircle, XCircle, Printer, ArrowLeft, Package, Plus, Pencil, Trash2, Send, ShoppingCart } from 'lucide-react'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import toast from '@shared/lib/toast'
import PermissionGate from '@shared/components/PermissionGate'
import { RFQ_STATUS as STATUS_BADGE } from '@shared/lib/constants'

const lineSchema = z.object({
  product_name: z.string().trim().min(1, 'Product is required'),
  quantity:     z.coerce.number({ invalid_type_error: 'Enter a number' }).positive('Must be > 0'),
})

// ── LineModal ─────────────────────────────────────────────────────────────────

function LineModal({ open, onClose, line, lines = [], rfqId, tenantId, onSaved }) {
  const isEdit = Boolean(line)
  const {
    register, handleSubmit, reset, setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(lineSchema),
    defaultValues: { product_name: '', quantity: 1 },
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
        .select('id, name')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .order('name')
      if (!active) return
      const list = data || []
      setAllProducts(list)

      reset(line
        ? { product_name: line.product_name, quantity: Number(line.quantity) }
        : { product_name: '', quantity: 1 })

      const match = line ? list.find(p => p.name === line.product_name) : null
      setSelectedId(match ? match.id : '')
    })()
    return () => { active = false }
  }, [open, line, reset, tenantId])

  const handleProductChange = (e) => {
    const val = e.target.value
    setSelectedId(val)
    const p = allProducts.find(prod => prod.id === val)
    setValue('product_name', p ? p.name : '')
  }

  const onSubmit = async (data) => {
    // Block duplicate products on the same RFQ (ignore the row being edited)
    const dupe = (lines || []).some(l =>
      l.id !== line?.id &&
      (l.product_name || '').trim().toLowerCase() === data.product_name.trim().toLowerCase()
    )
    if (dupe) { toast.error('This item is already on the RFQ.'); return }

    const qty = Number(data.quantity)

    if (isEdit) {
      const { error } = await supabase
        .from('rfq_lines')
        .update({ product_name: data.product_name, quantity: qty })
        .eq('id', line.id)
      if (error) { toast.error(error.message); return }
      toast.success('Line updated.')
    } else {
      const { error } = await supabase
        .from('rfq_lines')
        .insert({ tenant_id: tenantId, rfq_id: rfqId, product_name: data.product_name, quantity: qty })
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
              label="Product"
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

          <Input
            label="Quantity"
            type="number"
            step="0.01"
            min="0.01"
            error={errors.quantity?.message}
            {...register('quantity')}
          />

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

// ── RFQDetail ───────────────────────────────────────────────────────────────

export default function RFQDetail() {
  const { id }       = useParams()
  const navigate     = useNavigate()
  const { tenantId } = useTenant()
  const [rfq,           setRfq]           = useState(null)
  const [lines,         setLines]         = useState([])
  const [loading,       setLoading]       = useState(true)
  const [converting,    setConverting]    = useState(false)
  const [showLineModal, setShowLineModal] = useState(false)
  const [editingLine,   setEditingLine]   = useState(null)

  const canEditLines = rfq && rfq.status === 'draft'

  const loadRfq = useCallback(async () => {
    if (!id || !tenantId) return
    setLoading(true)
    const [rfqRes, linesRes] = await Promise.all([
      supabase
        .from('rfqs')
        .select('*, vendor:vendors(name, email, phone, contact_name)')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .single(),
      supabase
        .from('rfq_lines')
        .select('*')
        .eq('rfq_id', id)
        .eq('tenant_id', tenantId)
        .order('created_at'),
    ])
    if (rfqRes.error) { toast.error('RFQ not found.'); setLoading(false); return }
    setRfq(rfqRes.data)
    setLines(linesRes.data || [])
    setLoading(false)
  }, [id, tenantId])

  useEffect(() => { loadRfq() }, [loadRfq])

  const handleDeleteLine = async (lineId) => {
    if (!window.confirm('Remove this line item?')) return
    const { error } = await supabase.from('rfq_lines').delete().eq('id', lineId)
    if (error) { toast.error(error.message); return }
    toast.success('Line removed.')
    loadRfq()
  }

  const openAddLine    = () => { setEditingLine(null); setShowLineModal(true) }
  const openEditLine   = (l) => { setEditingLine(l); setShowLineModal(true) }
  const closeLineModal = () => { setShowLineModal(false); setEditingLine(null) }

  const updateStatus = async (status) => {
    const { error } = await supabase
      .from('rfqs')
      .update({ status })
      .eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success(`RFQ marked as ${STATUS_BADGE[status]?.label || status}.`)
    setRfq(r => ({ ...r, status }))
  }

  // Convert RFQ → new draft Purchase Order, copy line items, mark RFQ converted
  const convertToPO = async () => {
    if (!window.confirm('Convert this RFQ to a purchase order?')) return
    setConverting(true)
    try {
      const { data: orderNumber, error: rpcErr } = await supabase.rpc('generate_po_number')
      if (rpcErr) { toast.error('Failed to generate PO number.'); return }

      const today = new Date().toISOString().slice(0, 10)
      const { data: po, error: poErr } = await supabase
        .from('purchase_orders')
        .insert({
          tenant_id:    tenantId,
          order_number: orderNumber,
          vendor_id:    rfq.vendor_id,
          reference:    rfq.rfq_number,
          order_date:   today,
          status:       'draft',
          notes:        rfq.notes || null,
        })
        .select('id')
        .single()
      if (poErr) { toast.error(poErr.message); return }

      if (lines.length > 0) {
        // Pull cost prices from inventory so PO lines carry a unit price
        const { data: prods } = await supabase
          .from('products')
          .select('name, cost_price')
          .eq('tenant_id', tenantId)
          .in('name', lines.map(l => l.product_name))
        const priceByName = new Map((prods || []).map(p => [p.name, Number(p.cost_price) || 0]))

        const poLines = lines.map(l => {
          const qty   = Number(l.quantity)
          const price = priceByName.get(l.product_name) || 0
          return {
            tenant_id:         tenantId,
            purchase_order_id: po.id,
            product_name:      l.product_name,
            quantity:          qty,
            unit_price:        price,
            tax_rate:          0,
            total_price:       qty * price,
          }
        })
        const { error: linesErr } = await supabase.from('purchase_order_lines').insert(poLines)
        if (linesErr) { toast.error(linesErr.message); return }

        // Sync PO header totals so the list/detail reflect the copied lines
        const subtotal = poLines.reduce((a, l) => a + l.total_price, 0)
        await supabase
          .from('purchase_orders')
          .update({ subtotal, tax_amount: 0, total_amount: subtotal })
          .eq('id', po.id)
      }

      await supabase.from('rfqs').update({ status: 'converted' }).eq('id', id)
      toast.success(`Converted to ${orderNumber}.`)
      navigate(`/purchase/orders/${po.id}`)
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

  if (!rfq) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 mb-2">RFQ not found.</p>
        <Link to="/purchase/rfq" className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 text-sm">
          ← Back to RFQs
        </Link>
      </div>
    )
  }

  const s = STATUS_BADGE[rfq.status] || STATUS_BADGE.draft

  return (
    <div className="space-y-6">
      <PageHeader
        title={rfq.rfq_number}
        subtitle={`Vendor: ${rfq.vendor?.name || '—'}`}
        breadcrumb="Purchase / RFQ"
        actions={
          <div className="flex items-center gap-2 print:hidden">
            <Link to="/purchase/rfq">
              <Button variant="secondary" size="sm">
                <ArrowLeft className="w-4 h-4" />Back
              </Button>
            </Link>

            <PermissionGate action="edit" moduleId="purchase">
              {rfq.status === 'draft' && (
                <Button
                  variant="success"
                  size="sm"
                  disabled={lines.length === 0}
                  title={lines.length === 0 ? 'Add at least one line item first' : undefined}
                  onClick={() => updateStatus('sent')}
                >
                  <Send className="w-4 h-4" />Send to Vendor
                </Button>
              )}

              {rfq.status === 'sent' && (
                <>
                  <Button variant="success" size="sm" onClick={() => updateStatus('received')}>
                    <CheckCircle className="w-4 h-4" />Mark Received
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => updateStatus('expired')}>
                    <XCircle className="w-4 h-4" />Mark Expired
                  </Button>
                </>
              )}
            </PermissionGate>

            {rfq.status === 'received' && (
              <PermissionGate action="create" moduleId="purchase">
                <Button variant="outline" size="sm" loading={converting} onClick={convertToPO}>
                  <ShoppingCart className="w-4 h-4" />Convert to PO
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
        {/* RFQ lines */}
        <div className="lg:col-span-2">
          <Card>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300">Requested Items</h3>
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
                  <p className="text-slate-500 text-sm">No items on this RFQ.</p>
                  {canEditLines && (
                    <p className="text-slate-600 text-xs mt-1">Click "Add Line" to add products.</p>
                  )}
                </div>
              ) : (
                <Table>
                  <Thead>
                    <Th>Product</Th>
                    <Th>Quantity</Th>
                    {canEditLines && <Th></Th>}
                  </Thead>
                  <Tbody>
                    {lines.map(item => (
                      <Tr key={item.id}>
                        <Td>
                          <span className="font-medium text-slate-900 dark:text-slate-200">{item.product_name}</span>
                        </Td>
                        <Td>{Number(item.quantity)}</Td>
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
                    ))}
                  </Tbody>
                </Table>
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300 mb-4">RFQ Info</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <Badge color={s.color}>{s.label}</Badge>
              </div>
              {rfq.deadline && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Deadline</span>
                  <span className="text-slate-700 dark:text-slate-300">{rfq.deadline}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Items</span>
                <span className="text-slate-700 dark:text-slate-300">{lines.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Quoted Amount</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {rfq.quoted_amount > 0 ? `$${Number(rfq.quoted_amount).toLocaleString()}` : '—'}
                </span>
              </div>
              {rfq.created_at && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Created</span>
                  <span className="text-slate-700 dark:text-slate-300">{new Date(rfq.created_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </Card>

          {rfq.vendor && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300 mb-3">Vendor</h3>
              <div className="space-y-1.5 text-sm">
                <p className="font-medium text-slate-900 dark:text-slate-200">{rfq.vendor.name}</p>
                {rfq.vendor.contact_name && (
                  <p className="text-slate-700 dark:text-slate-400">{rfq.vendor.contact_name}</p>
                )}
                {rfq.vendor.email && (
                  <p className="text-slate-500">{rfq.vendor.email}</p>
                )}
                {rfq.vendor.phone && (
                  <p className="text-slate-500">{rfq.vendor.phone}</p>
                )}
              </div>
            </Card>
          )}

          {rfq.notes && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300 mb-2">Notes</h3>
              <p className="text-sm text-slate-700 dark:text-slate-400 whitespace-pre-wrap">{rfq.notes}</p>
            </Card>
          )}
        </div>
      </div>

      <LineModal
        open={showLineModal}
        onClose={closeLineModal}
        line={editingLine}
        lines={lines}
        rfqId={id}
        tenantId={tenantId}
        onSaved={loadRfq}
      />
    </div>
  )
}
