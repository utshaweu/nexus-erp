import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Search, Check, X, Eye } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td,
  PageHeader, Card, Modal, EmptyState, Spinner,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import { PAGE_SIZE_TABLE as PAGE_SIZE } from '@shared/lib/constants'

const PRIORITY = {
  low:    { label: 'Low',    color: 'default' },
  normal: { label: 'Normal', color: 'blue'    },
  high:   { label: 'High',   color: 'yellow'  },
  urgent: { label: 'Urgent', color: 'red'     },
}

const MODULE_OPTIONS = [
  { value: 'all',      label: 'All Modules' },
  { value: 'purchase', label: 'Purchase'    },
  { value: 'sales',    label: 'Sales'       },
  { value: 'hr',       label: 'HR'          },
  { value: 'assets',   label: 'Assets'      },
  { value: 'accounts', label: 'Accounts'    },
]

const SELECT_CLS =
  'px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-200 ' +
  'bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 ' +
  'focus:outline-none focus:ring-1 focus:ring-brand-500'

const TEXTAREA_CLS =
  'w-full px-3 py-2 rounded-lg text-sm resize-none ' +
  'text-slate-700 dark:text-slate-200 ' +
  'placeholder:text-slate-400 dark:placeholder:text-slate-600 ' +
  'bg-white dark:bg-surface-900 ' +
  'border border-surface-200 dark:border-surface-700 ' +
  'focus:outline-none focus:ring-1 focus:ring-brand-500'

export default function PendingApprovals() {
  const { tenantId } = useTenant()
  const userId = window.__erp_user__?.id

  const [requests, setRequests]       = useState([])
  const [total, setTotal]             = useState(0)
  const [page, setPage]               = useState(1)
  const [loading, setLoading]         = useState(false)
  const [search, setSearch]           = useState('')
  const [priorityFilter, setPriority] = useState('all')
  const [moduleFilter, setModule]     = useState('all')
  const [actionModal, setActionModal] = useState(null)
  const [comment, setComment]         = useState('')
  const [submitting, setSubmitting]   = useState(false)

  const fetchRequests = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      let q = supabase
        .from('approval_requests')
        .select('*, workflow:approval_workflows(id, name)', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (search.trim())
        q = q.or(`title.ilike.%${search.trim()}%,request_number.ilike.%${search.trim()}%`)
      if (priorityFilter !== 'all') q = q.eq('priority', priorityFilter)
      if (moduleFilter  !== 'all') q = q.eq('module', moduleFilter)
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
  }, [tenantId, search, priorityFilter, moduleFilter, page])

  useEffect(() => { fetchRequests() }, [fetchRequests])
  useEffect(() => { setPage(1) }, [search, priorityFilter, moduleFilter])

  const openAction = (req, action) => {
    setActionModal({ id: req.id, action, title: req.title, workflowId: req.workflow_id, currentStep: req.current_step })
    setComment('')
  }
  const closeModal = () => { setActionModal(null); setComment('') }

  const confirmAction = async () => {
    if (actionModal.action === 'reject' && !comment.trim()) {
      toast.error('Please provide a reason for rejection.')
      return
    }
    setSubmitting(true)
    try {
      let totalSteps = 1
      if (actionModal.workflowId) {
        const { count } = await supabase
          .from('approval_workflow_steps')
          .select('id', { count: 'exact', head: true })
          .eq('workflow_id', actionModal.workflowId)
        totalSteps = count || 1
      }
      const { error: actErr } = await supabase.from('approval_actions').insert({
        tenant_id: tenantId, request_id: actionModal.id,
        step_number: actionModal.currentStep,
        action: actionModal.action === 'approve' ? 'approved' : 'rejected',
        actor_id: userId, comment: comment.trim() || null,
      })
      if (actErr) throw actErr

      let patch = { updated_at: new Date().toISOString() }
      if (actionModal.action === 'approve') {
        patch = actionModal.currentStep >= totalSteps
          ? { ...patch, status: 'approved' }
          : { ...patch, current_step: actionModal.currentStep + 1 }
      } else { patch.status = 'rejected' }

      const { error: updErr } = await supabase.from('approval_requests').update(patch).eq('id', actionModal.id)
      if (updErr) throw updErr

      toast.success(actionModal.action === 'approve' ? 'Request approved.' : 'Request rejected.')
      closeModal(); fetchRequests()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pending Approvals"
        subtitle="Review and action requests waiting for approval"
        breadcrumb="Approvals / Pending"
      />

      {/* Filter bar */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title or request #..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 focus:outline-none focus:ring-1 focus:ring-brand-500`}
            />
          </div>
          <select value={priorityFilter} onChange={e => setPriority(e.target.value)} className={SELECT_CLS}>
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
          <select value={moduleFilter} onChange={e => setModule(e.target.value)} className={SELECT_CLS}>
            {MODULE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </Card>

      {/* List */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : requests.length === 0 ? (
          <EmptyState icon={Clock} title="No pending approvals" description="All caught up! There are no requests waiting for approval." />
        ) : (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>Request</Th><Th>Module</Th><Th>Workflow</Th><Th>Priority</Th>
                  <Th>Amount</Th><Th>Step</Th><Th>Submitted</Th><Th></Th>
                </Tr>
              </Thead>
              <Tbody>
                {requests.map(req => (
                  <Tr key={req.id}>
                    <Td>
                      <Link to={`/approval/requests/${req.id}`} className="text-sm font-semibold text-brand-600 dark:text-brand-400 hover:underline">
                        {req.request_number}
                      </Link>
                      <p className="text-xs text-slate-500 mt-0.5 max-w-[220px] truncate">{req.title}</p>
                    </Td>
                    <Td><span className="text-xs text-slate-500 capitalize">{req.module}</span></Td>
                    <Td><span className="text-xs text-slate-500">{req.workflow?.name || '—'}</span></Td>
                    <Td>
                      <Badge color={PRIORITY[req.priority]?.color || 'default'}>
                        {PRIORITY[req.priority]?.label || req.priority}
                      </Badge>
                    </Td>
                    <Td><span className="text-sm text-slate-700 dark:text-slate-300">{req.amount ? `$${Number(req.amount).toLocaleString()}` : '—'}</span></Td>
                    <Td><span className="text-xs text-slate-500">Step {req.current_step}</span></Td>
                    <Td><span className="text-xs text-slate-500">{new Date(req.created_at).toLocaleDateString()}</span></Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <Link to={`/approval/requests/${req.id}`}>
                          <Button variant="ghost" size="xs"><Eye className="w-3.5 h-3.5" /></Button>
                        </Link>
                        <PermissionGate action="approve" moduleId="approval">
                          <Button variant="danger" size="xs" onClick={() => openAction(req, 'reject')}><X className="w-3.5 h-3.5" /></Button>
                          <Button variant="success" size="xs" onClick={() => openAction(req, 'approve')}><Check className="w-3.5 h-3.5" /></Button>
                        </PermissionGate>
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

      <Modal open={!!actionModal} onClose={closeModal} title={actionModal?.action === 'approve' ? 'Approve Request' : 'Reject Request'} size="sm">
        <div className="space-y-4">
          {actionModal && (
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 bg-surface-50 dark:bg-surface-800 rounded-lg px-3 py-2 truncate border border-surface-200 dark:border-surface-700">
              {actionModal.title}
            </p>
          )}
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {actionModal?.action === 'approve' ? 'Add an optional comment before approving.' : 'Please provide a reason for rejection.'}
          </p>
          <textarea
            rows={3}
            className={TEXTAREA_CLS}
            placeholder={actionModal?.action === 'approve' ? 'Optional comment...' : 'Reason for rejection (required)...'}
            value={comment}
            onChange={e => setComment(e.target.value)}
          />
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={closeModal}>Cancel</Button>
            <Button variant={actionModal?.action === 'approve' ? 'success' : 'danger'} className="flex-1" loading={submitting} onClick={confirmAction}>
              {actionModal?.action === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
