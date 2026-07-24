import { useCallback } from 'react'
import { Plus, Search, Pencil, Trash2, Tag } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card, EmptyState,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { PAGE_SIZE_TABLE as PAGE_SIZE, DEPRECIATION_METHODS } from '@shared/lib/constants'
import { fetchCategories, deleteCategory, toggleCategoryActive } from '../api/categories'
import { useResourceList } from '../hooks/useResourceList'
import CategoryModal from '../components/CategoryModal'

export default function Categories() {
  const { tenantId } = useTenant()

  const fetchFn = useCallback(params => fetchCategories(tenantId, params), [tenantId])
  const {
    items: categories, total, page, setPage, search, setSearch,
    loading, refetch, showModal, editItem: editCat, openNew, openEdit, closeModal,
  } = useResourceList(fetchFn, [tenantId])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const handleDelete = async (c) => {
    if (!window.confirm(`Delete category "${c.name}"? Assets using it will keep the reference but it won't appear in new asset forms.`)) return
    try {
      await deleteCategory(c)
      toast.success('Category deleted.')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleToggleActive = async (c) => {
    try {
      await toggleCategoryActive(c)
      toast.success(c.is_active ? 'Category deactivated.' : 'Category activated.')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asset Categories"
        subtitle="Manage categories and default depreciation settings"
        breadcrumb="Assets / Categories"
        actions={
          <PermissionGate action="create" moduleId="assets">
            <Button size="sm" onClick={openNew}>
              <Plus className="w-4 h-4" />New Category
            </Button>
          </PermissionGate>
        }
      />

      <Card>
        <div className="flex items-center gap-3 p-4 border-b border-surface-200 dark:border-surface-800">
          <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-xs
                          px-3 py-2 rounded-lg
                          bg-slate-50 dark:bg-surface-800
                          border border-surface-200 dark:border-surface-700">
            <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search categories…"
              className="bg-transparent text-sm text-slate-700 dark:text-slate-300
                         placeholder:text-slate-400 dark:placeholder:text-slate-600
                         flex-1 outline-none"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20
                            flex items-center justify-center">
              <Tag className="w-5 h-5 text-orange-400 animate-pulse" />
            </div>
            <p className="text-sm text-slate-400">Loading categories…</p>
          </div>
        ) : categories.length === 0 ? (
          <EmptyState
            icon={Tag}
            title={search ? 'No categories match' : 'No categories yet'}
            description={search
              ? 'Try adjusting your search.'
              : 'Create your first category to organize assets and define depreciation defaults.'}
            action={!search && (
              <PermissionGate action="create" moduleId="assets">
                <Button size="sm" onClick={openNew}><Plus className="w-4 h-4" />New Category</Button>
              </PermissionGate>
            )}
          />
        ) : (
          <Table>
            <Thead>
              <Th>Name</Th>
              <Th>Depreciation Method</Th>
              <Th>Useful Life</Th>
              <Th>Salvage Rate</Th>
              <Th>Status</Th>
              <Th></Th>
            </Thead>
            <Tbody>
              {categories.map(c => (
                <Tr key={c.id}>
                  <Td>
                    <div>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{c.name}</span>
                      {c.description && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[240px]">{c.description}</p>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <span className="text-slate-600 dark:text-slate-400">
                      {DEPRECIATION_METHODS[c.depreciation_method]?.label || c.depreciation_method}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-slate-600 dark:text-slate-400">
                      {c.default_useful_life} yr{c.default_useful_life !== 1 ? 's' : ''}
                    </span>
                  </Td>
                  <Td><span className="text-slate-600 dark:text-slate-400">{c.default_salvage_rate}%</span></Td>
                  <Td>
                    <Badge color={c.is_active ? 'green' : 'default'}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </Td>
                  <Td onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <PermissionGate action="edit" moduleId="assets">
                        <Button variant="ghost" size="xs" onClick={() => openEdit(c)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </PermissionGate>
                      <PermissionGate action="edit" moduleId="assets">
                        <Button variant={c.is_active ? 'outline' : 'success'} size="xs" onClick={() => handleToggleActive(c)}>
                          {c.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                      </PermissionGate>
                      <PermissionGate action="delete" moduleId="assets">
                        <Button variant="danger" size="xs" onClick={() => handleDelete(c)}>
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
          total={total} pageSize={PAGE_SIZE} label="categories"
          className="border-t border-surface-200 dark:border-surface-800"
        />
      </Card>

      <CategoryModal open={showModal} onClose={closeModal} onSaved={refetch} category={editCat} />
    </div>
  )
}
