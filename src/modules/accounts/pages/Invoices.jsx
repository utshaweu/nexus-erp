import { useState, useEffect, useCallback } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Pencil, Trash2, FileText, PlusCircle, Minus } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card,
  Modal, Input, Select,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import {
  PAGE_SIZE_TABLE as PAGE_SIZE,
  INVOICE_STATUS,
  INVOICE_STATUS_TABS,
} from '@shared/lib/constants'

// ── Validation ────────────────────────────────────────────────────────────────

const lineSchema = z.object({
  description: z.string().trim().min(1, 'Select a product'),
  quantity:    z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0.01, 'Must be > 0'),
  unit_price:  z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0, 'Must be ≥ 0'),
  tax_rate:    z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0).max(100),
})

const invoiceSchema = z.object({
  customer_id:  z.string().min(1, 'Customer is required'),
  invoice_date: z.string().min(1, 'Invoice date is required'),
  due_date:     z.string().optional(),
  notes:        z.string().optional(),
  status:       z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']),
  lines:        z.array(lineSchema).min(1, 'At least one line item is required'),
})

const DEFAULT_LINE = { description: '', quantity: 1, unit_price: 0, tax_rate: 0 }
const DEFAULT_VALUES = {
  customer_id: '',
  invoice_date: new Date().toISOString().slice(0, 10),
  due_date: '',
  notes: '',
  status: 'draft',
  lines: [{ ...DEFAULT_LINE }],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const computeTotals = (lines = []) => {
  const subtotal   = lines.reduce((s, l) => s + (Number(l.quantity || 0) * Number(l.unit_price || 0)), 0)
  const tax_amount = lines.reduce((s, l) => s + (Number(l.quantity || 0) * Number(l.unit_price || 0) * Number(l.tax_rate || 0) / 100), 0)
  return { subtotal, tax_amount, total_amount: subtotal + tax_amount }
}

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── Line Items Table ──────────────────────────────────────────────────────────
// products: [{ id, name, sale_price }]  — description is a product-name select

function LineItemsTable({ fields, register, watch, remove, append, setValue, products }) {
  const watchedLines = watch('lines') || []

  const handleProductChange = (i, productName) => {
    setValue(`lines.${i}.description`, productName, { shouldValidate: true })
    const product = products.find(p => p.name === productName)
    if (product) {
      setValue(`lines.${i}.unit_price`, Number(product.sale_price || 0), { shouldValidate: true })
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Line Items
        </p>
        <Button type="button" variant="ghost" size="xs" onClick={() => append({ ...DEFAULT_LINE })} className="gap-1">
          <PlusCircle className="w-3.5 h-3.5" />Add Line
        </Button>
      </div>

      <div className="rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_72px_96px_64px_88px_32px] gap-2 px-3 py-2
                        bg-slate-50 dark:bg-surface-800
                        border-b border-surface-200 dark:border-surface-700">
          {['Product', 'Qty', 'Unit Price', 'Tax %', 'Total', ''].map(h => (
            <span key={h} className="text-xs font-medium text-slate-500 dark:text-slate-400">{h}</span>
          ))}
        </div>

        {fields.map((field, i) => {
          const qty   = Number(watchedLines[i]?.quantity   || 0)
          const price = Number(watchedLines[i]?.unit_price || 0)
          const tax   = Number(watchedLines[i]?.tax_rate   || 0)
          const total = qty * price * (1 + tax / 100)

          return (
            <div
              key={field.id}
              className="grid grid-cols-[1fr_72px_96px_64px_88px_32px] gap-2 px-3 py-2
                         border-b border-surface-100 dark:border-surface-800 last:border-0 items-center"
            >
              {/* Description — product dropdown */}
              <select
                value={watchedLines[i]?.description || ''}
                onChange={e => handleProductChange(i, e.target.value)}
                className="text-sm bg-transparent border-b border-surface-200 dark:border-surface-700
                           outline-none text-slate-800 dark:text-slate-200 py-0.5 min-w-0 cursor-pointer
                           dark:bg-surface-900"
              >
                <option value="">Select product…</option>
                {products.map(p => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>

              <input
                type="number" min="0" step="0.01" placeholder="1"
                className="text-sm bg-transparent border-b border-surface-200 dark:border-surface-700
                           outline-none text-right text-slate-800 dark:text-slate-200 py-0.5 w-full"
                {...register(`lines.${i}.quantity`)}
              />
              <input
                type="number" min="0" step="0.01" placeholder="0.00"
                className="text-sm bg-transparent border-b border-surface-200 dark:border-surface-700
                           outline-none text-right text-slate-800 dark:text-slate-200 py-0.5 w-full"
                {...register(`lines.${i}.unit_price`)}
              />
              <input
                type="number" min="0" max="100" step="0.01" placeholder="0"
                className="text-sm bg-transparent border-b border-surface-200 dark:border-surface-700
                           outline-none text-right text-slate-800 dark:text-slate-200 py-0.5 w-full"
                {...register(`lines.${i}.tax_rate`)}
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 text-right tabular-nums">
                ${total.toFixed(2)}
              </span>
              <button
                type="button"
                onClick={() => fields.length > 1 && remove(i)}
                disabled={fields.length <= 1}
                className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-500/10
                           text-slate-400 hover:text-red-500 transition-colors
                           disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Invoice Modal ─────────────────────────────────────────────────────────────

function InvoiceModal({ open, onClose, onSaved, invoice, customers, products }) {
  const { tenantId } = useTenant()
  const isEdit = Boolean(invoice)

  const {
    register, handleSubmit, reset, control, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(invoiceSchema), defaultValues: DEFAULT_VALUES })

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const watchedLines = watch('lines') || []
  const totals = computeTotals(watchedLines)

  useEffect(() => {
    if (!open) return
    if (invoice) {
      supabase
        .from('invoice_lines')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('id')
        .then(({ data }) => {
          reset({
            customer_id:  invoice.customer_id   || '',
            invoice_date: invoice.invoice_date  || new Date().toISOString().slice(0, 10),
            due_date:     invoice.due_date       || '',
            notes:        invoice.notes          || '',
            status:       invoice.status         || 'draft',
            lines: data?.length
              ? data.map(l => ({
                  description: l.description,
                  quantity:    Number(l.quantity),
                  unit_price:  Number(l.unit_price),
                  tax_rate:    Number(l.tax_rate),
                }))
              : [{ ...DEFAULT_LINE }],
          })
        })
    } else {
      reset(DEFAULT_VALUES)
    }
  }, [open, invoice, reset])

  const onSubmit = async (data) => {
    const { subtotal, tax_amount, total_amount } = computeTotals(data.lines)
    const header = {
      customer_id:  data.customer_id,
      invoice_date: data.invoice_date,
      due_date:     data.due_date || null,
      notes:        data.notes   || null,
      status:       data.status,
      subtotal,
      tax_amount,
      total_amount,
    }

    if (isEdit) {
      const { error } = await supabase.from('invoices').update(header).eq('id', invoice.id)
      if (error) { toast.error(error.message); return }

      await supabase.from('invoice_lines').delete().eq('invoice_id', invoice.id)
      const lines = data.lines.map(l => ({
        tenant_id:   tenantId,
        invoice_id:  invoice.id,
        description: l.description,
        quantity:    l.quantity,
        unit_price:  l.unit_price,
        tax_rate:    l.tax_rate,
        total_price: Number(l.quantity) * Number(l.unit_price) * (1 + Number(l.tax_rate) / 100),
      }))
      const { error: lineErr } = await supabase.from('invoice_lines').insert(lines)
      if (lineErr) { toast.error(lineErr.message); return }
      toast.success('Invoice updated.')
    } else {
      const { data: num, error: numErr } = await supabase.rpc('generate_invoice_number')
      if (numErr) { toast.error(numErr.message); return }

      const { data: inv, error } = await supabase
        .from('invoices')
        .insert({ ...header, tenant_id: tenantId, invoice_number: num })
        .select('id')
        .single()
      if (error) { toast.error(error.message); return }

      const lines = data.lines.map(l => ({
        tenant_id:   tenantId,
        invoice_id:  inv.id,
        description: l.description,
        quantity:    l.quantity,
        unit_price:  l.unit_price,
        tax_rate:    l.tax_rate,
        total_price: Number(l.quantity) * Number(l.unit_price) * (1 + Number(l.tax_rate) / 100),
      }))
      const { error: lineErr } = await supabase.from('invoice_lines').insert(lines)
      if (lineErr) { toast.error(lineErr.message); return }
      toast.success('Invoice created.')
    }
    onSaved(); onClose()
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEdit ? `Edit ${invoice?.invoice_number}` : 'New Invoice'}
      size="xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-5">

          <div className="grid grid-cols-2 gap-4">
            <Select label="Customer" error={errors.customer_id?.message} {...register('customer_id')}>
              <option value="">Select customer…</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select label="Status" {...register('status')}>
              {Object.entries(INVOICE_STATUS).map(([v, { label }]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Invoice Date"
              type="date"
              error={errors.invoice_date?.message}
              {...register('invoice_date')}
            />
            <Input label="Due Date" type="date" {...register('due_date')} />
          </div>

          {errors.lines && (
            <p className="text-xs text-red-500">{errors.lines.message || errors.lines.root?.message}</p>
          )}

          <LineItemsTable
            fields={fields}
            register={register}
            watch={watch}
            remove={remove}
            append={append}
            setValue={setValue}
            products={products}
          />

          {/* Totals summary */}
          <div className="flex justify-end">
            <div className="w-56 space-y-1.5 rounded-xl bg-slate-50 dark:bg-surface-800 p-3">
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Subtotal</span>
                <span className="tabular-nums">${fmt(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Tax</span>
                <span className="tabular-nums">${fmt(totals.tax_amount)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-slate-100
                              pt-1.5 border-t border-surface-200 dark:border-surface-700">
                <span>Total</span>
                <span className="tabular-nums">${fmt(totals.total_amount)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Notes (optional)
            </label>
            <textarea
              rows={2}
              placeholder="Internal notes or payment instructions…"
              className="w-full rounded-lg border border-surface-200 dark:border-surface-700
                         bg-slate-50 dark:bg-surface-800
                         text-sm text-slate-800 dark:text-slate-200
                         px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              {...register('notes')}
            />
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              {isEdit ? 'Save Changes' : 'Create Invoice'}
            </Button>
          </div>

        </div>
      </form>
    </Modal>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Invoices() {
  const { tenantId } = useTenant()
  const [invoices,      setInvoices]      = useState([])
  const [customers,     setCustomers]     = useState([])
  const [products,      setProducts]      = useState([])
  const [total,         setTotal]         = useState(0)
  const [page,          setPage]          = useState(1)
  const [search,        setSearch]        = useState('')
  const [statusFilter,  setStatusFilter]  = useState('all')
  const [loading,       setLoading]       = useState(true)
  const [showModal,     setShowModal]     = useState(false)
  const [editInvoice,   setEditInvoice]   = useState(null)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const fetchInvoices = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      let query = supabase
        .from('invoices')
        .select('*, customer:customer_id(name)', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('invoice_date', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (statusFilter !== 'all') query = query.eq('status', statusFilter)
      if (search.trim()) {
        query = query.ilike('invoice_number', `%${search.trim()}%`)
      }

      const { data, count, error } = await query
      if (error) throw error
      setInvoices(data || [])
      setTotal(count || 0)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId, page, search, statusFilter])

  const fetchCustomers = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase
      .from('customers')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .order('name')
    setCustomers(data || [])
  }, [tenantId])

  const fetchProducts = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase
      .from('products')
      .select('id, name, sale_price')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .order('name')
    setProducts(data || [])
  }, [tenantId])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])
  useEffect(() => { fetchCustomers() }, [fetchCustomers])
  useEffect(() => { fetchProducts() }, [fetchProducts])
  useEffect(() => { setPage(1) }, [search, statusFilter])

  const openNew    = ()    => { setEditInvoice(null); setShowModal(true) }
  const openEdit   = (inv) => { setEditInvoice(inv);  setShowModal(true) }
  const closeModal = ()    => { setShowModal(false);  setEditInvoice(null) }

  const handleDelete = async (inv) => {
    if (!window.confirm(`Delete invoice ${inv.invoice_number}? This cannot be undone.`)) return
    await supabase.from('invoice_lines').delete().eq('invoice_id', inv.id)
    const { error } = await supabase.from('invoices').delete().eq('id', inv.id)
    if (error) { toast.error(error.message); return }
    toast.success('Invoice deleted.')
    fetchInvoices()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        subtitle="Manage customer invoices and track payments"
        breadcrumb="Accounts / Invoices"
        actions={
          <PermissionGate action="create" moduleId="accounts">
            <Button size="sm" onClick={openNew} className="gap-1.5">
              <Plus className="w-4 h-4" />New Invoice
            </Button>
          </PermissionGate>
        }
      />

      <Card>
        {/* Toolbar */}
        <div className="flex items-center gap-3 p-4 border-b border-surface-200 dark:border-surface-800 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-xs
                          px-3 py-2 rounded-lg
                          bg-slate-50 dark:bg-surface-800
                          border border-surface-200 dark:border-surface-700">
            <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by invoice number…"
              className="bg-transparent text-sm text-slate-700 dark:text-slate-300
                         placeholder:text-slate-400 dark:placeholder:text-slate-600
                         flex-1 outline-none"
            />
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-surface-800">
            {INVOICE_STATUS_TABS.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  statusFilter === s
                    ? 'bg-white dark:bg-surface-700 text-slate-800 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {s === 'all' ? 'All' : INVOICE_STATUS[s]?.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20
                            flex items-center justify-center">
              <FileText className="w-5 h-5 text-purple-400 animate-pulse" />
            </div>
            <p className="text-sm text-slate-400">Loading invoices…</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full bg-purple-500/5 dark:bg-purple-500/10 scale-[2.5]" />
              <div className="absolute inset-0 rounded-full bg-purple-500/8 dark:bg-purple-500/15 scale-[1.8]" />
              <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-violet-600/10
                              border border-purple-500/20 flex items-center justify-center">
                {search || statusFilter !== 'all'
                  ? <Search className="w-9 h-9 text-slate-400" />
                  : <FileText className="w-9 h-9 text-purple-400" />}
              </div>
            </div>
            <h3 className="text-base font-display font-bold text-slate-800 dark:text-slate-200 mb-1">
              {search || statusFilter !== 'all' ? 'No invoices match' : 'No invoices yet'}
            </h3>
            <p className="text-sm text-slate-500 text-center max-w-xs mb-5">
              {search || statusFilter !== 'all'
                ? 'Try adjusting your search or filter.'
                : 'Create your first invoice to start tracking payments.'}
            </p>
            {!search && statusFilter === 'all' && (
              <PermissionGate action="create" moduleId="accounts">
                <Button size="sm" onClick={openNew} className="gap-1.5">
                  <Plus className="w-4 h-4" />Create First Invoice
                </Button>
              </PermissionGate>
            )}
          </div>
        ) : (
          <Table>
            <Thead>
              <Th>Invoice #</Th>
              <Th>Customer</Th>
              <Th>Invoice Date</Th>
              <Th>Due Date</Th>
              <Th>Total</Th>
              <Th>Paid</Th>
              <Th>Status</Th>
              <Th></Th>
            </Thead>
            <Tbody>
              {invoices.map(inv => (
                <Tr key={inv.id} onClick={() => openEdit(inv)}>
                  <Td>
                    <span className="font-mono text-xs font-medium
                                     text-purple-600 dark:text-purple-400
                                     bg-purple-50 dark:bg-purple-500/10
                                     px-2 py-0.5 rounded-md">
                      {inv.invoice_number}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {inv.customer?.name || '—'}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-sm text-slate-600 dark:text-slate-400">{inv.invoice_date}</span>
                  </Td>
                  <Td>
                    <span className="text-sm text-slate-600 dark:text-slate-400">{inv.due_date || '—'}</span>
                  </Td>
                  <Td>
                    <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                      ${fmt(inv.total_amount)}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-sm text-emerald-600 dark:text-emerald-400">
                      ${fmt(inv.paid_amount)}
                    </span>
                  </Td>
                  <Td>
                    <Badge color={INVOICE_STATUS[inv.status]?.color || 'default'}>
                      {INVOICE_STATUS[inv.status]?.label || inv.status}
                    </Badge>
                  </Td>
                  <Td onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <PermissionGate action="edit" moduleId="accounts">
                        <Button variant="ghost" size="xs" onClick={() => openEdit(inv)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </PermissionGate>
                      <PermissionGate action="delete" moduleId="accounts">
                        <Button variant="danger" size="xs" onClick={() => handleDelete(inv)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </PermissionGate>
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          total={total}
          pageSize={PAGE_SIZE}
          label="invoices"
          className="border-t border-surface-200 dark:border-surface-800"
        />
      </Card>

      <InvoiceModal
        open={showModal}
        onClose={closeModal}
        onSaved={fetchInvoices}
        invoice={editInvoice}
        customers={customers}
        products={products}
      />
    </div>
  )
}
