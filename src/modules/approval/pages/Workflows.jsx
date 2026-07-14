import { useState, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { Button, PageHeader, Spinner } from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { fetchWorkflows, toggleWorkflowActive, deleteWorkflow } from '../api/approvalWorkflows'
import WorkflowTemplates from '../components/WorkflowTemplates'
import WorkflowCard from '../components/WorkflowCard'
import WorkflowModal from '../components/WorkflowModal'
import WorkflowDeleteModal from '../components/WorkflowDeleteModal'

export default function Workflows() {
  const { tenantId } = useTenant()

  const [workflows, setWorkflows]       = useState([])
  const [loading, setLoading]           = useState(false)
  const [showModal, setShowModal]       = useState(false)
  const [editTarget, setEditTarget]     = useState(null)
  const [prefill, setPrefill]           = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]         = useState(false)

  const loadWorkflows = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      setWorkflows(await fetchWorkflows(tenantId))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { loadWorkflows() }, [loadWorkflows])

  const openNew = () => { setEditTarget(null); setPrefill(null); setShowModal(true) }
  const openEdit = (wf) => { setEditTarget(wf); setPrefill(null); setShowModal(true) }
  const useTemplate = (tpl) => { setEditTarget(null); setPrefill(tpl); setShowModal(true) }
  const closeModal  = () => { setShowModal(false); setEditTarget(null); setPrefill(null) }

  const handleToggle = async (wf) => {
    try {
      await toggleWorkflowActive(wf)
      toast.success(wf.is_active ? 'Workflow deactivated.' : 'Workflow activated.')
      loadWorkflows()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteWorkflow(deleteTarget.id)
      toast.success('Workflow deleted.')
      setDeleteTarget(null); loadWorkflows()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval Workflows"
        subtitle="Configure multi-level approval processes for your ERP documents"
        breadcrumb="Approvals / Workflows"
        actions={
          !loading && workflows.length > 0 && (
            <PermissionGate action="create" moduleId="approval">
              <Button size="sm" onClick={openNew}>
                <Plus className="w-4 h-4" />New Workflow
              </Button>
            </PermissionGate>
          )
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner />
        </div>
      ) : workflows.length === 0 ? (
        <WorkflowTemplates onCreate={openNew} onUseTemplate={useTemplate} />
      ) : (
        <>
          {/* Summary row */}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-500">{workflows.length} workflow{workflows.length !== 1 ? 's' : ''}</span>
            <span className="w-1 h-1 rounded-full bg-surface-300 dark:bg-surface-600" />
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              {workflows.filter(w => w.is_active).length} active
            </span>
            {workflows.some(w => !w.is_active) && (
              <>
                <span className="w-1 h-1 rounded-full bg-surface-300 dark:bg-surface-600" />
                <span className="text-slate-400">{workflows.filter(w => !w.is_active).length} inactive</span>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {workflows.map(wf => (
              <WorkflowCard key={wf.id} workflow={wf} onEdit={openEdit} onToggle={handleToggle} onDelete={setDeleteTarget} />
            ))}
          </div>
        </>
      )}

      <WorkflowModal
        open={showModal} onClose={closeModal} onSaved={loadWorkflows}
        tenantId={tenantId} workflow={editTarget} prefill={prefill}
      />
      <WorkflowDeleteModal
        open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete} workflow={deleteTarget} loading={deleting}
      />
    </div>
  )
}
