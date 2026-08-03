import { useCallback } from 'react'
import { Plus, Search, Pencil, Trash2, Package, Tag, DollarSign } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import {
  PAGE_SIZE_TABLE as PAGE_SIZE, PRODUCT_STATUS, PRODUCT_STATUS_TABS,
} from '@shared/lib/constants'
import { fetchProducts, deleteProduct } from '../api/products'
import { useResourceList } from '@shared/hooks/useResourceList'
import StatChip from '../components/StatChip'
import ProductModal from '../components/ProductModal'

export default function Products() {
  const { tenantId } = useTenant()

  const fetchFn = useCallback(
    ({ page, search, filter }) => fetchProducts(tenantId, { page, search, filter }),
    [tenantId]
  )
  const {
    items: products, total, page, setPage, search, setSearch, filter: statusFilter, setFilter: setStatusFilter,
    loading, refetch, showModal, editItem: editProduct, openNew, openEdit, closeModal,
  } = useResourceList(fetchFn, [tenantId])
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const handleDelete = async (p) => {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return
    try {
      await deleteProduct(p)
      toast.success('Product deleted.')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        subtitle="Manage your product catalog and stock levels"
        breadcrumb="Inventory / Products"
        actions={
          <PermissionGate action="create" moduleId="inventory">
            <Button size="sm" onClick={openNew} className="gap-1.5">
              <Plus className="w-4 h-4" />New Product
            </Button>
          </PermissionGate>
        }
      />

      {!loading && total > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <StatChip value={total}  label="Total"    color="#6366f1" />
          <StatChip
            value={statusFilter === 'all' ? total : products.length}
            label={statusFilter === 'all' ? 'Showing' : PRODUCT_STATUS[statusFilter]?.label}
            color={statusFilter === 'all' ? '#3b82f6' : (statusFilter === 'active' ? '#10b981' : '#94a3b8')}
          />
        </div>
      )}

      <Card>
        <div className="flex items-center gap-3 p-4 border-b border-surface-200 dark:border-surface-800 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-xs
                          px-3 py-2 rounded-lg
                          bg-slate-50 dark:bg-surface-800
                          border border-surface-200 dark:border-surface-700">
            <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, SKU, category…"
              className="bg-transparent text-sm text-slate-700 dark:text-slate-300
                         placeholder:text-slate-400 dark:placeholder:text-slate-600
                         flex-1 outline-none"
            />
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-surface-800 overflow-x-auto scrollbar-thin max-w-full">
            {PRODUCT_STATUS_TABS.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex-shrink-0 ${
                  statusFilter === s
                    ? 'bg-white dark:bg-surface-700 text-slate-800 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {s === 'all' ? 'All' : PRODUCT_STATUS[s]?.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20
                            flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-400 animate-pulse" />
            </div>
            <p className="text-sm text-slate-400">Loading products…</p>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full bg-blue-500/5 dark:bg-blue-500/10 scale-[2.5]" />
              <div className="absolute inset-0 rounded-full bg-blue-500/8 dark:bg-blue-500/15 scale-[1.8]" />
              <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-600/10
                              border border-blue-500/20 flex items-center justify-center">
                {search || statusFilter !== 'all'
                  ? <Search className="w-9 h-9 text-slate-400" />
                  : <Package className="w-9 h-9 text-blue-400" />}
              </div>
            </div>
            <h3 className="text-base font-display font-bold text-slate-800 dark:text-slate-200 mb-1">
              {search || statusFilter !== 'all' ? 'No products match' : 'No products yet'}
            </h3>
            <p className="text-sm text-slate-500 text-center max-w-xs mb-5">
              {search || statusFilter !== 'all'
                ? 'Try adjusting your search or filter.'
                : 'Add your first product to start tracking inventory.'}
            </p>
            {!search && statusFilter === 'all' && (
              <PermissionGate action="create" moduleId="inventory">
                <Button size="sm" onClick={openNew} className="gap-1.5">
                  <Plus className="w-4 h-4" />Add First Product
                </Button>
              </PermissionGate>
            )}
          </div>
        ) : (
          <Table>
            <Thead>
              <Th>SKU</Th>
              <Th>Product</Th>
              <Th>Category</Th>
              <Th>Unit</Th>
              <Th>Cost</Th>
              <Th>Sale Price</Th>
              <Th>Reorder Qty</Th>
              <Th>Status</Th>
              <Th></Th>
            </Thead>
            <Tbody>
              {products.map(p => (
                <Tr key={p.id} onClick={() => openEdit(p)}>
                  <Td>
                    <span className="inline-flex items-center gap-1 font-mono text-xs
                                     text-blue-600 dark:text-blue-400 font-medium
                                     bg-blue-50 dark:bg-blue-500/10
                                     px-1.5 py-0.5 rounded-md">
                      <Tag className="w-2.5 h-2.5" />{p.sku}
                    </span>
                  </Td>
                  <Td>
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{p.name}</span>
                      {p.description && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[180px]">{p.description}</p>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400
                                     bg-slate-100 dark:bg-surface-800
                                     px-2 py-0.5 rounded-full">
                      {p.category || '—'}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-xs text-slate-400">{p.unit_of_measure}</span>
                  </Td>
                  <Td>
                    <span className="font-mono text-sm text-slate-600 dark:text-slate-400">
                      ${Number(p.cost_price || 0).toFixed(2)}
                    </span>
                  </Td>
                  <Td>
                    <span className="inline-flex items-center gap-1 font-mono text-sm font-bold
                                     text-emerald-700 dark:text-emerald-400">
                      <DollarSign className="w-3 h-3" />{Number(p.sale_price || 0).toFixed(2)}
                    </span>
                  </Td>
                  <Td>
                    {Number(p.reorder_qty) > 0
                      ? <span className="text-amber-600 dark:text-amber-400 font-semibold text-sm">
                          {p.reorder_qty}
                        </span>
                      : <span className="text-slate-400 text-sm">—</span>
                    }
                  </Td>
                  <Td>
                    <Badge color={PRODUCT_STATUS[p.status]?.color || 'default'}>
                      {PRODUCT_STATUS[p.status]?.label || p.status}
                    </Badge>
                  </Td>
                  <Td onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <PermissionGate action="edit" moduleId="inventory">
                        <Button variant="ghost" size="xs" onClick={() => openEdit(p)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </PermissionGate>
                      <PermissionGate action="delete" moduleId="inventory">
                        <Button variant="danger" size="xs" onClick={() => handleDelete(p)}>
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
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          total={total}
          pageSize={PAGE_SIZE}
          label="products"
          className="border-t border-surface-200 dark:border-surface-800"
        />
      </Card>

      <ProductModal
        open={showModal}
        onClose={closeModal}
        onSaved={refetch}
        product={editProduct}
      />
    </div>
  )
}
