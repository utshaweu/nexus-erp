import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Download, Eye, Trash2, CheckCircle } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card, Spinner,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import {
  PAGE_SIZE_TABLE as PAGE_SIZE, SALES_ORDER_STATUS as STATUS, SALES_ORDER_STATUS_TABS as STATUS_TABS,
} from '@shared/lib/constants'
import { fetchSalesOrders, confirmSalesOrder, deleteSalesOrder } from '../api/salesOrders'
import { fetchActiveCustomerOptions } from '../api/customers'
import { useResourceList } from '@shared/hooks/useResourceList'
import ListToolbar from '@shared/components/ListToolbar'
import NewOrderModal from '../components/NewOrderModal'

const TABS = STATUS_TABS.map(s => ({ value: s, label: s === 'all' ? 'All' : STATUS[s]?.label }))

export default function SalesOrders() {
  const { tenantId } = useTenant()
  const [customers, setCustomers] = useState([])

  const fetchFn = useCallback(
    ({ page, search, filter }) => fetchSalesOrders(tenantId, { page, search, filter }),
    [tenantId]
  )
  const {
    items: orders, total, page, setPage, search, setSearch, filter: statusFilter, setFilter: setStatusFilter,
    loading, refetch, showModal: showNew, openNew, closeModal: closeNew,
  } = useResourceList(fetchFn, [tenantId])
  const totalPages = Math.ceil(total / PAGE_SIZE)

  useEffect(() => { fetchActiveCustomerOptions(tenantId).then(setCustomers) }, [tenantId])

  const handleConfirm = async (id) => {
    try {
      await confirmSalesOrder(id)
      toast.success('Order confirmed.')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleDelete = async (id, orderNumber) => {
    if (!window.confirm(`Delete order ${orderNumber}? This cannot be undone.`)) return
    try {
      await deleteSalesOrder(id)
      toast.success('Order deleted.')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Orders"
        subtitle={`${total} order${total !== 1 ? 's' : ''}`}
        breadcrumb="Sales / Orders"
        actions={
          <PermissionGate action="create" moduleId="sales">
            <Button size="sm" onClick={openNew}>
              <Plus className="w-4 h-4" />New Order
            </Button>
          </PermissionGate>
        }
      />

      <Card>
        <ListToolbar
          search={search} onSearchChange={setSearch} placeholder="Search orders, customers…"
          tabs={TABS} activeTab={statusFilter} onTabChange={setStatusFilter}
        >
          <PermissionGate action="export" moduleId="sales">
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
                <Th>Reference</Th>
                <Th>Customer</Th>
                <Th>Date</Th>
                <Th>Delivery</Th>
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
                        <Link to={`/sales/orders/${order.id}`}>
                          <span className="font-mono text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300">
                            {order.order_number}
                          </span>
                        </Link>
                      </Td>
                      <Td>
                        <span className="font-mono text-xs text-slate-500">{order.reference || '—'}</span>
                      </Td>
                      <Td>
                        <span className="font-medium text-slate-900 dark:text-slate-200">{order.customer?.name || '—'}</span>
                      </Td>
                      <Td>
                        <span className="text-slate-500">{order.order_date}</span>
                      </Td>
                      <Td>
                        <span className="text-slate-500">{order.delivery_date || '—'}</span>
                      </Td>
                      <Td>
                        <span className="font-semibold">
                          ${(Number(order.total_amount) || 0).toLocaleString()}
                        </span>
                      </Td>
                      <Td><Badge color={s.color}>{s.label}</Badge></Td>
                      <Td>
                        <div className="flex gap-1">
                          <Link to={`/sales/orders/${order.id}`}>
                            <Button variant="ghost" size="xs">
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                          <PermissionGate action="approve" moduleId="sales">
                            {order.status === 'draft' && (
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => handleConfirm(order.id)}
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </PermissionGate>
                          <PermissionGate action="delete" moduleId="sales">
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
        customers={customers}
        onCreated={refetch}
      />
    </div>
  )
}
