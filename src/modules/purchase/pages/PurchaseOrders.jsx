import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Download, Eye, Trash2 } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card, Spinner,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import {
  PAGE_SIZE_TABLE as PAGE_SIZE, PURCHASE_ORDER_STATUS as STATUS, PURCHASE_ORDER_STATUS_TABS as STATUS_TABS,
} from '@shared/lib/constants'
import { fetchPurchaseOrders, approvePurchaseOrder, deletePurchaseOrder } from '../api/purchaseOrders'
import { fetchActiveVendorOptions } from '../api/vendors'
import { useResourceList } from '@shared/hooks/useResourceList'
import ListToolbar from '@shared/components/ListToolbar'
import NewOrderModal from '../components/NewOrderModal'

const TABS = STATUS_TABS.map(s => ({ value: s, label: s === 'all' ? 'All' : STATUS[s]?.label }))

export default function PurchaseOrders() {
  const { tenantId } = useTenant()
  const [vendors, setVendors] = useState([])

  const fetchFn = useCallback(
    ({ page, search, filter }) => fetchPurchaseOrders(tenantId, { page, search, filter }),
    [tenantId]
  )
  const {
    items: orders, total, page, setPage, search, setSearch, filter: statusFilter, setFilter: setStatusFilter,
    loading, refetch, showModal: showNew, openNew, closeModal: closeNew,
  } = useResourceList(fetchFn, [tenantId])
  const totalPages = Math.ceil(total / PAGE_SIZE)

  useEffect(() => { fetchActiveVendorOptions(tenantId).then(setVendors) }, [tenantId])

  const handleApprove = async (id) => {
    try {
      await approvePurchaseOrder(id)
      toast.success('Order approved.')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleDelete = async (id, orderNumber) => {
    if (!window.confirm(`Delete order ${orderNumber}? This cannot be undone.`)) return
    try {
      await deletePurchaseOrder(id)
      toast.success('Order deleted.')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        subtitle={`${total} order${total !== 1 ? 's' : ''}`}
        breadcrumb="Purchase / Orders"
        actions={
          <PermissionGate action="create" moduleId="purchase">
            <Button size="sm" onClick={openNew}>
              <Plus className="w-4 h-4" />New Order
            </Button>
          </PermissionGate>
        }
      />

      <Card>
        <ListToolbar
          search={search} onSearchChange={setSearch} placeholder="Search orders, vendors…"
          tabs={TABS} activeTab={statusFilter} onTabChange={setStatusFilter}
        >
          <PermissionGate action="export" moduleId="purchase">
            <Button variant="secondary" size="sm" className="ml-auto">
              <Download className="w-3.5 h-3.5" />Export
            </Button>
          </PermissionGate>
        </ListToolbar>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="w-6 h-6" />
          </div>
        ) : (
          <>
            <Table>
              <Thead>
                <Th>Order #</Th>
                <Th>Vendor</Th>
                <Th>Reference</Th>
                <Th>Date</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
                <Th></Th>
              </Thead>
              <Tbody>
                {orders.map(order => {
                  const s = STATUS[order.status] || STATUS.draft
                  return (
                    <Tr key={order.id}>
                      <Td>
                        <Link to={`/purchase/orders/${order.id}`}>
                          <span className="font-mono text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
                            {order.order_number}
                          </span>
                        </Link>
                      </Td>
                      <Td>
                        <span className="font-medium text-slate-900 dark:text-slate-200">{order.vendor?.name || '—'}</span>
                      </Td>
                      <Td>
                        <span className="font-mono text-xs text-slate-500">{order.reference || '—'}</span>
                      </Td>
                      <Td>
                        <span className="text-slate-500">{order.order_date}</span>
                      </Td>
                      <Td>
                        <span className="font-semibold">
                          ${(Number(order.total_amount) || 0).toLocaleString()}
                        </span>
                      </Td>
                      <Td><Badge color={s.color}>{s.label}</Badge></Td>
                      <Td>
                        <div className="flex gap-1">
                          <Link to={`/purchase/orders/${order.id}`}>
                            <Button variant="ghost" size="xs">
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                          <PermissionGate action="approve" moduleId="purchase">
                            {order.status === 'pending' && (
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => handleApprove(order.id)}
                              >
                                Approve
                              </Button>
                            )}
                          </PermissionGate>
                          <PermissionGate action="delete" moduleId="purchase">
                            <Button
                              variant="danger"
                              size="xs"
                              onClick={() => handleDelete(order.id, order.order_number)}
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

            {orders.length === 0 && (
              <div className="py-12 text-center text-slate-500 text-sm">No orders found.</div>
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

      <NewOrderModal
        open={showNew}
        onClose={closeNew}
        vendors={vendors}
        onCreated={refetch}
      />
    </div>
  )
}
