import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { PageHeader, Card, Button, Spinner } from '@shared/components/ui'
import { CheckCircle, XCircle, Printer, ArrowLeft, Send, ShoppingCart } from 'lucide-react'
import { useTenant } from '@core/tenant/TenantContext'
import toast from '@shared/lib/toast'
import PermissionGate from '@shared/components/PermissionGate'
import { RFQ_STATUS as STATUS_BADGE } from '@shared/lib/constants'
import {
  fetchRFQDetail, deleteRFQLine, updateRFQStatus, convertRfqToPurchaseOrder,
} from '../api/rfqs'
import RFQLineModal from '../components/RFQLineModal'
import RFQLinesTable from '../components/RFQLinesTable'
import RFQInfoCard from '../components/RFQInfoCard'
import VendorInfoCard from '../components/VendorInfoCard'

export default function RFQDetail() {
  const { id }       = useParams()
  const navigate     = useNavigate()
  const { tenantId } = useTenant()
  const [rfq,           setRfq]           = useState(null)
  const [lines,         setLines]         = useState([])
  const [loading,       setLoading]       = useState(true)
  const [converting,    setConverting]    = useState(false)
  const [showLineModal, setShowLineModal] = useState(false)
  const [editingLine,   setEditingLine]   = useState(null)

  const canEditLines = rfq && rfq.status === 'draft'

  const loadRfq = useCallback(async () => {
    if (!id || !tenantId) return
    setLoading(true)
    try {
      const { rfq, lines } = await fetchRFQDetail(id, tenantId)
      setRfq(rfq)
      setLines(lines)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [id, tenantId])

  useEffect(() => { loadRfq() }, [loadRfq])

  const handleDeleteLine = async (lineId) => {
    if (!window.confirm('Remove this line item?')) return
    try {
      await deleteRFQLine(lineId)
      toast.success('Line removed.')
      loadRfq()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const openAddLine    = () => { setEditingLine(null); setShowLineModal(true) }
  const openEditLine   = (l) => { setEditingLine(l); setShowLineModal(true) }
  const closeLineModal = () => { setShowLineModal(false); setEditingLine(null) }

  const updateStatus = async (status) => {
    try {
      await updateRFQStatus(id, status)
      toast.success(`RFQ marked as ${STATUS_BADGE[status]?.label || status}.`)
      setRfq(r => ({ ...r, status }))
    } catch (err) {
      toast.error(err.message)
    }
  }

  const convertToPO = async () => {
    if (!window.confirm('Convert this RFQ to a purchase order?')) return
    setConverting(true)
    try {
      const { orderNumber, poId } = await convertRfqToPurchaseOrder(tenantId, rfq, lines)
      toast.success(`Converted to ${orderNumber}.`)
      navigate(`/purchase/orders/${poId}`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setConverting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="w-6 h-6" />
      </div>
    )
  }

  if (!rfq) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 mb-2">RFQ not found.</p>
        <Link to="/purchase/rfq" className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 text-sm">
          ← Back to RFQs
        </Link>
      </div>
    )
  }

  const s = STATUS_BADGE[rfq.status] || STATUS_BADGE.draft

  return (
    <div className="space-y-6">
      <PageHeader
        title={rfq.rfq_number}
        subtitle={`Vendor: ${rfq.vendor?.name || '—'}`}
        breadcrumb="Purchase / RFQ"
        actions={
          <div className="flex items-center gap-2 print:hidden">
            <Link to="/purchase/rfq">
              <Button variant="secondary" size="sm">
                <ArrowLeft className="w-4 h-4" />Back
              </Button>
            </Link>

            <PermissionGate action="edit" moduleId="purchase">
              {rfq.status === 'draft' && (
                <Button
                  variant="success"
                  size="sm"
                  disabled={lines.length === 0}
                  title={lines.length === 0 ? 'Add at least one line item first' : undefined}
                  onClick={() => updateStatus('sent')}
                >
                  <Send className="w-4 h-4" />Send to Vendor
                </Button>
              )}

              {rfq.status === 'sent' && (
                <>
                  <Button variant="success" size="sm" onClick={() => updateStatus('received')}>
                    <CheckCircle className="w-4 h-4" />Mark Received
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => updateStatus('expired')}>
                    <XCircle className="w-4 h-4" />Mark Expired
                  </Button>
                </>
              )}
            </PermissionGate>

            {rfq.status === 'received' && (
              <PermissionGate action="create" moduleId="purchase">
                <Button variant="outline" size="sm" loading={converting} onClick={convertToPO}>
                  <ShoppingCart className="w-4 h-4" />Convert to PO
                </Button>
              </PermissionGate>
            )}

            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="w-4 h-4" />Print
            </Button>
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RFQLinesTable
            lines={lines}
            canEditLines={canEditLines}
            onAdd={openAddLine}
            onEdit={openEditLine}
            onDelete={handleDeleteLine}
          />
        </div>

        <div className="space-y-4">
          <RFQInfoCard rfq={rfq} statusInfo={s} lines={lines} />

          <VendorInfoCard vendor={rfq.vendor} />

          {rfq.notes && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300 mb-2">Notes</h3>
              <p className="text-sm text-slate-700 dark:text-slate-400 whitespace-pre-wrap">{rfq.notes}</p>
            </Card>
          )}
        </div>
      </div>

      <RFQLineModal
        open={showLineModal}
        onClose={closeLineModal}
        line={editingLine}
        lines={lines}
        rfqId={id}
        tenantId={tenantId}
        onSaved={loadRfq}
      />
    </div>
  )
}
