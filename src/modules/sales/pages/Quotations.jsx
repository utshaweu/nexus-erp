import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Send, Trash2, CheckCircle } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td,
  PageHeader, Card, Modal, Input, Select, Spinner,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import {
  PAGE_SIZE_TABLE as PAGE_SIZE,
  QUOTATION_STATUS as STATUS,
  QUOTATION_STATUS_TABS as STATUS_TABS,
} from '@shared/lib/constants'

const quotationSchema = z.object({
  customer_id:    z.string().min(1, 'Customer is required'),
  quotation_date: z.string().min(1, 'Date is required'),
  expiry_date:    z.string().optional(),
  notes:          z.string().optional(),
})

function NewQuotationModal({ open, onClose, customers, onCreated }) {
  const { tenantId } = useTenant()
  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(quotationSchema),
    defaultValues: { customer_id: '', quotation_date: '', expiry_date: '', notes: '' },
  })

  const onSubmit = async (data) => {
    const year             = new Date().getFullYear()
    const suffix           = String(Date.now()).slice(-5)
    const quotation_number = `Q-${year}-${suffix}`

    const { error } = await supabase.from('quotations').insert({
      tenant_id:       tenantId,
      quotation_number,
      customer_id:     data.customer_id,
      quotation_date:  data.quotation_date,
      expiry_date:     data.expiry_date || null,
      notes:           data.notes       || null,
      status:          'draft',
    })

    if (error) { toast.error(error.message); return }

    toast.success('Quotation created.')
    reset()
    onCreated()
    onClose()
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title="New Quotation" size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          <Select label="Customer" error={errors.customer_id?.message} {...register('customer_id')}>
            <option value="">Select customer…</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Quotation Date"
              type="date"
              error={errors.quotation_date?.message}
              {...register('quotation_date')}
            />
            <Input
              label="Expiry Date"
              type="date"
              {...register('expiry_date')}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1.5">
              Notes
            </label>
            <textarea
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm
                         text-slate-900 dark:text-slate-200
                         placeholder:text-slate-400 dark:placeholder:text-slate-600
                         bg-white dark:bg-surface-900
                         border border-surface-200 dark:border-surface-700
                         hover:border-surface-300 dark:hover:border-surface-600
                         focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500
                         transition-colors resize-none"
              placeholder="Optional notes…"
              {...register('notes')}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              Create Quotation
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

export default function Quotations() {
  const { tenantId }    = useTenant()
  const [quotations,   setQuotations]   = useState([])
  const [customers,    setCustomers]    = useState([])
  const [total,        setTotal]        = useState(0)
  const [page,         setPage]         = useState(1)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading,      setLoading]      = useState(true)
  const [showNew,      setShowNew]      = useState(false)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const fetchQuotations = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      let customerIds = []
      if (search.trim()) {
        const { data: cRows } = await supabase
          .from('customers')
          .select('id')
          .eq('tenant_id', tenantId)
          .ilike('name', `%${search.trim()}%`)
        customerIds = (cRows || []).map(c => c.id)
      }

      let query = supabase
        .from('quotations')
        .select(
          'id, quotation_number, status, quotation_date, expiry_date, total_amount, customer:customers(name)',
          { count: 'exact' },
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (statusFilter !== 'all') query = query.eq('status', statusFilter)

      if (search.trim()) {
        const orParts = [`quotation_number.ilike.%${search.trim()}%`]
        if (customerIds.length > 0) {
          orParts.push(`customer_id.in.(${customerIds.join(',')})`)
        }
        query = query.or(orParts.join(','))
      }

      const { data, count, error } = await query
      if (error) throw error
      setQuotations(data || [])
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

  useEffect(() => { fetchQuotations() }, [fetchQuotations])
  useEffect(() => { fetchCustomers() },  [fetchCustomers])
  useEffect(() => { setPage(1) },        [search, statusFilter])

  const handleSend = async (id, quotationNumber) => {
    const { error } = await supabase
      .from('quotations')
      .update({ status: 'sent' })
      .eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success(`${quotationNumber} sent to customer.`)
    fetchQuotations()
  }

  const handleAccept = async (id) => {
    const { error } = await supabase
      .from('quotations')
      .update({ status: 'accepted' })
      .eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Quotation accepted.')
    fetchQuotations()
  }

  const handleDelete = async (id, quotationNumber) => {
    if (!window.confirm(`Delete ${quotationNumber}? This cannot be undone.`)) return
    const { error } = await supabase.from('quotations').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Quotation deleted.')
    fetchQuotations()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotations"
        subtitle={`${total} quotation${total !== 1 ? 's' : ''}`}
        breadcrumb="Sales / Quotations"
        actions={
          <PermissionGate action="create" moduleId="sales">
            <Button size="sm" onClick={() => setShowNew(true)}>
              <Plus className="w-4 h-4" />New Quotation
            </Button>
          </PermissionGate>
        }
      />

      <Card>
        <div className="flex items-center gap-3 p-4 border-b border-surface-200 dark:border-surface-800 flex-wrap">
          <div className="flex items-center gap-2 max-w-xs px-3 py-1.5 rounded-lg
                          bg-surface-100 dark:bg-surface-800
                          border border-surface-200 dark:border-surface-700">
            <Search className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search quotations, customers…"
              className="bg-transparent text-sm text-slate-700 dark:text-slate-300
                         placeholder:text-slate-400 dark:placeholder:text-slate-600
                         flex-1 outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {STATUS_TABS.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  statusFilter === s
                    ? 'bg-brand-600/20 text-brand-300 border border-brand-600/30'
                    : 'text-slate-500 hover:text-slate-200'
                }`}
              >
                {s === 'all' ? 'All' : STATUS[s]?.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="w-6 h-6" />
          </div>
        ) : (
          <>
            <Table>
              <Thead>
                <Th>Quotation #</Th>
                <Th>Customer</Th>
                <Th>Date</Th>
                <Th>Expiry</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
                <Th></Th>
              </Thead>
              <Tbody>
                {quotations.map(q => {
                  const s = STATUS[q.status] || STATUS.draft
                  return (
                    <Tr key={q.id}>
                      <Td>
                        <span className="font-mono text-xs text-emerald-400">{q.quotation_number}</span>
                      </Td>
                      <Td>
                        <span className="font-medium text-slate-200">{q.customer?.name || '—'}</span>
                      </Td>
                      <Td>
                        <span className="text-slate-500">{q.quotation_date}</span>
                      </Td>
                      <Td>
                        <span className="text-slate-500">{q.expiry_date || '—'}</span>
                      </Td>
                      <Td>
                        {Number(q.total_amount) > 0
                          ? <span className="font-semibold">${Number(q.total_amount).toLocaleString()}</span>
                          : <span className="text-slate-600">—</span>
                        }
                      </Td>
                      <Td><Badge color={s.color}>{s.label}</Badge></Td>
                      <Td>
                        <div className="flex gap-1">
                          {q.status === 'draft' && (
                            <PermissionGate action="edit" moduleId="sales">
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => handleSend(q.id, q.quotation_number)}
                              >
                                <Send className="w-3.5 h-3.5" />
                              </Button>
                            </PermissionGate>
                          )}
                          {q.status === 'sent' && (
                            <PermissionGate action="approve" moduleId="sales">
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => handleAccept(q.id)}
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                              </Button>
                            </PermissionGate>
                          )}
                          <PermissionGate action="delete" moduleId="sales">
                            <Button
                              variant="danger"
                              size="xs"
                              onClick={() => handleDelete(q.id, q.quotation_number)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </PermissionGate>
                        </div>
                      </Td>
                    </Tr>
                  )
                })}
              </Tbody>
            </Table>

            {quotations.length === 0 && (
              <div className="py-12 text-center text-slate-500 text-sm">No quotations found.</div>
            )}

            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              total={total}
              pageSize={PAGE_SIZE}
              className="border-t border-surface-200 dark:border-surface-800"
            />
          </>
        )}
      </Card>

      <NewQuotationModal
        open={showNew}
        onClose={() => setShowNew(false)}
        customers={customers}
        onCreated={fetchQuotations}
      />
    </div>
  )
}
