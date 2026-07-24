import { useCallback } from 'react'
import { Plus, Search, Users } from 'lucide-react'
import { Button, PageHeader, Card, Spinner, EmptyState } from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { PAGE_SIZE_GRID as PAGE_SIZE, CUSTOMER_STATUS_TABS as STATUS_TABS } from '@shared/lib/constants'
import { fetchCustomers, deleteCustomer } from '../api/customers'
import { useResourceList } from '../hooks/useResourceList'
import CustomerCard from '../components/CustomerCard'
import CustomerModal from '../components/CustomerModal'

export default function Customers() {
  const { tenantId } = useTenant()

  const fetchFn = useCallback(
    ({ page, search, filter }) => fetchCustomers(tenantId, { page, search, filter }),
    [tenantId]
  )
  const {
    items: customers, total, page, setPage, search, setSearch, filter: statusFilter, setFilter: setStatusFilter,
    loading, refetch, showModal, editItem: editCustomer, openNew, openEdit, closeModal,
  } = useResourceList(fetchFn, [tenantId])
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const handleDelete = async (customer) => {
    if (!window.confirm(`Delete customer "${customer.name}"? This cannot be undone.`)) return
    try {
      await deleteCustomer(customer)
      toast.success('Customer deleted.')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        subtitle={`${total} customer${total !== 1 ? 's' : ''}`}
        breadcrumb="Sales / Customers"
        actions={
          <PermissionGate action="create" moduleId="sales">
            <Button size="sm" onClick={openNew}>
              <Plus className="w-4 h-4" />New Customer
            </Button>
          </PermissionGate>
        }
      />

      <Card>
        <div className="flex items-center gap-3 p-4 border-b border-surface-200 dark:border-surface-800 flex-wrap">
          <div className="flex items-center gap-2 w-64 px-3 py-1.5 rounded-lg
                          bg-slate-50 dark:bg-surface-800
                          border border-surface-200 dark:border-surface-700">
            <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search customers…"
              className="bg-transparent text-sm text-slate-700 dark:text-slate-300
                         placeholder:text-slate-400 dark:placeholder:text-slate-600
                         flex-1 outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {STATUS_TABS.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  statusFilter === s
                    ? 'bg-brand-600/20 text-brand-600 dark:text-brand-300 border border-brand-600/30'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner className="w-6 h-6" />
          </div>
        ) : customers.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search || statusFilter !== 'all' ? 'No customers match' : 'No customers yet'}
            description={
              search || statusFilter !== 'all'
                ? 'Try adjusting your search or filter.'
                : 'Add your first customer to start tracking sales.'
            }
            action={
              !search && statusFilter === 'all' && (
                <PermissionGate action="create" moduleId="sales">
                  <Button size="sm" onClick={openNew}>
                    <Plus className="w-4 h-4" />Add Customer
                  </Button>
                </PermissionGate>
              )
            }
          />
        ) : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {customers.map(customer => (
              <CustomerCard
                key={customer.id}
                customer={customer}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          total={total}
          pageSize={PAGE_SIZE}
          label="customers"
          className="border-t border-surface-200 dark:border-surface-800"
        />
      </Card>

      <CustomerModal
        open={showModal}
        onClose={closeModal}
        onSaved={() => { refetch(); closeModal() }}
        customer={editCustomer}
      />
    </div>
  )
}
