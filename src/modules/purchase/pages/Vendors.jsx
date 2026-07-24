import { useCallback } from 'react'
import { Plus, Search, Building2 } from 'lucide-react'
import { Button, PageHeader, Card, Spinner, EmptyState } from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { PAGE_SIZE_GRID as PAGE_SIZE, VENDOR_STATUS_TABS as STATUS_TABS, VENDOR_STATUS_LABEL as STATUS_LABEL } from '@shared/lib/constants'
import { fetchVendors, deleteVendor } from '../api/vendors'
import { useResourceList } from '@shared/hooks/useResourceList'
import VendorCard from '../components/VendorCard'
import VendorModal from '../components/VendorModal'

export default function Vendors() {
  const { tenantId } = useTenant()

  const fetchFn = useCallback(
    ({ page, search, filter }) => fetchVendors(tenantId, { page, search, filter }),
    [tenantId]
  )
  const {
    items: vendors, total, page, setPage, search, setSearch, filter: statusFilter, setFilter: setStatusFilter,
    loading, refetch, showModal, editItem: editVendor, openNew, openEdit, closeModal,
  } = useResourceList(fetchFn, [tenantId])
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const handleDelete = async (vendor) => {
    if (!window.confirm(`Delete vendor "${vendor.name}"? This cannot be undone.`)) return
    try {
      await deleteVendor(vendor)
      toast.success('Vendor deleted.')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendors"
        subtitle={`${total} vendor${total !== 1 ? 's' : ''}`}
        breadcrumb="Purchase / Vendors"
        actions={
          <PermissionGate action="create" moduleId="purchase">
            <Button size="sm" onClick={openNew}>
              <Plus className="w-4 h-4" />New Vendor
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
              placeholder="Search vendors…"
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
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner className="w-6 h-6" />
          </div>
        ) : vendors.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={search || statusFilter !== 'all' ? 'No vendors match' : 'No vendors yet'}
            description={
              search || statusFilter !== 'all'
                ? 'Try adjusting your search or filter.'
                : 'Add your first vendor to start managing procurement.'
            }
            action={
              !search && statusFilter === 'all' && (
                <PermissionGate action="create" moduleId="purchase">
                  <Button size="sm" onClick={openNew}>
                    <Plus className="w-4 h-4" />Add Vendor
                  </Button>
                </PermissionGate>
              )
            }
          />
        ) : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {vendors.map(vendor => (
              <VendorCard
                key={vendor.id}
                vendor={vendor}
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
          label="vendors"
          className="border-t border-surface-200 dark:border-surface-800"
        />
      </Card>

      <VendorModal
        open={showModal}
        onClose={closeModal}
        onSaved={refetch}
        vendor={editVendor}
      />
    </div>
  )
}
