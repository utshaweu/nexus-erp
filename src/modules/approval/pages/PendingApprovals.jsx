import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Search, Check, X, Eye } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td,
  PageHeader, Card, EmptyState, Spinner,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { PAGE_SIZE_TABLE as PAGE_SIZE } from '@shared/lib/constants'
import { fetchPendingRequests, fetchWorkflowStepCount } from '../api/approvalRequests'
import { useApprovalAction } from '../hooks/useApprovalAction'
import { useApprovalModuleOptions } from '../hooks/useApprovalModuleOptions'
import ApprovalActionModal from '../components/ApprovalActionModal'

const PRIORITY = {
  low:    { label: 'Low',    color: 'default' },
  normal: { label: 'Normal', color: 'blue'    },
  high:   { label: 'High',   color: 'yellow'  },
  urgent: { label: 'Urgent', color: 'red'     },
}

const SELECT_CLS =
  'px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-200 ' +
  'bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 ' +
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
  const moduleOptions = useApprovalModuleOptions()

  const fetchRequests = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const { requests, total } = await fetchPendingRequests(tenantId, {
        search, priority: priorityFilter, module: moduleFilter, page, pageSize: PAGE_SIZE,
      })
      setRequests(requests)
      setTotal(total)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId, search, priorityFilter, moduleFilter, page])

  useEffect(() => { fetchRequests() }, [fetchRequests])
  useEffect(() => { setPage(1) }, [search, priorityFilter, moduleFilter])

  const { actionModal, comment, setComment, submitting, openAction, closeModal, confirmAction } =
    useApprovalAction({ tenantId, userId, onDone: fetchRequests })

  const openRequestAction = (req, action) => {
    openAction(req, action, () => req.workflow_id ? fetchWorkflowStepCount(req.workflow_id) : 1)
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
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
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
            <option value="all">All Modules</option>
            {moduleOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
                          <Button variant="danger" size="xs" onClick={() => openRequestAction(req, 'reject')}><X className="w-3.5 h-3.5" /></Button>
                          <Button variant="success" size="xs" onClick={() => openRequestAction(req, 'approve')}><Check className="w-3.5 h-3.5" /></Button>
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

      <ApprovalActionModal
        actionModal={actionModal}
        comment={comment}
        onCommentChange={setComment}
        submitting={submitting}
        onClose={closeModal}
        onConfirm={confirmAction}
        itemLabel={actionModal?.request?.title}
      />
    </div>
  )
}
