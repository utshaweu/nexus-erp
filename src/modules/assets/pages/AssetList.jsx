import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, Cpu, Eye } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { PAGE_SIZE_TABLE as PAGE_SIZE, ASSET_STATUS, ASSET_STATUS_TABS } from '@shared/lib/constants'
import { fetchAssets, deleteAsset, fetchActiveAssetProducts } from '../api/assets'
import { fetchActiveCategories } from '../api/categories'
import { useResourceList } from '../hooks/useResourceList'
import ListToolbar from '../components/ListToolbar'
import { ListLoading, ListEmptyState } from '../components/ListStates'
import AssetModal from '../components/AssetModal'

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const STATUS_TABS = ASSET_STATUS_TABS.map(s => ({ value: s, label: s === 'all' ? 'All' : ASSET_STATUS[s]?.label }))

export default function AssetList() {
  const { tenantId } = useTenant()
  const [categories, setCategories]       = useState([])
  const [assetProducts, setAssetProducts] = useState([])

  const fetchFn = useCallback(params => fetchAssets(tenantId, params), [tenantId])
  const {
    items: assets, total, page, setPage, search, setSearch, filter: statusFilter, setFilter: setStatusFilter,
    loading, refetch, showModal, editItem: editAsset, openNew, openEdit, closeModal,
  } = useResourceList(fetchFn, [tenantId])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  useEffect(() => { fetchActiveCategories(tenantId).then(setCategories) }, [tenantId])
  useEffect(() => { fetchActiveAssetProducts(tenantId).then(setAssetProducts) }, [tenantId])

  const handleDelete = async (a) => {
    if (!window.confirm(`Delete asset ${a.asset_number}? This will also delete its depreciation schedule. This cannot be undone.`)) return
    try {
      await deleteAsset(a)
      toast.success('Asset deleted.')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const searching = Boolean(search || statusFilter !== 'all')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assets"
        subtitle="Fixed asset registry with depreciation tracking"
        breadcrumb="Assets / Assets"
        actions={
          <PermissionGate action="create" moduleId="assets">
            <Button size="sm" onClick={openNew}>
              <Plus className="w-4 h-4" />New Asset
            </Button>
          </PermissionGate>
        }
      />

      <Card>
        <ListToolbar
          search={search} onSearchChange={setSearch}
          placeholder="Search by name, number, serial…"
          tabs={STATUS_TABS} activeTab={statusFilter} onTabChange={setStatusFilter}
        />

        {loading ? (
          <ListLoading icon={Cpu} label="Loading assets…" />
        ) : assets.length === 0 ? (
          <ListEmptyState
            icon={Cpu} searching={searching}
            title="No assets yet" description="Register your first fixed asset to start tracking depreciation."
            searchingTitle="No assets match" searchingDescription="Try adjusting your search or filter."
            action={
              <PermissionGate action="create" moduleId="assets">
                <Button size="sm" onClick={openNew}><Plus className="w-4 h-4" />New Asset</Button>
              </PermissionGate>
            }
          />
        ) : (
          <Table>
            <Thead>
              <Th>Asset #</Th>
              <Th>Name</Th>
              <Th>Category</Th>
              <Th>Purchase Date</Th>
              <Th>Cost</Th>
              <Th>Book Value</Th>
              <Th>Status</Th>
              <Th></Th>
            </Thead>
            <Tbody>
              {assets.map(a => {
                const s = ASSET_STATUS[a.status]
                const deprPct = a.purchase_cost > 0
                  ? Math.round((a.accumulated_depreciation / a.purchase_cost) * 100)
                  : 0
                return (
                  <Tr key={a.id}>
                    <Td>
                      <span className="font-mono text-xs font-medium
                                       text-orange-600 dark:text-orange-400
                                       bg-orange-50 dark:bg-orange-500/10
                                       px-2 py-0.5 rounded-md">
                        {a.asset_number}
                      </span>
                    </Td>
                    <Td>
                      <div>
                        <span className="font-medium text-slate-900 dark:text-slate-100">{a.name}</span>
                        {a.location && <p className="text-xs text-slate-500 mt-0.5">{a.location}</p>}
                      </div>
                    </Td>
                    <Td><span className="text-slate-500 dark:text-slate-400 text-sm">{a.asset_categories?.name || '—'}</span></Td>
                    <Td><span className="text-sm text-slate-600 dark:text-slate-400">{a.purchase_date}</span></Td>
                    <Td><span className="font-mono text-sm">${fmt(a.purchase_cost)}</span></Td>
                    <Td>
                      <div>
                        <span className="font-mono text-sm font-semibold text-orange-600 dark:text-orange-400">
                          ${fmt(a.book_value)}
                        </span>
                        <span className="text-xs text-slate-500 ml-1">(-{deprPct}%)</span>
                      </div>
                    </Td>
                    <Td><Badge color={s?.color || 'default'}>{s?.label || a.status}</Badge></Td>
                    <Td onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Link to={`/assets/list/${a.id}`}>
                          <Button variant="ghost" size="xs"><Eye className="w-3.5 h-3.5" /></Button>
                        </Link>
                        <PermissionGate action="edit" moduleId="assets">
                          <Button variant="ghost" size="xs" onClick={() => openEdit(a)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate action="delete" moduleId="assets">
                          <Button variant="danger" size="xs" onClick={() => handleDelete(a)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </PermissionGate>
                      </div>
                    </Td>
                  </Tr>
                )
              })}
            </Tbody>
          </Table>
        )}

        <Pagination
          page={page} totalPages={totalPages} onPageChange={setPage}
          total={total} pageSize={PAGE_SIZE} label="assets"
          className="border-t border-surface-200 dark:border-surface-800"
        />
      </Card>

      <AssetModal
        open={showModal} onClose={closeModal} onSaved={refetch}
        asset={editAsset} categories={categories} assetProducts={assetProducts}
      />
    </div>
  )
}
