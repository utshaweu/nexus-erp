import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Pencil, Trash2, Receipt, PlusCircle, Minus, Send } from 'lucide-react'
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
  BILL_STATUS,
  BILL_STATUS_TABS,
} from '@shared/lib/constants'
import { findActiveWorkflow, submitForApproval } from '@shared/lib/approvalWorkflow'

// ── Validation ────────────────────────────────────────────────────────────────

const lineSchema = z.object({
  description: z.string().trim().min(1, 'Select a product'),
  quantity:    z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0.01, 'Must be > 0'),
  unit_price:  z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0, 'Must be ≥ 0'),
  tax_rate:    z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0).max(100),
})

const billSchema = z.object({
  vendor_id: z.string().min(1, 'Vendor is required'),
  bill_date: z.string().min(1, 'Bill date is required'),
  due_date:  z.string().optional(),
  status:    z.enum(['draft', 'posted', 'paid', 'cancelled']),
  lines:     z.array(lineSchema).min(1, 'At least one line item is required'),
})

const DEFAULT_LINE = { description: '', quantity: 1, unit_price: 0, tax_rate: 0 }
const DEFAULT_VALUES = {
  vendor_id: '',
  bill_date: new Date().toISOString().slice(0, 10),
  due_date: '',
  status: 'draft',
  lines: [{ ...DEFAULT_LINE }],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const computeTotal = (lines = []) =>
  lines.reduce(
    (s, l) => s + Number(l.quantity || 0) * Number(l.unit_price || 0) * (1 + Number(l.tax_rate || 0) / 100),
    0
  )

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── Bill Modal ────────────────────────────────────────────────────────────────

function BillModal({ open, onClose, onSaved, bill, vendors, products }) {
  const { tenantId } = useTenant()
  const isEdit = Boolean(bill)

  const {
    register, handleSubmit, reset, control, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(billSchema), defaultValues: DEFAULT_VALUES })

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const watchedLines = watch('lines') || []
  const total = computeTotal(watchedLines)

  // When a product is selected, auto-fill unit_price from cost_price
  const handleProductChange = (i, productName) => {
    setValue(`lines.${i}.description`, productName, { shouldValidate: true })
    const product = products.find(p => p.name === productName)
    if (product) {
      setValue(`lines.${i}.unit_price`, Number(product.cost_price || 0), { shouldValidate: true })
    }
  }

  useEffect(() => {
    if (!open) return
    if (bill) {
      supabase
        .from('bill_lines')
        .select('*')
        .eq('bill_id', bill.id)
        .order('id')
        .then(({ data }) => {
          reset({
            vendor_id: bill.vendor_id || '',
            bill_date: bill.bill_date || new Date().toISOString().slice(0, 10),
            due_date:  bill.due_date  || '',
            status:    bill.status    || 'draft',
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
  }, [open, bill, reset])

  const onSubmit = async (data) => {
    const total_amount = computeTotal(data.lines)
    const header = {
      vendor_id:    data.vendor_id,
      bill_date:    data.bill_date,
      due_date:     data.due_date || null,
      status:       data.status,
      total_amount,
    }

    if (isEdit) {
      const { error } = await supabase.from('bills').update(header).eq('id', bill.id)
      if (error) { toast.error(error.message); return }

      await supabase.from('bill_lines').delete().eq('bill_id', bill.id)
      const lines = data.lines.map(l => ({
        tenant_id:  tenantId,
        bill_id:    bill.id,
        description: l.description,
        quantity:   l.quantity,
        unit_price: l.unit_price,
        tax_rate:   l.tax_rate,
        total_price: Number(l.quantity) * Number(l.unit_price) * (1 + Number(l.tax_rate) / 100),
      }))
      const { error: lineErr } = await supabase.from('bill_lines').insert(lines)
      if (lineErr) { toast.error(lineErr.message); return }
      toast.success('Bill updated.')
    } else {
      const { data: num, error: numErr } = await supabase.rpc('generate_bill_number')
      if (numErr) { toast.error(numErr.message); return }

      const { data: newBill, error } = await supabase
        .from('bills')
        .insert({ ...header, tenant_id: tenantId, bill_number: num })
        .select('id')
        .single()
      if (error) { toast.error(error.message); return }

      const lines = data.lines.map(l => ({
        tenant_id:  tenantId,
        bill_id:    newBill.id,
        description: l.description,
        quantity:   l.quantity,
        unit_price: l.unit_price,
        tax_rate:   l.tax_rate,
        total_price: Number(l.quantity) * Number(l.unit_price) * (1 + Number(l.tax_rate) / 100),
      }))
      const { error: lineErr } = await supabase.from('bill_lines').insert(lines)
      if (lineErr) { toast.error(lineErr.message); return }
      toast.success('Bill created.')
    }
    onSaved(); onClose()
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEdit ? `Edit ${bill?.bill_number}` : 'New Bill'}
      size="xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-5">

          <div className="grid grid-cols-2 gap-4">
            <Select label="Vendor" error={errors.vendor_id?.message} {...register('vendor_id')}>
              <option value="">Select vendor…</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </Select>
            <Select label="Status" {...register('status')}>
              {Object.entries(BILL_STATUS).map(([v, { label }]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Bill Date"
              type="date"
              error={errors.bill_date?.message}
              {...register('bill_date')}
            />
            <Input label="Due Date" type="date" {...register('due_date')} />
          </div>

          {errors.lines && (
            <p className="text-xs text-red-500">{errors.lines.message || errors.lines.root?.message}</p>
          )}

          {/* Line items */}
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
                const qty       = Number(watchedLines[i]?.quantity   || 0)
                const price     = Number(watchedLines[i]?.unit_price || 0)
                const tax       = Number(watchedLines[i]?.tax_rate   || 0)
                const lineTotal = qty * price * (1 + tax / 100)

                return (
                  <div
                    key={field.id}
                    className="grid grid-cols-[1fr_72px_96px_64px_88px_32px] gap-2 px-3 py-2
                               border-b border-surface-100 dark:border-surface-800 last:border-0 items-center"
                  >
                    {/* Product dropdown — auto-fills cost_price */}
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
                      ${lineTotal.toFixed(2)}
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

            {/* Total */}
            <div className="flex justify-end">
              <div className="w-48 rounded-xl bg-slate-50 dark:bg-surface-800 p-3">
                <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-slate-100">
                  <span>Total</span>
                  <span className="tabular-nums">${fmt(total)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              {isEdit ? 'Save Changes' : 'Create Bill'}
            </Button>
          </div>

        </div>
      </form>
    </Modal>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Bills() {
  const { tenantId } = useTenant()
  const [bills,        setBills]        = useState([])
  const [vendors,      setVendors]      = useState([])
  const [products,     setProducts]     = useState([])
  const [total,        setTotal]        = useState(0)
  const [page,         setPage]         = useState(1)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading,      setLoading]      = useState(true)
  const [showModal,    setShowModal]    = useState(false)
  const [editBill,     setEditBill]     = useState(null)
  const [workflow,       setWorkflow]       = useState(null)
  const [pendingByBill,  setPendingByBill]  = useState({})

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const fetchBills = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      let query = supabase
        .from('bills')
        .select('*, vendor:vendor_id(name)', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('bill_date', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (statusFilter !== 'all') query = query.eq('status', statusFilter)
      if (search.trim()) query = query.ilike('bill_number', `%${search.trim()}%`)

      const { data, count, error } = await query
      if (error) throw error
      setBills(data || [])
      setTotal(count || 0)

      const draftIds = (data || []).filter(b => b.status === 'draft').map(b => b.id)
      if (draftIds.length) {
        const { data: pending } = await supabase
          .from('approval_requests')
          .select('id, request_number, record_id')
          .eq('tenant_id', tenantId).eq('module', 'accounts')
          .eq('record_type', 'bill').eq('status', 'pending')
          .in('record_id', draftIds)
        setPendingByBill(Object.fromEntries((pending || []).map(p => [p.record_id, p])))
      } else {
        setPendingByBill({})
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId, page, search, statusFilter])

  useEffect(() => {
    if (!tenantId) return
    findActiveWorkflow(tenantId, 'accounts').then(setWorkflow)
  }, [tenantId])

  const handleSubmitForApproval = async (bill) => {
    try {
      const result = await submitForApproval({
        tenantId, module: 'accounts', recordId: bill.id, recordType: 'bill',
        title: `Bill ${bill.bill_number}`,
        description: `Vendor: ${bill.vendor?.name || '—'} · Total $${fmt(bill.total_amount)}`,
        amount: bill.total_amount, priority: Number(bill.total_amount) > 5000 ? 'high' : 'normal',
        requestedBy: window.__erp_user__?.id,
      })
      if (result.submitted) {
        setPendingByBill(prev => ({ ...prev, [bill.id]: result.request }))
        toast.success(`Submitted for approval as ${result.request.request_number}.`)
      }
    } catch (err) {
      toast.error(err.message)
    }
  }

  const fetchVendors = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase
      .from('vendors')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .order('name')
    setVendors(data || [])
  }, [tenantId])

  const fetchProducts = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase
      .from('products')
      .select('id, name, cost_price')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .order('name')
    setProducts(data || [])
  }, [tenantId])

  useEffect(() => { fetchBills() }, [fetchBills])
  useEffect(() => { fetchVendors() }, [fetchVendors])
  useEffect(() => { fetchProducts() }, [fetchProducts])
  useEffect(() => { setPage(1) }, [search, statusFilter])

  const openNew    = ()  => { setEditBill(null); setShowModal(true) }
  const openEdit   = (b) => { setEditBill(b);    setShowModal(true) }
  const closeModal = ()  => { setShowModal(false); setEditBill(null) }

  const handleDelete = async (b) => {
    if (!window.confirm(`Delete bill ${b.bill_number}? This cannot be undone.`)) return
    await supabase.from('bill_lines').delete().eq('bill_id', b.id)
    const { error } = await supabase.from('bills').delete().eq('id', b.id)
    if (error) { toast.error(error.message); return }
    toast.success('Bill deleted.')
    fetchBills()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bills"
        subtitle="Manage vendor bills and track payables"
        breadcrumb="Accounts / Bills"
        actions={
          <PermissionGate action="create" moduleId="accounts">
            <Button size="sm" onClick={openNew} className="gap-1.5">
              <Plus className="w-4 h-4" />New Bill
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
              placeholder="Search by bill number…"
              className="bg-transparent text-sm text-slate-700 dark:text-slate-300
                         placeholder:text-slate-400 dark:placeholder:text-slate-600
                         flex-1 outline-none"
            />
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-surface-800">
            {BILL_STATUS_TABS.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  statusFilter === s
                    ? 'bg-white dark:bg-surface-700 text-slate-800 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {s === 'all' ? 'All' : BILL_STATUS[s]?.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20
                            flex items-center justify-center">
              <Receipt className="w-5 h-5 text-pink-400 animate-pulse" />
            </div>
            <p className="text-sm text-slate-400">Loading bills…</p>
          </div>
        ) : bills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full bg-pink-500/5 dark:bg-pink-500/10 scale-[2.5]" />
              <div className="absolute inset-0 rounded-full bg-pink-500/8 dark:bg-pink-500/15 scale-[1.8]" />
              <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-pink-500/20 to-rose-600/10
                              border border-pink-500/20 flex items-center justify-center">
                {search || statusFilter !== 'all'
                  ? <Search className="w-9 h-9 text-slate-400" />
                  : <Receipt className="w-9 h-9 text-pink-400" />}
              </div>
            </div>
            <h3 className="text-base font-display font-bold text-slate-800 dark:text-slate-200 mb-1">
              {search || statusFilter !== 'all' ? 'No bills match' : 'No bills yet'}
            </h3>
            <p className="text-sm text-slate-500 text-center max-w-xs mb-5">
              {search || statusFilter !== 'all'
                ? 'Try adjusting your search or filter.'
                : 'Add your first vendor bill to track payables.'}
            </p>
            {!search && statusFilter === 'all' && (
              <PermissionGate action="create" moduleId="accounts">
                <Button size="sm" onClick={openNew} className="gap-1.5">
                  <Plus className="w-4 h-4" />Add First Bill
                </Button>
              </PermissionGate>
            )}
          </div>
        ) : (
          <Table>
            <Thead>
              <Th>Bill #</Th>
              <Th>Vendor</Th>
              <Th>Bill Date</Th>
              <Th>Due Date</Th>
              <Th>Total</Th>
              <Th>Paid</Th>
              <Th>Status</Th>
              <Th></Th>
            </Thead>
            <Tbody>
              {bills.map(b => (
                <Tr key={b.id} onClick={() => openEdit(b)}>
                  <Td>
                    <span className="font-mono text-xs font-medium
                                     text-pink-600 dark:text-pink-400
                                     bg-pink-50 dark:bg-pink-500/10
                                     px-2 py-0.5 rounded-md">
                      {b.bill_number}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {b.vendor?.name || '—'}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-sm text-slate-600 dark:text-slate-400">{b.bill_date}</span>
                  </Td>
                  <Td>
                    <span className="text-sm text-slate-600 dark:text-slate-400">{b.due_date || '—'}</span>
                  </Td>
                  <Td>
                    <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                      ${fmt(b.total_amount)}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-sm text-emerald-600 dark:text-emerald-400">
                      ${fmt(b.paid_amount)}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Badge color={BILL_STATUS[b.status]?.color || 'default'}>
                        {BILL_STATUS[b.status]?.label || b.status}
                      </Badge>
                      {pendingByBill[b.id] && (
                        <Link
                          to={`/approval/requests/${pendingByBill[b.id].id}`}
                          onClick={e => e.stopPropagation()}
                          className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
                        >
                          {pendingByBill[b.id].request_number} · Pending
                        </Link>
                      )}
                    </div>
                  </Td>
                  <Td onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      {b.status === 'draft' && workflow && !pendingByBill[b.id] && (
                        <PermissionGate action="edit" moduleId="accounts">
                          <Button variant="ghost" size="xs" onClick={() => handleSubmitForApproval(b)} title="Submit for Approval">
                            <Send className="w-3.5 h-3.5" />
                          </Button>
                        </PermissionGate>
                      )}
                      <PermissionGate action="edit" moduleId="accounts">
                        <Button variant="ghost" size="xs" onClick={() => openEdit(b)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </PermissionGate>
                      <PermissionGate action="delete" moduleId="accounts">
                        <Button variant="danger" size="xs" onClick={() => handleDelete(b)}>
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
          label="bills"
          className="border-t border-surface-200 dark:border-surface-800"
        />
      </Card>

      <BillModal
        open={showModal}
        onClose={closeModal}
        onSaved={fetchBills}
        bill={editBill}
        vendors={vendors}
        products={products}
      />
    </div>
  )
}
