import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertCircle, Check, X } from 'lucide-react'
import { Button, Card, PageHeader, Spinner } from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { fetchRequestDetail } from '../api/approvalRequests'
import { useApprovalAction } from '../hooks/useApprovalAction'
import ApprovalActionModal from '../components/ApprovalActionModal'
import RequestStatusBanner from '../components/RequestStatusBanner'
import RequestDetailGrid from '../components/RequestDetailGrid'
import RequestAuditTrail from '../components/RequestAuditTrail'
import RequestWorkflowSidebar from '../components/RequestWorkflowSidebar'

export default function ApprovalDetail() {
  const { id }       = useParams()
  const { tenantId } = useTenant()
  const navigate     = useNavigate()
  const userId       = window.__erp_user__?.id

  const [request, setRequest] = useState(null)
  const [steps, setSteps]     = useState([])
  const [actions, setActions] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!id || !tenantId) return
    setLoading(true)
    try {
      const { request, steps, actions } = await fetchRequestDetail(id, tenantId)
      setRequest(request)
      setSteps(steps)
      setActions(actions)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [id, tenantId])

  useEffect(() => { fetchData() }, [fetchData])

  const { actionModal, comment, setComment, submitting, openAction, closeModal, confirmAction } =
    useApprovalAction({ tenantId, userId, onDone: fetchData })

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
                <Button variant="danger" size="sm" onClick={() => openAction(request, 'reject', steps.length || 1)}>
                  <X className="w-4 h-4" />Reject
                </Button>
                <Button variant="success" size="sm" onClick={() => openAction(request, 'approve', steps.length || 1)}>
                  <Check className="w-4 h-4" />Approve
                </Button>
              </PermissionGate>
            )}
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <RequestStatusBanner request={request} />
          <RequestDetailGrid   request={request} />
          <RequestAuditTrail   actions={actions} />
        </div>
        <div><RequestWorkflowSidebar steps={steps} request={request} /></div>
      </div>

      <ApprovalActionModal
        actionModal={actionModal}
        comment={comment}
        onCommentChange={setComment}
        submitting={submitting}
        onClose={closeModal}
        onConfirm={confirmAction}
      />
    </div>
  )
}
