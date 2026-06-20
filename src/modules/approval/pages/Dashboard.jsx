import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckSquare, Clock, CheckCircle2, XCircle, GitBranch, Plus, Eye, Check, X } from 'lucide-react'
import { StatCard, Card, Badge, Button, PageHeader, Modal, Spinner } from '@shared/components/ui'
import { clsx } from 'clsx'
import toast from '@shared/lib/toast'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'

const TYPE_COLORS = {
  purchase:  '#f59e0b', hr:       '#ec4899', expense: '#3b82f6',
  assets:    '#f97316', accounts: '#10b981', sales:   '#8b5cf6',
}

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

// ── Approval Card ─────────────────────────────────────────────────────────────

function ApprovalCard({ item, onApprove, onReject }) {
  const typeColor = TYPE_COLORS[item.module] || '#6366f1'
  const priority  = PRIORITY[item.priority] || PRIORITY.normal

  return (
    <div className="p-4 rounded-xl border border-surface-200 dark:border-surface-800 hover:border-surface-300 dark:hover:border-surface-700 bg-white dark:bg-surface-900/50 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ backgroundColor: `${typeColor}18`, border: `1px solid ${typeColor}30` }}
          >
            <CheckSquare className="w-4 h-4" style={{ color: typeColor }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.title}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {item.request_number} · {new Date(item.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <Badge color={priority.color}>{priority.label}</Badge>
      </div>

      {item.totalSteps > 0 && (
        <div className="flex items-center gap-1.5 mb-3">
          {Array.from({ length: item.totalSteps }, (_, i) => (
            <div
              key={i}
              className={clsx('h-1.5 flex-1 rounded-full transition-all', i < item.current_step ? 'bg-brand-500' : 'bg-surface-200 dark:bg-surface-700')}
            />
          ))}
          <span className="text-xs text-slate-500 ml-1 whitespace-nowrap">Step {item.current_step}/{item.totalSteps}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        {item.amount != null ? (
          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">${Number(item.amount).toLocaleString()}</span>
        ) : (
          <span className="text-xs text-slate-400 italic">No amount</span>
        )}
        <div className="flex gap-2">
          <Link to={`/approval/requests/${item.id}`}>
            <Button variant="ghost" size="xs"><Eye className="w-3.5 h-3.5" /></Button>
          </Link>
          <Button variant="danger"  size="xs" onClick={() => onReject(item)}><X     className="w-3.5 h-3.5" /></Button>
          <Button variant="success" size="xs" onClick={() => onApprove(item)}><Check className="w-3.5 h-3.5" /></Button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ApprovalDashboard() {
  const { tenantId } = useTenant()
  const navigate     = useNavigate()
  const userId       = window.__erp_user__?.id

  const [pending, setPending]         = useState([])
  const [recentActivity, setRecent]   = useState([])
  const [stats, setStats]             = useState({ pending: 0, approved: 0, rejected: 0 })
  const [loading, setLoading]         = useState(true)
  const [actionModal, setActionModal] = useState(null)
  const [comment, setComment]         = useState('')
  const [submitting, setSubmitting]   = useState(false)

  const fetchData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      // Pending (first 6, with step count)
      const { data: pendingData } = await supabase
        .from('approval_requests')
        .select('*, workflow:approval_workflows(id, name, steps:approval_workflow_steps(id))')
        .eq('tenant_id', tenantId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(6)

      setPending((pendingData || []).map(r => ({ ...r, totalSteps: r.workflow?.steps?.length || 0 })))

      // Stats
      const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      const [pendingCnt, approvedCnt, rejectedCnt] = await Promise.all([
        supabase.from('approval_requests').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'pending'),
        supabase.from('approval_requests').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'approved').gte('updated_at', thisMonth),
        supabase.from('approval_requests').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'rejected').gte('updated_at', thisMonth),
      ])
      setStats({ pending: pendingCnt.count || 0, approved: approvedCnt.count || 0, rejected: rejectedCnt.count || 0 })

      // Recent activity
      const { data: recentData } = await supabase
        .from('approval_requests')
        .select('id, request_number, title, status, updated_at, module')
        .eq('tenant_id', tenantId)
        .in('status', ['approved', 'rejected'])
        .order('updated_at', { ascending: false })
        .limit(5)
      setRecent(recentData || [])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { fetchData() }, [fetchData])

  const openAction = (item, action) => { setActionModal({ item, action }); setComment('') }
  const closeModal = () => { setActionModal(null); setComment('') }

  const confirmAction = async () => {
    if (actionModal.action === 'reject' && !comment.trim()) {
      toast.error('Please provide a reason for rejection.')
      return
    }
    setSubmitting(true)
    try {
      const { item } = actionModal
      const totalSteps = item.totalSteps || 1

      const { error: actErr } = await supabase.from('approval_actions').insert({
        tenant_id: tenantId, request_id: item.id,
        step_number: item.current_step,
        action: actionModal.action === 'approve' ? 'approved' : 'rejected',
        actor_id: userId, comment: comment.trim() || null,
      })
      if (actErr) throw actErr

      let patch = { updated_at: new Date().toISOString() }
      if (actionModal.action === 'approve') {
        patch = item.current_step >= totalSteps
          ? { ...patch, status: 'approved' }
          : { ...patch, current_step: item.current_step + 1 }
      } else { patch.status = 'rejected' }

      const { error: updErr } = await supabase.from('approval_requests').update(patch).eq('id', item.id)
      if (updErr) throw updErr

      toast.success(actionModal.action === 'approve' ? 'Request approved.' : 'Request rejected.')
      closeModal(); fetchData()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        subtitle="Review and action pending approval requests"
        breadcrumb="Operations / Approvals"
        actions={
          <Button size="sm" onClick={() => navigate('/approval/my-requests')}>
            <Plus className="w-4 h-4" />New Request
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pending"             value={stats.pending}  icon={Clock}        color="#f59e0b" />
        <StatCard label="Approved This Month" value={stats.approved} icon={CheckCircle2} color="#10b981" />
        <StatCard label="Rejected This Month" value={stats.rejected} icon={XCircle}      color="#ef4444" />
        <StatCard label="Workflows"           value="—"              icon={GitBranch}    color="#6366f1" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Spinner /></div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Pending list */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100">
                Pending Approvals ({stats.pending})
              </h2>
              {stats.pending > 6 && (
                <Link to="/approval/pending" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">
                  View all →
                </Link>
              )}
            </div>

            {pending.length === 0 ? (
              <Card className="p-10 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                <p className="text-slate-700 dark:text-slate-300 font-semibold">All caught up!</p>
                <p className="text-slate-500 text-sm mt-1">No pending approvals.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {pending.map(item => (
                  <ApprovalCard key={item.id} item={item} onApprove={i => openAction(i, 'approve')} onReject={i => openAction(i, 'reject')} />
                ))}
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div>
            <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100 mb-4">Recent Activity</h2>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No recent activity.</p>
            ) : (
              <div className="space-y-2">
                {recentActivity.map(item => {
                  const isApproved = item.status === 'approved'
                  return (
                    <Link key={item.id} to={`/approval/requests/${item.id}`}>
                      <div className="flex items-start gap-3 p-3.5 rounded-xl border border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-900/50 hover:border-surface-300 dark:hover:border-surface-700 transition-all">
                        <div className={clsx('w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                          isApproved ? 'bg-emerald-50 dark:bg-emerald-500/20' : 'bg-red-50 dark:bg-red-500/20'
                        )}>
                          {isApproved
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            : <XCircle      className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{item.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {item.request_number} · {new Date(item.updated_at || item.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <Modal open={!!actionModal} onClose={closeModal} title={actionModal?.action === 'approve' ? 'Approve Request' : 'Reject Request'} size="sm">
        <div className="space-y-4">
          {actionModal && (
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 bg-surface-50 dark:bg-surface-800 rounded-lg px-3 py-2 truncate border border-surface-200 dark:border-surface-700">
              {actionModal.item.title}
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
