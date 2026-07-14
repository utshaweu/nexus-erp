import { Button, Modal } from '@shared/components/ui'

export default function WorkflowDeleteModal({ open, onClose, onConfirm, workflow, loading }) {
  return (
    <Modal open={open} onClose={onClose} title="Delete Workflow" size="sm">
      <div className="space-y-4">
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20">
          <p className="text-sm text-red-700 dark:text-red-300">
            This will permanently delete <span className="font-semibold">{workflow?.name}</span> and all its steps.
            Existing requests will not be affected.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="danger" className="flex-1" loading={loading} onClick={onConfirm}>Delete Workflow</Button>
        </div>
      </div>
    </Modal>
  )
}
