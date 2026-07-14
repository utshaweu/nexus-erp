import { Button, Modal } from '@shared/components/ui'

const TEXTAREA_CLS =
  'w-full px-3 py-2 rounded-lg text-sm resize-none ' +
  'text-slate-700 dark:text-slate-200 ' +
  'placeholder:text-slate-400 dark:placeholder:text-slate-600 ' +
  'bg-white dark:bg-surface-900 ' +
  'border border-surface-200 dark:border-surface-700 ' +
  'focus:outline-none focus:ring-1 focus:ring-brand-500'

/** Shared approve/reject confirmation modal driven by useApprovalAction(). */
export default function ApprovalActionModal({ actionModal, comment, onCommentChange, submitting, onClose, onConfirm, itemLabel }) {
  const isApprove = actionModal?.action === 'approve'
  return (
    <Modal open={!!actionModal} onClose={onClose} title={isApprove ? 'Approve Request' : 'Reject Request'} size="sm">
      <div className="space-y-4">
        {itemLabel && (
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 bg-surface-50 dark:bg-surface-800 rounded-lg px-3 py-2 truncate border border-surface-200 dark:border-surface-700">
            {itemLabel}
          </p>
        )}
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {isApprove ? 'Add an optional comment before approving.' : 'Please provide a reason for rejection.'}
        </p>
        <textarea
          rows={3}
          className={TEXTAREA_CLS}
          placeholder={isApprove ? 'Optional comment...' : 'Reason for rejection (required)...'}
          value={comment}
          onChange={e => onCommentChange(e.target.value)}
        />
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant={isApprove ? 'success' : 'danger'} className="flex-1" loading={submitting} onClick={onConfirm}>
            {isApprove ? 'Approve' : 'Reject'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
