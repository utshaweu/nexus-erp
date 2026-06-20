import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { Send, Plus, Eye, X, Search } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td,
  PageHeader, Card, Modal, Input, Select, EmptyState, Spinner,
} from '@shared/components/ui'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import { PAGE_SIZE_TABLE as PAGE_SIZE } from '@shared/lib/constants'

const STATUS = {
  pending:   { label: 'Pending',   color: 'yellow'  },
  approved:  { label: 'Approved',  color: 'green'   },
  rejected:  { label: 'Rejected',  color: 'red'     },
  cancelled: { label: 'Cancelled', color: 'default' },
}
const STATUS_TABS = ['all', 'pending', 'approved', 'rejected', 'cancelled']

const PRIORITY = {
  low:    { label: 'Low',    color: 'default' },
  normal: { label: 'Normal', color: 'blue'    },
  high:   { label: 'High',   color: 'yellow'  },
  urgent: { label: 'Urgent', color: 'red'     },
}

const TEXTAREA_CLS =
  'w-full px-3 py-2 rounded-lg text-sm resize-none ' +
  'text-slate-700 dark:text-slate-200 ' +
  'placeholder:text-slate-400 dark:placeholder:text-slate-600 ' +
  'bg-white dark:bg-surface-900 ' +
  'border border-surface-200 dark:border-surface-700 ' +
  'focus:outline-none focus:ring-1 focus:ring-brand-500'

// ── Validation ────────────────────────────────────────────────────────────────

const requestSchema = z.object({
  title:       z.string().trim().min(1, 'Title is required'),
  description: z.string().optional(),
  module:      z.string().min(1, 'Module is required'),
  workflow_id: z.string().optional(),
  amount:      z.coerce.number({ invalid_type_error: 'Enter a valid amount' }).min(0).optional().or(z.literal('')),
  priority:    z.enum(['low', 'normal', 'high', 'urgent']),
  record_type: z.string().optional(),
})

const DEFAULT_VALUES = {
  title: '', description: '', module: '', workflow_id: '',
  amount: '', priority: 'normal', record_type: '',
}

// ── New Request Modal ─────────────────────────────────────────────────────────

function NewRequestModal({ open, onClose, onSaved, tenantId }) {
  const [workflows, setWorkflows] = useState([])
  const userId = window.__erp_user__?.id

  const {
    register, handleSubmit, reset, watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(requestSchema), defaultValues: DEFAULT_VALUES })

  const watchedModule = watch('module')

  useEffect(() => {
    if (!open) { reset(DEFAULT_VALUES); setWorkflows([]); return }
  }, [open, reset])

  useEffect(() => {
    if (!watchedModule || !tenantId) { setWorkflows([]); return }
    supabase
      .from('approval_workflows')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .eq('module', watchedModule)
      .eq('is_active', true)
      .then(({ data }) => setWorkflows(data || []))
  }, [watchedModule, tenantId])

  const onSubmit = async (data) => {
    try {
      const { data: num, error: numErr } = await supabase.rpc('generate_apr_number')
      if (numErr) throw numErr

      const { error } = await supabase.from('approval_requests').insert({
        tenant_id: tenantId, request_number: num,
        title: data.title, description: data.description || null,
        module: data.module, workflow_id: data.workflow_id || null,
        amount: data.amount !== '' ? parseFloat(data.amount) : null,
        priority: data.priority, record_type: data.record_type || null,
        status: 'pending', current_step: 1,
        requested_by: userId, updated_at: new Date().toISOString(),
      })
      if (error) throw error
      toast.success('Request submitted.')
      onSaved(); onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleClose = () => { reset(DEFAULT_VALUES); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title="New Approval Request" size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          <Input label="Title" placeholder="e.g. Q1 Budget Approval" error={errors.title?.message} {...register('title')} />

          <div>
            <Select label="Module" {...register('module')}>
              <option value="">Select module...</option>
              <option value="purchase">Purchase</option>
              <option value="sales">Sales</option>
              <option value="hr">HR</option>
              <option value="assets">Assets</option>
              <option value="accounts">Accounts</option>
            </Select>
            {errors.module && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.module.message}</p>}
          </div>

          {workflows.length > 0 && (
            <Select label="Workflow (optional)" {...register('workflow_id')}>
              <option value="">Auto-detect</option>
              {workflows.map(wf => <option key={wf.id} value={wf.id}>{wf.name}</option>)}
            </Select>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Select label="Priority" {...register('priority')}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
            <Input label="Amount (optional)" type="number" min="0" step="0.01" placeholder="0.00" error={errors.amount?.message} {...register('amount')} />
          </div>

          <Input label="Record Type (optional)" placeholder="e.g. purchase_order, leave_request" {...register('record_type')} />

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
              Description
            </label>
            <textarea rows={3} className={TEXTAREA_CLS} placeholder="Provide context for this request..." {...register('description')} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>Cancel</Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>Submit Request</Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MyRequests() {
  const { tenantId } = useTenant()
  const userId = window.__erp_user__?.id

  const [requests, setRequests] = useState([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(false)
  const [tab, setTab]           = useState('all')
  const [search, setSearch]     = useState('')
  const [showNew, setShowNew]   = useState(false)

  const fetchRequests = useCallback(async () => {
    if (!tenantId || !userId) return
    setLoading(true)
    try {
      let q = supabase
        .from('approval_requests')
        .select('*, workflow:approval_workflows(id, name)', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('requested_by', userId)
        .order('created_at', { ascending: false })

      if (tab !== 'all') q = q.eq('status', tab)
      if (search.trim())
        q = q.or(`title.ilike.%${search.trim()}%,request_number.ilike.%${search.trim()}%`)
      q = q.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      const { data, error, count } = await q
      if (error) throw error
      setRequests(data || [])
      setTotal(count || 0)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId, userId, tab, search, page])

  useEffect(() => { fetchRequests() }, [fetchRequests])
  useEffect(() => { setPage(1) }, [tab, search])

  const cancelRequest = async (id) => {
    const { error } = await supabase
      .from('approval_requests')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id).eq('requested_by', userId)
    if (error) { toast.error(error.message); return }
    toast.success('Request cancelled.')
    fetchRequests()
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Requests"
        subtitle="Track all approval requests you have submitted"
        breadcrumb="Approvals / My Requests"
        actions={
          <Button size="sm" onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4" />New Request
          </Button>
        }
      />

      {/* Tabs + search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
          {STATUS_TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${
                tab === t
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {t === 'all' ? 'All' : (STATUS[t]?.label ?? t)}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : requests.length === 0 ? (
          <EmptyState
            icon={Send}
            title="No requests found"
            description={tab === 'all' ? 'You have not submitted any approval requests yet.' : `No ${STATUS[tab]?.label?.toLowerCase() ?? tab} requests found.`}
            action={<Button size="sm" onClick={() => setShowNew(true)}><Plus className="w-4 h-4" />New Request</Button>}
          />
        ) : (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>Request #</Th><Th>Title</Th><Th>Module</Th><Th>Priority</Th>
                  <Th>Amount</Th><Th>Status</Th><Th>Step</Th><Th>Submitted</Th><Th></Th>
                </Tr>
              </Thead>
              <Tbody>
                {requests.map(req => (
                  <Tr key={req.id}>
                    <Td>
                      <Link to={`/approval/requests/${req.id}`} className="text-sm font-mono font-semibold text-brand-600 dark:text-brand-400 hover:underline">
                        {req.request_number}
                      </Link>
                    </Td>
                    <Td><span className="text-sm text-slate-700 dark:text-slate-300 max-w-[200px] block truncate">{req.title}</span></Td>
                    <Td><span className="text-xs text-slate-500 capitalize">{req.module}</span></Td>
                    <Td>
                      <Badge color={PRIORITY[req.priority]?.color || 'default'}>{PRIORITY[req.priority]?.label || req.priority}</Badge>
                    </Td>
                    <Td><span className="text-sm text-slate-700 dark:text-slate-300">{req.amount ? `$${Number(req.amount).toLocaleString()}` : '—'}</span></Td>
                    <Td><Badge color={STATUS[req.status]?.color || 'default'}>{STATUS[req.status]?.label || req.status}</Badge></Td>
                    <Td><span className="text-xs text-slate-500">{req.status === 'pending' ? `Step ${req.current_step}` : '—'}</span></Td>
                    <Td><span className="text-xs text-slate-500">{new Date(req.created_at).toLocaleDateString()}</span></Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <Link to={`/approval/requests/${req.id}`}>
                          <Button variant="ghost" size="xs"><Eye className="w-3.5 h-3.5" /></Button>
                        </Link>
                        {req.status === 'pending' && (
                          <Button variant="ghost" size="xs" onClick={() => cancelRequest(req.id)} title="Cancel">
                            <X className="w-3.5 h-3.5 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
            {totalPages > 1 && (
              <div className="p-4 border-t border-surface-200 dark:border-surface-800">
                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
              </div>
            )}
          </>
        )}
      </Card>

      <NewRequestModal open={showNew} onClose={() => setShowNew(false)} onSaved={fetchRequests} tenantId={tenantId} />
    </div>
  )
}
