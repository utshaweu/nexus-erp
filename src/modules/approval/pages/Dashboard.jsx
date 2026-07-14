import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Clock, CheckCircle2, XCircle, GitBranch, Plus } from 'lucide-react'
import { StatCard, Card, Button, PageHeader, Spinner } from '@shared/components/ui'
import { clsx } from 'clsx'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { fetchDashboardData } from '../api/approvalRequests'
import { useApprovalAction } from '../hooks/useApprovalAction'
import ApprovalCard from '../components/ApprovalCard'
import ApprovalActionModal from '../components/ApprovalActionModal'

export default function ApprovalDashboard() {
  const { tenantId } = useTenant()
  const navigate     = useNavigate()
  const userId       = window.__erp_user__?.id

  const [pending, setPending]       = useState([])
  const [recentActivity, setRecent] = useState([])
  const [stats, setStats]           = useState({ pending: 0, approved: 0, rejected: 0 })
  const [loading, setLoading]       = useState(true)

  const fetchData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const { pending, stats, recentActivity } = await fetchDashboardData(tenantId)
      setPending(pending)
      setStats(stats)
      setRecent(recentActivity)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { fetchData() }, [fetchData])

  const { actionModal, comment, setComment, submitting, openAction, closeModal, confirmAction } =
    useApprovalAction({ tenantId, userId, onDone: fetchData })

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
                  <ApprovalCard
                    key={item.id}
                    item={item}
                    onApprove={i => openAction(i, 'approve', i.totalSteps || 1)}
                    onReject={i => openAction(i, 'reject', i.totalSteps || 1)}
                  />
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
