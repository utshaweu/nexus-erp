import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { PageHeader, Card, Button, Spinner } from '@shared/components/ui'
import { CheckCircle, XCircle, Printer, ArrowLeft, ShoppingCart, FileText, Send } from 'lucide-react'
import { useTenant } from '@core/tenant/TenantContext'
import toast from '@shared/lib/toast'
import PermissionGate from '@shared/components/PermissionGate'
import { QUOTATION_STATUS as STATUS_BADGE } from '@shared/lib/constants'
import {
  fetchQuotationDetail, deleteQuotationLine, updateQuotationStatus, convertQuotationToSalesOrder, lineMath,
} from '../api/quotations'
import QuotationLineModal from '../components/QuotationLineModal'
import QuotationLinesTable from '../components/QuotationLinesTable'
import QuotationInfoCard from '../components/QuotationInfoCard'
import CustomerInfoCard from '../components/CustomerInfoCard'

export default function QuotationDetail() {
  const { id }       = useParams()
  const navigate     = useNavigate()
  const { tenantId } = useTenant()
  const [quote,         setQuote]         = useState(null)
  const [lines,         setLines]         = useState([])
  const [loading,       setLoading]       = useState(true)
  const [converting,    setConverting]    = useState(false)
  const [showLineModal, setShowLineModal] = useState(false)
  const [editingLine,   setEditingLine]   = useState(null)

  const canEditLines = quote && quote.status === 'draft'

  const loadQuote = useCallback(async () => {
    if (!id || !tenantId) return
    setLoading(true)
    try {
      const { quote, lines } = await fetchQuotationDetail(id, tenantId)
      setQuote(quote)
      setLines(lines)
    } catch (err) {
      toast.error('Quotation not found.')
    } finally {
      setLoading(false)
    }
  }, [id, tenantId])

  useEffect(() => { loadQuote() }, [loadQuote])

  const handleDeleteLine = async (lineId) => {
    if (!window.confirm('Remove this line item?')) return
    try {
      await deleteQuotationLine(lineId, id, tenantId)
      toast.success('Line removed.')
      loadQuote()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const openAddLine    = () => { setEditingLine(null); setShowLineModal(true) }
  const openEditLine   = (l) => { setEditingLine(l); setShowLineModal(true) }
  const closeLineModal = () => { setShowLineModal(false); setEditingLine(null) }

  const updateStatus = async (status) => {
    try {
      await updateQuotationStatus(id, status)
      toast.success(`Quotation marked as ${STATUS_BADGE[status]?.label || status}.`)
      setQuote(q => ({ ...q, status }))
    } catch (err) {
      toast.error(err.message)
    }
  }

  const convertToOrder = async () => {
    if (!window.confirm('Convert this quotation to a sales order?')) return
    setConverting(true)
    try {
      const { orderNumber, orderId } = await convertQuotationToSalesOrder(tenantId, quote, lines)
      toast.success(`Converted to ${orderNumber}.`)
      navigate(`/sales/orders/${orderId}`)
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

  if (!quote) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 mb-2">Quotation not found.</p>
        <Link to="/sales/quotations" className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 text-sm">
          ← Back to quotations
        </Link>
      </div>
    )
  }

  const s        = STATUS_BADGE[quote.status] || STATUS_BADGE.draft
  const subtotal = lines.reduce((a, l) => a + lineMath(l).net, 0)
  const taxAmt   = lines.reduce((a, l) => a + lineMath(l).tax, 0)
  const total    = subtotal + taxAmt

  return (
    <div className="space-y-6">
      <PageHeader
        title={quote.quotation_number}
        subtitle={`Customer: ${quote.customer?.name || '—'}`}
        breadcrumb="Sales / Quotations"
        actions={
          <div className="flex items-center gap-2 print:hidden">
            <Link to="/sales/quotations">
              <Button variant="secondary" size="sm">
                <ArrowLeft className="w-4 h-4" />Back
              </Button>
            </Link>

            <PermissionGate action="edit" moduleId="sales">
              {quote.status === 'draft' && (
                <Button
                  variant="success"
                  size="sm"
                  disabled={lines.length === 0}
                  title={lines.length === 0 ? 'Add at least one line item first' : undefined}
                  onClick={() => updateStatus('sent')}
                >
                  <Send className="w-4 h-4" />Send to Customer
                </Button>
              )}
            </PermissionGate>

            <PermissionGate action="approve" moduleId="sales">
              {quote.status === 'sent' && (
                <>
                  <Button variant="success" size="sm" onClick={() => updateStatus('accepted')}>
                    <CheckCircle className="w-4 h-4" />Mark Accepted
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => updateStatus('expired')}>
                    <FileText className="w-4 h-4" />Mark Expired
                  </Button>
                </>
              )}
            </PermissionGate>

            {quote.status === 'accepted' && (
              <PermissionGate action="create" moduleId="sales">
                <Button variant="outline" size="sm" loading={converting} onClick={convertToOrder}>
                  <ShoppingCart className="w-4 h-4" />Convert to Sales Order
                </Button>
              </PermissionGate>
            )}

            {['draft', 'sent'].includes(quote.status) && (
              <PermissionGate action="approve" moduleId="sales">
                <Button variant="danger" size="sm" onClick={() => updateStatus('cancelled')}>
                  <XCircle className="w-4 h-4" />Cancel
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
          <QuotationLinesTable
            lines={lines}
            canEditLines={canEditLines}
            onAdd={openAddLine}
            onEdit={openEditLine}
            onDelete={handleDeleteLine}
            subtotal={subtotal}
            taxAmt={taxAmt}
            total={total}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <QuotationInfoCard quote={quote} statusInfo={s} lines={lines} total={total} />

          <CustomerInfoCard customer={quote.customer} />

          {quote.notes && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300 mb-2">Notes</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{quote.notes}</p>
            </Card>
          )}
        </div>
      </div>

      <QuotationLineModal
        open={showLineModal}
        onClose={closeLineModal}
        line={editingLine}
        lines={lines}
        quotationId={id}
        tenantId={tenantId}
        onSaved={loadQuote}
      />
    </div>
  )
}
