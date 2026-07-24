import { useState, useEffect } from 'react'
import { Button, Modal, Input } from '@shared/components/ui'

/** Shared by Movement and Leave — identical reject flow, only the modal title differs. */
export default function RejectModal({ open, onClose, onConfirm, title }) {
  const [reason, setReason] = useState('')
  const [busy,   setBusy]   = useState(false)

  useEffect(() => { if (open) setReason('') }, [open])

  const handleConfirm = async () => {
    setBusy(true)
    await onConfirm(reason)
    setBusy(false)
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <Input
          label="Rejection Reason (optional)"
          placeholder="Provide a reason for rejection"
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="danger" className="flex-1" loading={busy} onClick={handleConfirm}>
            Reject
          </Button>
        </div>
      </div>
    </Modal>
  )
}
