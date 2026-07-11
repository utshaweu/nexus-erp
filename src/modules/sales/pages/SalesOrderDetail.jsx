import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  PageHeader, Badge, Card, Button, Modal, Input, Select,
  Table, Thead, Th, Tbody, Tr, Td, Spinner,
} from '@shared/components/ui'
import { CheckCircle, XCircle, Printer, ArrowLeft, FileText, ShoppingCart, Plus, Pencil, Trash2, Send } from 'lucide-react'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import toast from '@shared/lib/toast'
import PermissionGate from '@shared/components/PermissionGate'
import { SALES_ORDER_STATUS as STATUS_BADGE } from '@shared/lib/constants'
import { findActiveWorkflow, submitForApproval } from '@shared/lib/approvalWorkflow'

const lineSchema = z.object({
  product_name:   z.string().trim().min(1, 'Product name is required'),
  quantity:       z.coerce.number({ invalid_type_error: 'Enter a number' }).positive('Must be > 0'),
  unit_price:     z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0, 'Must be ≥ 0'),
  discount_type:  z.enum(['percentage', 'fixed']).default('percentage'),
  discount_value: z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0).default(0),
  tax_rate:       z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0).max(100).default(0),
}).refine(d => !(d.discount_type === 'percentage' && d.discount_value > 100), {
  message: 'Percentage cannot exceed 100%', path: ['discount_value'],
})

// Shared line math — a line's discount is either a % of base OR a fixed $ amount (the other is 0)
function lineMath({ quantity, unit_price, discount_pct, discount_amount, tax_rate }) {
  const base     = (Number(quantity) || 0) * (Number(unit_price) || 0)
  const pct      = (Number(discount_pct) || 0) / 100
  const fixed    = Number(discount_amount) || 0
  const discount = Math.min(base, base * pct + fixed)
  const net      = base - discount
  const tax      = net * ((Number(tax_rate) || 0) / 100)
  return { base, discount, net, tax, total: net + tax }
}

// Is an offer valid right now? (active window + under usage limit)
function offerValidNow(o) {
  const today = new Date().toISOString().split('T')[0]
  return (!o.start_date || o.start_date <= today) &&
         (!o.end_date   || o.end_date   >= today) &&
         (!o.usage_limit || Number(o.usage_count) < Number(o.usage_limit))
}

// Does an offer's "applies_to" scope cover this product / order customer?
function offerApplies(o, product, customerName) {
  switch (o.applies_to) {
    case 'product':  return !!product && o.applies_to_ref === product.name
    case 'category': return !!product && o.applies_to_ref === product.category
    case 'customer': return !!customerName && o.applies_to_ref === customerName
    default:         return true // 'all'
  }
}

// ── LineModal ─────────────────────────────────────────────────────────────────

function LineModal({ open, onClose, line, lines = [], orderId, tenantId, customerName, onSaved }) {
  const isEdit = Boolean(line)
  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(lineSchema),
    defaultValues: { product_name: '', quantity: 1, unit_price: 0, discount_type: 'percentage', discount_value: 0, tax_rate: 0 },
  })

  const watchQty   = watch('quantity', 1)
  const watchPrice = watch('unit_price', 0)
  const watchType  = watch('discount_type', 'percentage')
  const watchValue = watch('discount_value', 0)
  const watchTax   = watch('tax_rate', 0)
  const isFixed    = watchType === 'fixed'

  // Inventory products + applicable offers for the dropdowns
  const [allProducts,     setAllProducts]     = useState([])
  const [selectedProduct, setSelectedProduct] = useState('')
  const [offers,          setOffers]          = useState([])
  const [selectedOffer,   setSelectedOffer]   = useState('')

  // Load active products + currently-valid offers when the modal opens, then seed the form
  useEffect(() => {
    if (!open) return
    let active = true
    ;(async () => {
      const [prodRes, offerRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, sale_price, category')
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
          .order('name'),
        supabase
          .from('offers')
          .select('id, name, offer_type, discount_value, minimum_amount, usage_count, usage_limit, start_date, end_date, applies_to, applies_to_ref')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .in('offer_type', ['percentage', 'fixed_amount']),
      ])
      if (!active) return

      const prods = prodRes.data || []
      setAllProducts(prods)

      // Keep only offers valid right now (date window + under usage limit)
      const usable = (offerRes.data || []).filter(offerValidNow)
      setOffers(usable)

      reset(line
        ? {
            product_name:   line.product_name,
            quantity:       Number(line.quantity),
            unit_price:     Number(line.unit_price),
            discount_type:  Number(line.discount_amount) > 0 ? 'fixed' : 'percentage',
            discount_value: Number(line.discount_amount) > 0 ? Number(line.discount_amount) : (Number(line.discount_pct) || 0),
            tax_rate:       Number(line.tax_rate) || 0,
          }
        : { product_name: '', quantity: 1, unit_price: 0, discount_type: 'percentage', discount_value: 0, tax_rate: 0 })

      const match = line ? prods.find(p => p.name === line.product_name) : null
      setSelectedProduct(match ? match.id : '')
      setSelectedOffer('')
    })()
    return () => { active = false }
  }, [open, line, reset, tenantId])

  const handleProductChange = (e) => {
    const val = e.target.value
    setSelectedProduct(val)
    setSelectedOffer('')        // offer applicability depends on the product
    // Reset discount + tax whenever the product changes
    setValue('discount_type', 'percentage')
    setValue('discount_value', 0)
    setValue('tax_rate', 0)
    const p = allProducts.find(prod => prod.id === val)
    if (p) {
      setValue('product_name', p.name)
      setValue('unit_price', Number(p.sale_price) || 0)
    } else {
      setValue('product_name', '')
    }
  }

  // Offers whose scope (all/product/category/customer) covers the chosen product + order customer
  const selectedProductObj = allProducts.find(p => p.id === selectedProduct) || null
  const applicableOffers   = offers.filter(o => offerApplies(o, selectedProductObj, customerName))

  const handleOfferChange = (e) => {
    const val = e.target.value
    const offer = offers.find(o => o.id === val)
    if (!offer) { setSelectedOffer(''); return }

    const base = (Number(watch('quantity')) || 0) * (Number(watch('unit_price')) || 0)
    if (Number(offer.minimum_amount) > 0 && base < Number(offer.minimum_amount)) {
      toast.error(`Line total must be at least $${Number(offer.minimum_amount).toLocaleString()} for this offer.`)
      setSelectedOffer('')
      return
    }

    setSelectedOffer(val)
    setValue('discount_type', offer.offer_type === 'fixed_amount' ? 'fixed' : 'percentage')
    setValue('discount_value', Number(offer.discount_value) || 0)
  }

  // Live line total preview
  const preview = lineMath({
    quantity:        watchQty,
    unit_price:      watchPrice,
    discount_pct:    isFixed ? 0 : watchValue,
    discount_amount: isFixed ? watchValue : 0,
    tax_rate:        watchTax,
  })
  const qty   = Number(watchQty) || 0
  const price = Number(watchPrice) || 0

  const onSubmit = async (data) => {
    // Block duplicate products on the same order (ignore the edited row and auto-added gift lines)
    const dupe = (lines || []).some(l =>
      !l.is_gift &&
      l.id !== line?.id &&
      (l.product_name || '').trim().toLowerCase() === data.product_name.trim().toLowerCase()
    )
    if (dupe) { toast.error('This item is already on the order.'); return }

    const q = Number(data.quantity)
    const p = Number(data.unit_price)
    const fixedSel        = data.discount_type === 'fixed'
    const discount_pct    = fixedSel ? 0 : (Number(data.discount_value) || 0)
    const discount_amount = fixedSel ? (Number(data.discount_value) || 0) : 0
    const tax             = Number(data.tax_rate) || 0
    const { total } = lineMath({ quantity: q, unit_price: p, discount_pct, discount_amount, tax_rate: tax })

    if (isEdit) {
      const { error } = await supabase
        .from('sales_order_lines')
        .update({ product_name: data.product_name, quantity: q, unit_price: p, discount_pct, discount_amount, tax_rate: tax, total_price: total })
        .eq('id', line.id)
      if (error) { toast.error(error.message); return }
      toast.success('Line updated.')
    } else {
      const { error } = await supabase
        .from('sales_order_lines')
        .insert({ tenant_id: tenantId, sales_order_id: orderId, product_name: data.product_name, quantity: q, unit_price: p, discount_pct, discount_amount, tax_rate: tax, total_price: total })
      if (error) { toast.error(error.message); return }

      // Redeem the applied offer (only on new lines, to avoid double-counting on edits)
      if (selectedOffer) {
        const offer = offers.find(o => o.id === selectedOffer)
        if (offer) {
          await supabase
            .from('offers')
            .update({ usage_count: (Number(offer.usage_count) || 0) + 1 })
            .eq('id', selectedOffer)
        }
      }
      toast.success('Line added.')
    }
    onSaved()
    onClose()
  }

  const handleClose = () => { reset(); setSelectedProduct(''); setSelectedOffer(''); onClose() }

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

          {/* Apply an active offer (scoped to this product / customer) → auto-fills the discount */}
          {applicableOffers.length > 0 && (
            <Select label="Apply Offer (optional)" value={selectedOffer} onChange={handleOfferChange}>
              <option value="">— No offer —</option>
              {applicableOffers.map(o => (
                <option key={o.id} value={o.id}>
                  {o.name} — {o.offer_type === 'percentage'
                    ? `${Number(o.discount_value)}% off`
                    : `$${Number(o.discount_value).toLocaleString()} off`}
                </option>
              ))}
            </Select>
          )}

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
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Select label="Discount Type" {...register('discount_type')}>
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed Amount ($)</option>
            </Select>
            <Input
              label={isFixed ? 'Discount ($)' : 'Discount %'}
              type="number"
              step="0.01"
              min="0"
              max={isFixed ? undefined : 100}
              placeholder="0"
              error={errors.discount_value?.message}
              {...register('discount_value')}
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
              <span>Base ({qty} × ${price.toLocaleString()})</span>
              <span>${preview.base.toLocaleString()}</span>
            </div>
            {preview.discount > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Discount ({isFixed ? `$${Number(watchValue) || 0}` : `${Number(watchValue) || 0}%`})</span>
                <span>−${preview.discount.toLocaleString()}</span>
              </div>
            )}
            {preview.tax > 0 && (
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Tax ({Number(watchTax)}%)</span>
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

// ── SalesOrderDetail ──────────────────────────────────────────────────────────

export default function SalesOrderDetail() {
  const { id }       = useParams()
  const { tenantId } = useTenant()
  const [order,         setOrder]         = useState(null)
  const [lines,         setLines]         = useState([])
  const [loading,       setLoading]       = useState(true)
  const [showLineModal, setShowLineModal] = useState(false)
  const [editingLine,   setEditingLine]   = useState(null)
  const [couponInput,   setCouponInput]   = useState('')
  const [activeWorkflow, setActiveWorkflow] = useState(null)
  const [pendingRequest, setPendingRequest] = useState(null)

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

  const loadApprovalState = useCallback(async () => {
    if (!id || !tenantId) return
    const [wf, { data: pending }] = await Promise.all([
      findActiveWorkflow(tenantId, 'sales'),
      supabase
        .from('approval_requests')
        .select('id, request_number, status')
        .eq('tenant_id', tenantId).eq('module', 'sales')
        .eq('record_type', 'sales_order').eq('record_id', id)
        .eq('status', 'pending').maybeSingle(),
    ])
    setActiveWorkflow(wf)
    setPendingRequest(pending || null)
  }, [id, tenantId])

  useEffect(() => { loadApprovalState() }, [loadApprovalState])

  const handleSubmitForApproval = async () => {
    try {
      const result = await submitForApproval({
        tenantId, module: 'sales', recordId: id, recordType: 'sales_order',
        title: `Sales Order ${order.order_number}`,
        description: `Customer: ${order.customer?.name || '—'} · ${lines.length} line item(s)`,
        amount: total, priority: total > 5000 ? 'high' : 'normal',
        requestedBy: window.__erp_user__?.id,
      })
      if (result.submitted) {
        setPendingRequest(result.request)
        toast.success(`Submitted for approval as ${result.request.request_number}.`)
      }
    } catch (err) {
      toast.error(err.message)
    }
  }

  // Buy X Get Y: recompute the auto-added free ("gift") lines from the current normal lines
  const reconcileGifts = async () => {
    const today = new Date().toISOString().split('T')[0]
    const [{ data: bxgyRows }, { data: freshLines }] = await Promise.all([
      supabase
        .from('offers')
        .select('buy_product_name, buy_quantity, get_product_name, get_quantity, start_date, end_date')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .eq('offer_type', 'buy_x_get_y'),
      supabase
        .from('sales_order_lines')
        .select('*')
        .eq('sales_order_id', id)
        .eq('tenant_id', tenantId),
    ])
    const bxgy = (bxgyRows || []).filter(o =>
      o.buy_product_name && o.get_product_name &&
      Number(o.buy_quantity) > 0 && Number(o.get_quantity) > 0 &&
      (!o.start_date || o.start_date <= today) &&
      (!o.end_date   || o.end_date   >= today)
    )
    const all    = freshLines || []
    const normal = all.filter(l => !l.is_gift)
    const gifts  = all.filter(l => l.is_gift)

    // Desired free quantity per get-product (summed across matching offers)
    const desired = {}
    for (const o of bxgy) {
      const bought = normal
        .filter(l => (l.product_name || '').toLowerCase() === o.buy_product_name.toLowerCase())
        .reduce((a, l) => a + Number(l.quantity), 0)
      const free = Math.floor(bought / Number(o.buy_quantity)) * Number(o.get_quantity)
      if (free > 0) desired[o.get_product_name] = (desired[o.get_product_name] || 0) + free
    }

    const ops = []
    for (const [name, qty] of Object.entries(desired)) {
      const existing = gifts.find(g => g.product_name === name)
      if (existing) {
        if (Number(existing.quantity) !== qty) {
          ops.push(supabase.from('sales_order_lines').update({ quantity: qty }).eq('id', existing.id))
        }
      } else {
        ops.push(supabase.from('sales_order_lines').insert({
          tenant_id: tenantId, sales_order_id: id, product_name: name,
          quantity: qty, unit_price: 0, discount_pct: 0, discount_amount: 0,
          tax_rate: 0, total_price: 0, is_gift: true,
        }))
      }
    }
    for (const g of gifts) {
      if (!desired[g.product_name]) ops.push(supabase.from('sales_order_lines').delete().eq('id', g.id))
    }
    if (ops.length) await Promise.all(ops)
  }

  const syncTotals = async () => {
    const { data: fresh } = await supabase
      .from('sales_order_lines')
      .select('quantity, unit_price, discount_pct, discount_amount, tax_rate')
      .eq('sales_order_id', id)
      .eq('tenant_id', tenantId)
    const all      = fresh || []
    const subtotal = all.reduce((a, l) => a + lineMath(l).net, 0)
    const taxAmt   = all.reduce((a, l) => a + lineMath(l).tax, 0)

    // Re-evaluate an applied coupon against the new subtotal; drop + release it if it no longer
    // qualifies. We intentionally skip the usage_limit check here — this order already consumed
    // its redemption at apply time, so re-counting it would evict the coupon from its own order.
    const { data: ord } = await supabase
      .from('sales_orders').select('coupon_code').eq('id', id).single()
    let couponCode     = ord?.coupon_code || null
    let couponDiscount = 0
    if (couponCode) {
      const { data: off } = await supabase
        .from('offers').select('*')
        .eq('tenant_id', tenantId).ilike('coupon_code', couponCode)
        .eq('is_active', true).maybeSingle()
      const todayStr = new Date().toISOString().split('T')[0]
      const dateOk   = off && (!off.start_date || off.start_date <= todayStr) && (!off.end_date || off.end_date >= todayStr)
      if (off && dateOk &&
          ['percentage', 'fixed_amount'].includes(off.offer_type) &&
          subtotal >= Number(off.minimum_amount || 0)) {
        couponDiscount = off.offer_type === 'percentage'
          ? subtotal * Number(off.discount_value) / 100
          : Math.min(subtotal, Number(off.discount_value))
      } else {
        // No longer qualifies → release the redemption back to the offer
        if (off) {
          await supabase.from('offers')
            .update({ usage_count: Math.max(0, (Number(off.usage_count) || 0) - 1) })
            .eq('id', off.id)
        }
        couponCode = null
      }
    }

    await supabase
      .from('sales_orders')
      .update({
        subtotal, tax_amount: taxAmt,
        total_amount: Math.max(0, subtotal + taxAmt - couponDiscount),
        coupon_code: couponCode, coupon_discount: couponDiscount,
      })
      .eq('id', id)
  }

  const handleLineSaved = async () => {
    await reconcileGifts()
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

  // Release one redemption of a coupon back to its offer (counterpart to the +1 in applyCoupon)
  const releaseCouponUsage = async (code) => {
    if (!code) return
    const { data: off } = await supabase
      .from('offers').select('id, usage_count')
      .eq('tenant_id', tenantId).ilike('coupon_code', code).maybeSingle()
    if (off) {
      await supabase.from('offers')
        .update({ usage_count: Math.max(0, (Number(off.usage_count) || 0) - 1) })
        .eq('id', off.id)
    }
  }

  const applyCoupon = async () => {
    const code = couponInput.trim()
    if (!code) return
    const subtotalNow = lines.reduce((a, l) => a + lineMath(l).net, 0)
    const taxNow      = lines.reduce((a, l) => a + lineMath(l).tax, 0)

    const { data: off } = await supabase
      .from('offers').select('*')
      .eq('tenant_id', tenantId).ilike('coupon_code', code)
      .eq('is_active', true).maybeSingle()
    if (!off)                             { toast.error('Invalid or inactive coupon.'); return }
    if (!offerValidNow(off))              { toast.error('This coupon is expired or fully redeemed.'); return }
    if (off.offer_type === 'buy_x_get_y') { toast.error('This is a Buy-X-Get-Y offer, not a coupon discount.'); return }
    if (subtotalNow < Number(off.minimum_amount || 0)) {
      toast.error(`Order subtotal must be at least $${Number(off.minimum_amount).toLocaleString()} for this coupon.`); return
    }
    const discount = off.offer_type === 'percentage'
      ? subtotalNow * Number(off.discount_value) / 100
      : Math.min(subtotalNow, Number(off.discount_value))

    await supabase.from('offers')
      .update({ usage_count: (Number(off.usage_count) || 0) + 1 }).eq('id', off.id)
    const { error } = await supabase.from('sales_orders')
      .update({ coupon_code: off.coupon_code, coupon_discount: discount, total_amount: Math.max(0, subtotalNow + taxNow - discount) })
      .eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Coupon applied.')
    setCouponInput('')
    loadOrder()
  }

  const removeCoupon = async () => {
    const subtotalNow = lines.reduce((a, l) => a + lineMath(l).net, 0)
    const taxNow      = lines.reduce((a, l) => a + lineMath(l).tax, 0)
    const { error } = await supabase.from('sales_orders')
      .update({ coupon_code: null, coupon_discount: 0, total_amount: subtotalNow + taxNow })
      .eq('id', id)
    if (error) { toast.error(error.message); return }
    await releaseCouponUsage(order.coupon_code)   // give the redemption back to the offer
    toast.success('Coupon removed.')
    loadOrder()
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
        <Link to="/sales/orders" className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 text-sm">
          ← Back to orders
        </Link>
      </div>
    )
  }

  const s              = STATUS_BADGE[order.status] || STATUS_BADGE.draft
  const subtotal       = lines.reduce((a, l) => a + lineMath(l).net, 0)
  const taxAmt         = lines.reduce((a, l) => a + lineMath(l).tax, 0)
  const totalDiscount  = lines.reduce((a, l) => a + lineMath(l).discount, 0)
  const grossSubtotal  = subtotal + totalDiscount
  const couponDiscount = Number(order.coupon_discount) || 0
  const total          = Math.max(0, subtotal + taxAmt - couponDiscount)

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
        {/* Order lines */}
        <div className="lg:col-span-2">
          <Card>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300">Order Lines</h3>
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
                                    <Button variant="ghost" size="xs" onClick={() => openEditLine(item)}>
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button variant="danger" size="xs" onClick={() => handleDeleteLine(item.id)}>
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
                    <span>Coupon{order.coupon_code ? ` (${order.coupon_code})` : ''}</span>
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
              {pendingRequest && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Approval</span>
                  <Link
                    to={`/approval/requests/${pendingRequest.id}`}
                    className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    {pendingRequest.request_number} · Pending
                  </Link>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Order Date</span>
                <span className="text-slate-700 dark:text-slate-300">{order.order_date}</span>
              </div>
              {order.delivery_date && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Delivery</span>
                  <span className="text-slate-700 dark:text-slate-300">{order.delivery_date}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Lines</span>
                <span className="text-slate-700 dark:text-slate-300">{lines.length}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Discount</span>
                  <span>−${totalDiscount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold pt-2 border-t border-surface-200 dark:border-surface-800">
                <span className="text-slate-500 dark:text-slate-400">Total</span>
                <span className="text-slate-900 dark:text-slate-100">${total.toFixed(2)}</span>
              </div>
            </div>
          </Card>

          {(order.coupon_code || canEditLines) && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300 mb-3">Coupon</h3>
              {order.coupon_code ? (
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-mono text-sm text-emerald-600 dark:text-emerald-400">{order.coupon_code}</p>
                    <p className="text-xs text-slate-500">−${couponDiscount.toLocaleString()} applied</p>
                  </div>
                  {canEditLines && (
                    <Button variant="danger" size="xs" onClick={removeCoupon}>Remove</Button>
                  )}
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Enter coupon code…"
                      value={couponInput}
                      onChange={e => setCouponInput(e.target.value)}
                    />
                  </div>
                  <Button size="sm" onClick={applyCoupon}>Apply</Button>
                </div>
              )}
            </Card>
          )}

          {order.customer && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300 mb-3">Customer</h3>
              <div className="space-y-1.5 text-sm">
                <p className="font-medium text-slate-900 dark:text-slate-200">{order.customer.name}</p>
                {order.customer.contact_name && (
                  <p className="text-slate-600 dark:text-slate-400">{order.customer.contact_name}</p>
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
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300 mb-2">Notes</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{order.notes}</p>
            </Card>
          )}
        </div>
      </div>

      <LineModal
        open={showLineModal}
        onClose={closeModal}
        line={editingLine}
        lines={lines}
        orderId={id}
        tenantId={tenantId}
        customerName={order.customer?.name}
        onSaved={handleLineSaved}
      />
    </div>
  )
}
