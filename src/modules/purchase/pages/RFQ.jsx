import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Send, Eye } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td,
  PageHeader, Card, Modal, Input, Select, Spinner,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'

const PAGE_SIZE = 10

const STATUS = {
  draft:     { label: 'Draft',           color: 'default' },
  sent:      { label: 'Sent',            color: 'blue'    },
  received:  { label: 'Received',        color: 'green'   },
  expired:   { label: 'Expired',         color: 'red'     },
  converted: { label: 'Converted to PO', color: 'purple'  },
}

const STATUS_TABS = ['all', 'draft', 'sent', 'received', 'expired', 'converted']

const rfqSchema = z.object({
  vendor_id: z.string().min(1, 'Vendor is required'),
  deadline:  z.string().min(1, 'Deadline is required'),
  notes:     z.string().optional(),
})

function NewRFQModal({ open, onClose, vendors, onCreated }) {
  const { tenantId } = useTenant()
  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(rfqSchema),
    defaultValues: { vendor_id: '', deadline: '', notes: '' },
  })

  const onSubmit = async (data) => {
    // Generate a unique RFQ number client-side (server-side sequence not defined in migration)
    const year   = new Date().getFullYear()
    const suffix = String(Date.now()).slice(-5)
    const rfq_number = `RFQ-${year}-${suffix}`

    const { error } = await supabase.from('rfqs').insert({
      tenant_id:  tenantId,
      rfq_number,
      vendor_id:  data.vendor_id,
      deadline:   data.deadline,
      notes:      data.notes || null,
      status:     'draft',
    })

    if (error) { toast.error(error.message); return }

    toast.success('RFQ created.')
    reset()
    onCreated()
    onClose()
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title="New Request for Quotation" size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          <Select label="Vendor" error={errors.vendor_id?.message} {...register('vendor_id')}>
            <option value="">Select vendor…</option>
            {vendors.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </Select>

          <Input
            label="Quotation Deadline"
            type="date"
            error={errors.deadline?.message}
            {...register('deadline')}
          />

          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1.5">
              Notes
            </label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-sm
                         text-slate-900 dark:text-slate-200
                         placeholder:text-slate-400 dark:placeholder:text-slate-600
                         bg-white dark:bg-surface-900
                         border border-surface-200 dark:border-surface-700
                         hover:border-surface-300 dark:hover:border-surface-600
                         focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500
                         transition-colors resize-none"
              placeholder="Requirements, specs…"
              {...register('notes')}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              Create RFQ
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

export default function RFQ() {
  const { tenantId } = useTenant()
  const [rfqs,         setRfqs]         = useState([])
  const [vendors,      setVendors]      = useState([])
  const [total,        setTotal]        = useState(0)
  const [page,         setPage]         = useState(1)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading,      setLoading]      = useState(true)
  const [showNew,      setShowNew]      = useState(false)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const fetchRFQs = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      let query = supabase
        .from('rfqs')
        .select(
          'id, rfq_number, status, deadline, quoted_amount, created_at, vendor:vendors(name)',
          { count: 'exact' },
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (statusFilter !== 'all') query = query.eq('status', statusFilter)

      if (search.trim()) query = query.ilike('rfq_number', `%${search.trim()}%`)

      const { data, count, error } = await query
      if (error) throw error
      setRfqs(data || [])
      setTotal(count || 0)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId, page, search, statusFilter])

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

  useEffect(() => { fetchRFQs() },   [fetchRFQs])
  useEffect(() => { fetchVendors() }, [fetchVendors])
  useEffect(() => { setPage(1) },     [search, statusFilter])

  const handleSend = async (id, rfqNumber) => {
    const { error } = await supabase
      .from('rfqs')
      .update({ status: 'sent' })
      .eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success(`${rfqNumber} sent to vendor.`)
    fetchRFQs()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Request for Quotations"
        subtitle="Send RFQs to vendors and convert to purchase orders"
        breadcrumb="Purchase / RFQ"
        actions={
          <PermissionGate action="create" moduleId="purchase">
            <Button size="sm" onClick={() => setShowNew(true)}>
              <Plus className="w-4 h-4" />New RFQ
            </Button>
          </PermissionGate>
        }
      />

      <Card>
        {/* Toolbar */}
        <div className="flex items-center gap-3 p-4 border-b border-surface-200 dark:border-surface-800 flex-wrap">
          <div className="flex items-center gap-2 max-w-xs px-3 py-1.5 rounded-lg
                          bg-surface-100 dark:bg-surface-800
                          border border-surface-200 dark:border-surface-700">
            <Search className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search RFQ number…"
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
                <Th>RFQ #</Th><Th>Vendor</Th><Th>Deadline</Th><Th>Amount</Th><Th>Status</Th><Th></Th>
              </Thead>
              <Tbody>
                {rfqs.map(rfq => {
                  const s = STATUS[rfq.status] || STATUS.draft
                  return (
                    <Tr key={rfq.id}>
                      <Td>
                        <span className="font-mono text-xs text-brand-400">{rfq.rfq_number}</span>
                      </Td>
                      <Td>
                        <span className="font-medium text-slate-200">{rfq.vendor?.name || '—'}</span>
                      </Td>
                      <Td>
                        <span className="text-slate-500">{rfq.deadline || '—'}</span>
                      </Td>
                      <Td>
                        {rfq.quoted_amount > 0
                          ? <span className="font-semibold">${Number(rfq.quoted_amount).toLocaleString()}</span>
                          : <span className="text-slate-600">—</span>
                        }
                      </Td>
                      <Td><Badge color={s.color}>{s.label}</Badge></Td>
                      <Td>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="xs">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          {rfq.status === 'draft' && (
                            <PermissionGate action="edit" moduleId="purchase">
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => handleSend(rfq.id, rfq.rfq_number)}
                              >
                                <Send className="w-3.5 h-3.5" />
                              </Button>
                            </PermissionGate>
                          )}
                        </div>
                      </Td>
                    </Tr>
                  )
                })}
              </Tbody>
            </Table>

            {rfqs.length === 0 && (
              <div className="py-12 text-center text-slate-500 text-sm">No RFQs found.</div>
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

      <NewRFQModal
        open={showNew}
        onClose={() => setShowNew(false)}
        vendors={vendors}
        onCreated={fetchRFQs}
      />
    </div>
  )
}
