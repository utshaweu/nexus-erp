import { useState } from 'react'
import toast from '@shared/lib/toast'
import { actOnApprovalRequest } from '@shared/lib/approvalWorkflow'

/**
 * Shared approve/reject modal state + submit logic for Dashboard,
 * PendingApprovals and ApprovalDetail, so every page resolves a decision
 * identically (and stays in sync via applyApprovalOutcome).
 *
 * `totalSteps` may be a number (already known) or a function returning one
 * (or a promise of one) — PendingApprovals only knows it after an extra
 * lookup, resolved lazily on confirm instead of on open.
 */
export function useApprovalAction({ tenantId, userId, onDone }) {
  const [actionModal, setActionModal] = useState(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const openAction = (request, action, totalSteps = 1) => {
    setActionModal({ request, action, totalSteps })
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
      const totalSteps = typeof actionModal.totalSteps === 'function'
        ? await actionModal.totalSteps()
        : actionModal.totalSteps

      await actOnApprovalRequest({
        tenantId, request: actionModal.request, totalSteps,
        action: actionModal.action, actorId: userId, comment,
      })

      toast.success(actionModal.action === 'approve' ? 'Request approved.' : 'Request rejected.')
      closeModal()
      onDone?.()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return { actionModal, comment, setComment, submitting, openAction, closeModal, confirmAction }
}
