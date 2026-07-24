import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, Receipt, Send } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { PAGE_SIZE_TABLE as PAGE_SIZE, BILL_STATUS, BILL_STATUS_TABS } from '@shared/lib/constants'
import { findActiveWorkflow, submitForApproval } from '@shared/lib/approvalWorkflow'
import {
  fetchBills, deleteBill, fetchActiveVendors, fetchActiveProductsForCost, fetchPendingApprovalsForBills,
} from '../api/bills'
import { useResourceList } from '@shared/hooks/useResourceList'
import ListToolbar from '../components/ListToolbar'
import { ListLoading, ListEmptyState } from '../components/ListStates'
import BillModal from '../components/BillModal'

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const STATUS_TABS = BILL_STATUS_TABS.map(s => ({ value: s, label: s === 'all' ? 'All' : BILL_STATUS[s]?.label }))

export default function Bills() {
  const { tenantId } = useTenant()
  const [vendors, setVendors]   = useState([])
  const [products, setProducts] = useState([])
  const [workflow, setWorkflow] = useState(null)
  const [pendingByBill, setPendingByBill] = useState({})

  const fetchFn = useCallback(params => fetchBills(tenantId, params), [tenantId])
  const {
    items: bills, total, page, setPage, search, setSearch, filter: statusFilter, setFilter: setStatusFilter,
    loading, refetch, showModal, editItem: editBill, openNew, openEdit, closeModal,
  } = useResourceList(fetchFn, [tenantId])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  useEffect(() => { fetchActiveVendors(tenantId).then(setVendors) }, [tenantId])
  useEffect(() => { fetchActiveProductsForCost(tenantId).then(setProducts) }, [tenantId])
  useEffect(() => { if (tenantId) findActiveWorkflow(tenantId, 'accounts').then(setWorkflow) }, [tenantId])

  useEffect(() => {
    const draftIds = bills.filter(b => b.status === 'draft').map(b => b.id)
    fetchPendingApprovalsForBills(tenantId, draftIds).then(setPendingByBill)
  }, [bills, tenantId])

  const handleSubmitForApproval = async (bill) => {
    try {
      const result = await submitForApproval({
        tenantId, module: 'accounts', recordId: bill.id, recordType: 'bill',
        title: `Bill ${bill.bill_number}`,
        description: `Vendor: ${bill.vendor?.name || '—'} · Total $${fmt(bill.total_amount)}`,
        amount: bill.total_amount, priority: Number(bill.total_amount) > 5000 ? 'high' : 'normal',
        requestedBy: window.__erp_user__?.id,
      })
      if (result.submitted) {
        setPendingByBill(prev => ({ ...prev, [bill.id]: result.request }))
        toast.success(`Submitted for approval as ${result.request.request_number}.`)
      }
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleDelete = async (b) => {
    if (!window.confirm(`Delete bill ${b.bill_number}? This cannot be undone.`)) return
    try {
      await deleteBill(b)
      toast.success('Bill deleted.')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const searching = Boolean(search || statusFilter !== 'all')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bills"
        subtitle="Manage vendor bills and track payables"
        breadcrumb="Accounts / Bills"
        actions={
          <PermissionGate action="create" moduleId="accounts">
            <Button size="sm" onClick={openNew} className="gap-1.5">
              <Plus className="w-4 h-4" />New Bill
            </Button>
          </PermissionGate>
        }
      />

      <Card>
        <ListToolbar
          search={search} onSearchChange={setSearch}
          placeholder="Search by bill number…"
          tabs={STATUS_TABS} activeTab={statusFilter} onTabChange={setStatusFilter}
        />

        {loading ? (
          <ListLoading color="pink" icon={Receipt} label="Loading bills…" />
        ) : bills.length === 0 ? (
          <ListEmptyState
            color="pink" icon={Receipt} searching={searching}
            title="No bills yet" description="Add your first vendor bill to track payables."
            searchingTitle="No bills match" searchingDescription="Try adjusting your search or filter."
            action={
              <PermissionGate action="create" moduleId="accounts">
                <Button size="sm" onClick={openNew} className="gap-1.5">
                  <Plus className="w-4 h-4" />Add First Bill
                </Button>
              </PermissionGate>
            }
          />
        ) : (
          <Table>
            <Thead>
              <Th>Bill #</Th>
              <Th>Vendor</Th>
              <Th>Bill Date</Th>
              <Th>Due Date</Th>
              <Th>Total</Th>
              <Th>Paid</Th>
              <Th>Status</Th>
              <Th></Th>
            </Thead>
            <Tbody>
              {bills.map(b => (
                <Tr key={b.id} onClick={() => openEdit(b)}>
                  <Td>
                    <span className="font-mono text-xs font-medium
                                     text-pink-600 dark:text-pink-400
                                     bg-pink-50 dark:bg-pink-500/10
                                     px-2 py-0.5 rounded-md">
                      {b.bill_number}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {b.vendor?.name || '—'}
                    </span>
                  </Td>
                  <Td><span className="text-sm text-slate-600 dark:text-slate-400">{b.bill_date}</span></Td>
                  <Td><span className="text-sm text-slate-600 dark:text-slate-400">{b.due_date || '—'}</span></Td>
                  <Td>
                    <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                      ${fmt(b.total_amount)}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-sm text-emerald-600 dark:text-emerald-400">
                      ${fmt(b.paid_amount)}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Badge color={BILL_STATUS[b.status]?.color || 'default'}>
                        {BILL_STATUS[b.status]?.label || b.status}
                      </Badge>
                      {pendingByBill[b.id] && (
                        <Link
                          to={`/approval/requests/${pendingByBill[b.id].id}`}
                          onClick={e => e.stopPropagation()}
                          className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
                        >
                          {pendingByBill[b.id].request_number} · Pending
                        </Link>
                      )}
                    </div>
                  </Td>
                  <Td onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      {b.status === 'draft' && workflow && !pendingByBill[b.id] && (
                        <PermissionGate action="edit" moduleId="accounts">
                          <Button variant="ghost" size="xs" onClick={() => handleSubmitForApproval(b)} title="Submit for Approval">
                            <Send className="w-3.5 h-3.5" />
                          </Button>
                        </PermissionGate>
                      )}
                      <PermissionGate action="edit" moduleId="accounts">
                        <Button variant="ghost" size="xs" onClick={() => openEdit(b)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </PermissionGate>
                      <PermissionGate action="delete" moduleId="accounts">
                        <Button variant="danger" size="xs" onClick={() => handleDelete(b)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </PermissionGate>
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}

        <Pagination
          page={page} totalPages={totalPages} onPageChange={setPage}
          total={total} pageSize={PAGE_SIZE} label="bills"
          className="border-t border-surface-200 dark:border-surface-800"
        />
      </Card>

      <BillModal
        open={showModal} onClose={closeModal} onSaved={refetch}
        bill={editBill} vendors={vendors} products={products}
      />
    </div>
  )
}
