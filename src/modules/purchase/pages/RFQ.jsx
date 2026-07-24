import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Send, Eye, Trash2 } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card, Spinner,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import {
  PAGE_SIZE_TABLE as PAGE_SIZE, RFQ_STATUS as STATUS, RFQ_STATUS_TABS as STATUS_TABS,
} from '@shared/lib/constants'
import { fetchRFQs, sendRFQ, deleteRFQ } from '../api/rfqs'
import { fetchActiveVendorOptions } from '../api/vendors'
import { useResourceList } from '@shared/hooks/useResourceList'
import ListToolbar from '@shared/components/ListToolbar'
import NewRFQModal from '../components/NewRFQModal'

const TABS = STATUS_TABS.map(s => ({ value: s, label: s === 'all' ? 'All' : STATUS[s]?.label }))

export default function RFQ() {
  const { tenantId } = useTenant()
  const [vendors, setVendors] = useState([])

  const fetchFn = useCallback(
    ({ page, search, filter }) => fetchRFQs(tenantId, { page, search, filter }),
    [tenantId]
  )
  const {
    items: rfqs, total, page, setPage, search, setSearch, filter: statusFilter, setFilter: setStatusFilter,
    loading, refetch, showModal: showNew, openNew, closeModal: closeNew,
  } = useResourceList(fetchFn, [tenantId])
  const totalPages = Math.ceil(total / PAGE_SIZE)

  useEffect(() => { fetchActiveVendorOptions(tenantId).then(setVendors) }, [tenantId])

  const handleSend = async (id, rfqNumber) => {
    try {
      await sendRFQ(id)
      toast.success(`${rfqNumber} sent to vendor.`)
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleDelete = async (id, rfqNumber) => {
    if (!window.confirm(`Delete ${rfqNumber}? This cannot be undone.`)) return
    try {
      await deleteRFQ(id)
      toast.success('RFQ deleted.')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Request for Quotations"
        subtitle="Send RFQs to vendors and convert to purchase orders"
        breadcrumb="Purchase / RFQ"
        actions={
          <PermissionGate action="create" moduleId="purchase">
            <Button size="sm" onClick={openNew}>
              <Plus className="w-4 h-4" />New RFQ
            </Button>
          </PermissionGate>
        }
      />

      <Card>
        <ListToolbar
          search={search} onSearchChange={setSearch} placeholder="Search RFQ number…"
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
                <Th>RFQ #</Th><Th>Vendor</Th><Th>Deadline</Th><Th>Amount</Th><Th>Status</Th><Th></Th>
              </Thead>
              <Tbody>
                {rfqs.map(rfq => {
                  const s = STATUS[rfq.status] || STATUS.draft
                  return (
                    <Tr key={rfq.id}>
                      <Td>
                        <span className="font-mono text-xs text-brand-600 dark:text-brand-400">{rfq.rfq_number}</span>
                      </Td>
                      <Td>
                        <span className="font-medium text-slate-900 dark:text-slate-200">{rfq.vendor?.name || '—'}</span>
                      </Td>
                      <Td>
                        <span className="text-slate-500">{rfq.deadline || '—'}</span>
                      </Td>
                      <Td>
                        {rfq.quoted_amount > 0
                          ? <span className="font-semibold">${Number(rfq.quoted_amount).toLocaleString()}</span>
                          : <span className="text-slate-600">—</span>
                        }
                      </Td>
                      <Td><Badge color={s.color}>{s.label}</Badge></Td>
                      <Td>
                        <div className="flex gap-1">
                          <Link to={`/purchase/rfq/${rfq.id}`}>
                            <Button variant="ghost" size="xs">
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                          {rfq.status === 'draft' && (
                            <PermissionGate action="edit" moduleId="purchase">
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => handleSend(rfq.id, rfq.rfq_number)}
                              >
                                <Send className="w-3.5 h-3.5" />
                              </Button>
                            </PermissionGate>
                          )}
                          <PermissionGate action="delete" moduleId="purchase">
                            <Button
                              variant="danger"
                              size="xs"
                              onClick={() => handleDelete(rfq.id, rfq.rfq_number)}
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

            {rfqs.length === 0 && (
              <div className="py-12 text-center text-slate-500 text-sm">No RFQs found.</div>
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

      <NewRFQModal
        open={showNew}
        onClose={closeNew}
        vendors={vendors}
        onCreated={refetch}
      />
    </div>
  )
}
