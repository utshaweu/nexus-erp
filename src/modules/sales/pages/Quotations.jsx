import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Send, Trash2, CheckCircle, Eye } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card, Spinner,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import {
  PAGE_SIZE_TABLE as PAGE_SIZE, QUOTATION_STATUS as STATUS, QUOTATION_STATUS_TABS as STATUS_TABS,
} from '@shared/lib/constants'
import { fetchQuotations, sendQuotation, acceptQuotation, deleteQuotation } from '../api/quotations'
import { fetchActiveCustomerOptions } from '../api/customers'
import { useResourceList } from '../hooks/useResourceList'
import ListToolbar from '../components/ListToolbar'
import NewQuotationModal from '../components/NewQuotationModal'

const TABS = STATUS_TABS.map(s => ({ value: s, label: s === 'all' ? 'All' : STATUS[s]?.label }))

export default function Quotations() {
  const { tenantId } = useTenant()
  const [customers, setCustomers] = useState([])

  const fetchFn = useCallback(
    ({ page, search, filter }) => fetchQuotations(tenantId, { page, search, filter }),
    [tenantId]
  )
  const {
    items: quotations, total, page, setPage, search, setSearch, filter: statusFilter, setFilter: setStatusFilter,
    loading, refetch, showModal: showNew, openNew, closeModal: closeNew,
  } = useResourceList(fetchFn, [tenantId])
  const totalPages = Math.ceil(total / PAGE_SIZE)

  useEffect(() => { fetchActiveCustomerOptions(tenantId).then(setCustomers) }, [tenantId])

  const handleSend = async (id, quotationNumber) => {
    try {
      await sendQuotation(id)
      toast.success(`${quotationNumber} sent to customer.`)
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleAccept = async (id) => {
    try {
      await acceptQuotation(id)
      toast.success('Quotation accepted.')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleDelete = async (id, quotationNumber) => {
    if (!window.confirm(`Delete ${quotationNumber}? This cannot be undone.`)) return
    try {
      await deleteQuotation(id)
      toast.success('Quotation deleted.')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotations"
        subtitle={`${total} quotation${total !== 1 ? 's' : ''}`}
        breadcrumb="Sales / Quotations"
        actions={
          <PermissionGate action="create" moduleId="sales">
            <Button size="sm" onClick={openNew}>
              <Plus className="w-4 h-4" />New Quotation
            </Button>
          </PermissionGate>
        }
      />

      <Card>
        <ListToolbar
          search={search} onSearchChange={setSearch} placeholder="Search quotations, customers…"
          tabs={TABS} activeTab={statusFilter} onTabChange={setStatusFilter}
        />

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="w-6 h-6" />
          </div>
        ) : (
          <>
            <Table>
              <Thead>
                <Th>Quotation #</Th>
                <Th>Customer</Th>
                <Th>Date</Th>
                <Th>Expiry</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
                <Th></Th>
              </Thead>
              <Tbody>
                {quotations.map(q => {
                  const s = STATUS[q.status] || STATUS.draft
                  return (
                    <Tr key={q.id}>
                      <Td>
                        <Link to={`/sales/quotations/${q.id}`}>
                          <span className="font-mono text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300">
                            {q.quotation_number}
                          </span>
                        </Link>
                      </Td>
                      <Td>
                        <span className="font-medium text-slate-900 dark:text-slate-200">{q.customer?.name || '—'}</span>
                      </Td>
                      <Td>
                        <span className="text-slate-500">{q.quotation_date}</span>
                      </Td>
                      <Td>
                        <span className="text-slate-500">{q.expiry_date || '—'}</span>
                      </Td>
                      <Td>
                        {Number(q.total_amount) > 0
                          ? <span className="font-semibold">${Number(q.total_amount).toLocaleString()}</span>
                          : <span className="text-slate-600">—</span>
                        }
                      </Td>
                      <Td><Badge color={s.color}>{s.label}</Badge></Td>
                      <Td>
                        <div className="flex gap-1">
                          <Link to={`/sales/quotations/${q.id}`}>
                            <Button variant="ghost" size="xs">
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                          {q.status === 'draft' && (
                            <PermissionGate action="edit" moduleId="sales">
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => handleSend(q.id, q.quotation_number)}
                              >
                                <Send className="w-3.5 h-3.5" />
                              </Button>
                            </PermissionGate>
                          )}
                          {q.status === 'sent' && (
                            <PermissionGate action="approve" moduleId="sales">
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => handleAccept(q.id)}
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                              </Button>
                            </PermissionGate>
                          )}
                          <PermissionGate action="delete" moduleId="sales">
                            <Button
                              variant="danger"
                              size="xs"
                              onClick={() => handleDelete(q.id, q.quotation_number)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </PermissionGate>
                        </div>
                      </Td>
                    </Tr>
                  )
                })}
              </Tbody>
            </Table>

            {quotations.length === 0 && (
              <div className="py-12 text-center text-slate-500 text-sm">No quotations found.</div>
            )}

            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              total={total}
              pageSize={PAGE_SIZE}
              className="border-t border-surface-200 dark:border-surface-800"
            />
          </>
        )}
      </Card>

      <NewQuotationModal
        open={showNew}
        onClose={closeNew}
        customers={customers}
        onCreated={refetch}
      />
    </div>
  )
}
