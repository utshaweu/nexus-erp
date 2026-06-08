import { useState } from 'react'
import { CheckSquare, Clock, CheckCircle2, XCircle, Send, GitBranch, Plus, Eye, Check, X } from 'lucide-react'
import { StatCard, Card, CardHeader, CardTitle, CardContent, Badge, Table, Thead, Th, Tbody, Tr, Td, Button, PageHeader, Modal } from '@shared/components/ui'
import { clsx } from 'clsx'

const PENDING = [
  { id: 'APR-001', title: 'Purchase Order PO-2024-006', type: 'purchase_order', requester: 'Bob Chen', amount: 45000, submitted: '2024-01-19', priority: 'high', currentStep: 2, totalSteps: 3 },
  { id: 'APR-002', title: 'Leave Request — 5 days', type: 'leave', requester: 'Sarah Kim', amount: null, submitted: '2024-01-20', priority: 'normal', currentStep: 1, totalSteps: 2 },
  { id: 'APR-003', title: 'Expense Report Q4-2023', type: 'expense', requester: 'Carlos M.', amount: 8200, submitted: '2024-01-18', priority: 'normal', currentStep: 1, totalSteps: 2 },
  { id: 'APR-004', title: 'Asset Disposal AST-089', type: 'asset', requester: 'Alex Thompson', amount: 12000, submitted: '2024-01-17', priority: 'low', currentStep: 2, totalSteps: 3 },
]

const RECENT_HISTORY = [
  { id: 'APR-095', title: 'Sales Contract — Bright Corp', type: 'contract', requester: 'Alice Wang', status: 'approved', date: '2024-01-16', approver: 'James Director' },
  { id: 'APR-094', title: 'Hiring Request — Senior Dev', type: 'hiring', requester: 'HR Manager', status: 'rejected', date: '2024-01-15', approver: 'Jane VP' },
  { id: 'APR-093', title: 'Budget Amendment Q4', type: 'budget', requester: 'Finance Team', status: 'approved', date: '2024-01-14', approver: 'James Director' },
]

const TYPE_COLORS = {
  purchase_order: '#f59e0b', leave: '#ec4899', expense: '#3b82f6',
  asset: '#f97316', contract: '#10b981', hiring: '#8b5cf6', budget: '#6366f1',
}

const PRIORITY = {
  high: { label: 'High', color: 'red' },
  normal: { label: 'Normal', color: 'blue' },
  low: { label: 'Low', color: 'default' },
}

function ApprovalCard({ item, onApprove, onReject }) {
  return (
    <div className="p-4 rounded-xl border border-surface-800 hover:border-surface-700 bg-surface-900/50 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ backgroundColor: `${TYPE_COLORS[item.type]}18`, border: `1px solid ${TYPE_COLORS[item.type]}30` }}>
            <CheckSquare className="w-4 h-4" style={{ color: TYPE_COLORS[item.type] }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100">{item.title}</p>
            <p className="text-xs text-slate-500 mt-0.5">By {item.requester} · {item.submitted}</p>
          </div>
        </div>
        <Badge color={PRIORITY[item.priority].color}>{PRIORITY[item.priority].label}</Badge>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-1.5 mb-3">
        {Array.from({ length: item.totalSteps }, (_, i) => (
          <div key={i} className={clsx('h-1.5 flex-1 rounded-full transition-all', i < item.currentStep ? 'bg-brand-500' : 'bg-surface-700')} />
        ))}
        <span className="text-xs text-slate-500 ml-1 whitespace-nowrap">Step {item.currentStep}/{item.totalSteps}</span>
      </div>

      <div className="flex items-center justify-between">
        {item.amount ? (
          <span className="text-sm font-bold text-slate-200">${item.amount.toLocaleString()}</span>
        ) : (
          <span className="text-xs text-slate-500 italic">No amount</span>
        )}
        <div className="flex gap-2">
          <Button variant="ghost" size="xs"><Eye className="w-3.5 h-3.5" /></Button>
          <Button variant="danger" size="xs" onClick={() => onReject(item.id)}>
            <X className="w-3.5 h-3.5" />
          </Button>
          <Button variant="success" size="xs" onClick={() => onApprove(item.id)}>
            <Check className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function ApprovalDashboard() {
  const [pending, setPending] = useState(PENDING)
  const [showComment, setShowComment] = useState(null) // { id, action }
  const [comment, setComment] = useState('')

  const handleApprove = (id) => setShowComment({ id, action: 'approve' })
  const handleReject = (id) => setShowComment({ id, action: 'reject' })

  const confirmAction = () => {
    setPending(prev => prev.filter(p => p.id !== showComment.id))
    setShowComment(null)
    setComment('')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        subtitle="Review and action pending approval requests"
        breadcrumb="Operations / Approvals"
        actions={
          <Button size="sm">
            <Plus className="w-4 h-4" />New Request
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pending" value={pending.length} icon={Clock} color="#f59e0b" />
        <StatCard label="Approved This Month" value="24" icon={CheckCircle2} color="#10b981" />
        <StatCard label="Rejected" value="3" icon={XCircle} color="#ef4444" />
        <StatCard label="Avg. Approval Time" value="4.2h" icon={GitBranch} color="#6366f1" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Pending approvals */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-slate-100">Pending My Approval ({pending.length})</h2>
          </div>
          {pending.length === 0 ? (
            <Card className="p-10 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
              <p className="text-slate-300 font-semibold">All caught up!</p>
              <p className="text-slate-500 text-sm mt-1">No pending approvals.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {pending.map(item => (
                <ApprovalCard key={item.id} item={item} onApprove={handleApprove} onReject={handleReject} />
              ))}
            </div>
          )}
        </div>

        {/* History */}
        <div>
          <h2 className="font-display font-semibold text-slate-100 mb-4">Recent Activity</h2>
          <div className="space-y-2">
            {RECENT_HISTORY.map(item => (
              <div key={item.id} className="flex items-start gap-3 p-3.5 rounded-xl border border-surface-800 bg-surface-900/50">
                <div className={clsx('w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', item.status === 'approved' ? 'bg-emerald-500/20' : 'bg-red-500/20')}>
                  {item.status === 'approved'
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    : <XCircle className="w-3.5 h-3.5 text-red-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-200 truncate">{item.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">By {item.approver} · {item.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action confirmation modal */}
      <Modal
        open={!!showComment}
        onClose={() => { setShowComment(null); setComment('') }}
        title={showComment?.action === 'approve' ? '✅ Approve Request' : '❌ Reject Request'}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            {showComment?.action === 'approve'
              ? 'Add a comment (optional) before approving.'
              : 'Please provide a reason for rejection.'}
          </p>
          <textarea
            rows={3}
            className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 bg-surface-900 border border-surface-700 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
            placeholder={showComment?.action === 'approve' ? 'Optional comment...' : 'Reason for rejection...'}
            value={comment}
            onChange={e => setComment(e.target.value)}
          />
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => { setShowComment(null); setComment('') }}>
              Cancel
            </Button>
            <Button
              variant={showComment?.action === 'approve' ? 'success' : 'danger'}
              className="flex-1"
              onClick={confirmAction}
            >
              {showComment?.action === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
