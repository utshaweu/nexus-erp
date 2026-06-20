import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle2, XCircle, Clock,
  Check, X, AlertCircle, User,
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  Button, Badge, Card, CardHeader, CardTitle, CardContent,
  PageHeader, Modal, Spinner,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import toast from '@shared/lib/toast'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  pending:   { label: 'Pending',   color: 'yellow',  Icon: Clock        },
  approved:  { label: 'Approved',  color: 'green',   Icon: CheckCircle2 },
  rejected:  { label: 'Rejected',  color: 'red',     Icon: XCircle      },
  cancelled: { label: 'Cancelled', color: 'default', Icon: XCircle      },
}

const PRIORITY = {
  low:    { label: 'Low',    color: 'default' },
  normal: { label: 'Normal', color: 'blue'    },
  high:   { label: 'High',   color: 'yellow'  },
  urgent: { label: 'Urgent', color: 'red'     },
}

const ACTION_CFG = {
  approved:  { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/20', Icon: CheckCircle2 },
  rejected:  { text: 'text-red-600 dark:text-red-400',         bg: 'bg-red-50 dark:bg-red-500/20',         Icon: XCircle      },
  delegated: { text: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-50 dark:bg-blue-500/20',       Icon: User         },
}

const TEXTAREA_CLS =
  'w-full px-3 py-2 rounded-lg text-sm resize-none ' +
  'text-slate-700 dark:text-slate-200 ' +
  'placeholder:text-slate-400 dark:placeholder:text-slate-600 ' +
  'bg-white dark:bg-surface-900 ' +
  'border border-surface-200 dark:border-surface-700 ' +
  'focus:outline-none focus:ring-1 focus:ring-brand-500'

function actorName(actor) {
  if (!actor) return 'Unknown'
  return actor.raw_user_meta_data?.full_name || actor.email || actor.id
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBanner({ request }) {
  const cfg = STATUS_CFG[request.status] || STATUS_CFG.pending
  const { Icon } = cfg
  const colors = {
    approved:  { icon: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/20' },
    rejected:  { icon: 'text-red-600 dark:text-red-400',         bg: 'bg-red-50 dark:bg-red-500/20'         },
    pending:   { icon: 'text-amber-600 dark:text-amber-400',      bg: 'bg-amber-50 dark:bg-amber-500/20'     },
    cancelled: { icon: 'text-slate-500',                          bg: 'bg-surface-100 dark:bg-surface-800'   },
  }
  const c = colors[request.status] || colors.pending
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={clsx('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', c.bg)}>
          <Icon className={clsx('w-5 h-5', c.icon)} />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            Status: <Badge color={cfg.color}>{cfg.label}</Badge>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Submitted {new Date(request.created_at).toLocaleString()}
            {request.workflow && ` · Workflow: ${request.workflow.name}`}
          </p>
        </div>
      </div>
    </Card>
  )
}

function DetailGrid({ request }) {
  return (
    <Card>
      <CardHeader><CardTitle>Request Details</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <p className="text-xs text-slate-500 mb-1">Request #</p>
            <p className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200">{request.request_number}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Module</p>
            <p className="text-sm text-slate-700 dark:text-slate-300 capitalize">{request.module}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Priority</p>
            <Badge color={PRIORITY[request.priority]?.color}>{PRIORITY[request.priority]?.label || request.priority}</Badge>
          </div>
          {request.amount != null && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Amount</p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">${Number(request.amount).toLocaleString()}</p>
            </div>
          )}
          {request.record_type && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Record Type</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">{request.record_type}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-slate-500 mb-1">Current Step</p>
            <p className="text-sm text-slate-700 dark:text-slate-300">Step {request.current_step}</p>
          </div>
        </div>
        {request.description && (
          <div>
            <p className="text-xs text-slate-500 mb-1">Description</p>
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{request.description}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AuditTrail({ actions }) {
  return (
    <Card>
      <CardHeader><CardTitle>Approval History</CardTitle></CardHeader>
      <CardContent>
        {actions.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No actions taken yet.</p>
        ) : (
          <div className="space-y-3">
            {actions.map(act => {
              const cfg = ACTION_CFG[act.action] || ACTION_CFG.approved
              const { Icon } = cfg
              return (
                <div key={act.id} className="flex items-start gap-3 p-3 rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
                  <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', cfg.bg)}>
                    <Icon className={clsx('w-4 h-4', cfg.text)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 capitalize">{act.action}</p>
                      <span className="text-xs text-slate-500 flex-shrink-0">{new Date(act.acted_at).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Step {act.step_number} · By {actorName(act.actor)}</p>
                    {act.comment && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 italic">"{act.comment}"</p>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function WorkflowSidebar({ steps, request }) {
  const isFullyApproved = request.status === 'approved'
  return (
    <Card>
      <CardHeader><CardTitle>Approval Workflow</CardTitle></CardHeader>
      <CardContent>
        {steps.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No workflow configured.</p>
        ) : (
          <div className="space-y-3">
            {steps.map(step => {
              const isDone    = isFullyApproved || (request.current_step > step.step_order && request.status !== 'pending')
              const isCurrent = request.current_step === step.step_order && request.status === 'pending'
              return (
                <div key={step.id} className="flex items-start gap-3">
                  <div className={clsx(
                    'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold border',
                    isDone    ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-300 dark:border-emerald-500/40 text-emerald-600 dark:text-emerald-400' :
                    isCurrent ? 'bg-brand-50 dark:bg-brand-600/20 border-brand-300 dark:border-brand-600/40 text-brand-600 dark:text-brand-400' :
                                'bg-surface-100 dark:bg-surface-800 border-surface-300 dark:border-surface-700 text-slate-400'
                  )}>
                    {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : step.step_order}
                  </div>
                  <div className="flex-1">
                    <p className={clsx('text-sm font-medium',
                      isDone    ? 'text-emerald-600 dark:text-emerald-400' :
                      isCurrent ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'
                    )}>{step.step_name}</p>
                    <p className="text-xs text-slate-500">{step.approver_role}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{step.approval_type === 'all' ? 'All must approve' : 'Any can approve'}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ApprovalDetail() {
  const { id }       = useParams()
  const { tenantId } = useTenant()
  const navigate     = useNavigate()
  const userId       = window.__erp_user__?.id

  const [request, setRequest]         = useState(null)
  const [steps, setSteps]             = useState([])
  const [actions, setActions]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [actionModal, setActionModal] = useState(null)
  const [comment, setComment]         = useState('')
  const [submitting, setSubmitting]   = useState(false)

  const fetchData = useCallback(async () => {
    if (!id || !tenantId) return
    setLoading(true)
    try {
      const { data: req, error: reqErr } = await supabase
        .from('approval_requests')
        .select('*, workflow:approval_workflows(id, name)')
        .eq('id', id).eq('tenant_id', tenantId).single()
      if (reqErr) throw reqErr
      setRequest(req)

      if (req.workflow_id) {
        const { data: wfSteps } = await supabase
          .from('approval_workflow_steps').select('*')
          .eq('workflow_id', req.workflow_id).order('step_order', { ascending: true })
        setSteps(wfSteps || [])
      }

      const { data: acts } = await supabase
        .from('approval_actions')
        .select('*, actor:actor_id(id, email, raw_user_meta_data)')
        .eq('request_id', id).order('acted_at', { ascending: true })
      setActions(acts || [])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [id, tenantId])

  useEffect(() => { fetchData() }, [fetchData])

  const closeModal = () => { setActionModal(null); setComment('') }

  const confirmAction = async () => {
    if (actionModal.action === 'reject' && !comment.trim()) {
      toast.error('Rejection reason is required.')
      return
    }
    setSubmitting(true)
    try {
      const totalSteps = steps.length || 1
      const { error: actErr } = await supabase.from('approval_actions').insert({
        tenant_id: tenantId, request_id: id,
        step_number: request.current_step,
        action: actionModal.action === 'approve' ? 'approved' : 'rejected',
        actor_id: userId, comment: comment.trim() || null,
      })
      if (actErr) throw actErr

      let patch = { updated_at: new Date().toISOString() }
      if (actionModal.action === 'approve') {
        patch = request.current_step >= totalSteps
          ? { ...patch, status: 'approved' }
          : { ...patch, current_step: request.current_step + 1 }
      } else { patch.status = 'rejected' }

      const { error: updErr } = await supabase.from('approval_requests').update(patch).eq('id', id)
      if (updErr) throw updErr

      toast.success(actionModal.action === 'approve' ? 'Request approved.' : 'Request rejected.')
      closeModal(); fetchData()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center py-24"><Spinner /></div>

  if (!request) return (
    <div className="space-y-6">
      <PageHeader title="Request Not Found" breadcrumb="Approvals / Detail" />
      <Card className="p-10 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-slate-700 dark:text-slate-300 font-semibold">This request does not exist or you do not have access.</p>
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => navigate(-1)}>Go Back</Button>
      </Card>
    </div>
  )

  const isPending = request.status === 'pending'

  return (
    <div className="space-y-6">
      <PageHeader
        title={request.request_number}
        subtitle={request.title}
        breadcrumb="Approvals / Detail"
        actions={
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4" />Back
            </Button>
            {isPending && (
              <PermissionGate action="approve" moduleId="approval">
                <Button variant="danger" size="sm" onClick={() => { setActionModal({ action: 'reject' }); setComment('') }}>
                  <X className="w-4 h-4" />Reject
                </Button>
                <Button variant="success" size="sm" onClick={() => { setActionModal({ action: 'approve' }); setComment('') }}>
                  <Check className="w-4 h-4" />Approve
                </Button>
              </PermissionGate>
            )}
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <StatusBanner request={request} />
          <DetailGrid   request={request} />
          <AuditTrail   actions={actions} />
        </div>
        <div><WorkflowSidebar steps={steps} request={request} /></div>
      </div>

      <Modal open={!!actionModal} onClose={closeModal} title={actionModal?.action === 'approve' ? 'Approve Request' : 'Reject Request'} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {actionModal?.action === 'approve' ? 'Add an optional comment before approving.' : 'Please provide a reason for rejection.'}
          </p>
          <textarea
            rows={3}
            className={TEXTAREA_CLS}
            placeholder={actionModal?.action === 'approve' ? 'Optional comment...' : 'Reason (required)...'}
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
