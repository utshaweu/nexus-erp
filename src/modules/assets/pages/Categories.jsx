import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Pencil, Trash2, Tag } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card,
  Modal, Input, Select, EmptyState,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import { PAGE_SIZE_TABLE as PAGE_SIZE, DEPRECIATION_METHODS } from '@shared/lib/constants'

// ── Validation ────────────────────────────────────────────────────────────────

const categorySchema = z.object({
  name:                 z.string().trim().min(1, 'Name is required'),
  description:          z.string().optional(),
  depreciation_method:  z.enum(['straight_line', 'declining_balance']),
  default_useful_life:  z.coerce.number().int().min(1, 'Must be at least 1 year').max(99, 'Max 99 years'),
  default_salvage_rate: z.coerce.number().min(0, 'Must be 0 or more').max(100, 'Must be 100 or less'),
})

const DEFAULT_VALUES = {
  name: '',
  description: '',
  depreciation_method: 'straight_line',
  default_useful_life: 5,
  default_salvage_rate: 10,
}

// ── Category Modal ────────────────────────────────────────────────────────────

function CategoryModal({ open, onClose, onSaved, category }) {
  const { tenantId } = useTenant()
  const isEdit = Boolean(category)

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(categorySchema), defaultValues: DEFAULT_VALUES })

  useEffect(() => {
    if (!open) return
    reset(category
      ? {
          name:                 category.name,
          description:          category.description          || '',
          depreciation_method:  category.depreciation_method,
          default_useful_life:  category.default_useful_life,
          default_salvage_rate: category.default_salvage_rate,
        }
      : DEFAULT_VALUES
    )
  }, [open, category, reset])

  const onSubmit = async (data) => {
    if (isEdit) {
      const { error } = await supabase.from('asset_categories').update(data).eq('id', category.id)
      if (error) { toast.error(error.message); return }
      toast.success('Category updated.')
    } else {
      const { error } = await supabase
        .from('asset_categories')
        .insert({ ...data, tenant_id: tenantId })
      if (error) { toast.error(error.message); return }
      toast.success('Category created.')
    }
    onSaved(); onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Category' : 'New Asset Category'}
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Input
          label="Name"
          placeholder="e.g. IT Equipment"
          error={errors.name?.message}
          {...register('name')}
        />
        <Input
          label="Description (optional)"
          placeholder="Brief description of this category"
          {...register('description')}
        />
        <Select label="Default Depreciation Method" {...register('depreciation_method')}>
          <option value="straight_line">Straight Line</option>
          <option value="declining_balance">Declining Balance (Double)</option>
        </Select>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Default Useful Life (years)"
            type="number" min="1" max="99"
            error={errors.default_useful_life?.message}
            {...register('default_useful_life')}
          />
          <Input
            label="Default Salvage Rate (%)"
            type="number" min="0" max="100" step="0.01"
            error={errors.default_salvage_rate?.message}
            {...register('default_salvage_rate')}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" loading={isSubmitting}>
            {isEdit ? 'Save Changes' : 'Create Category'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Categories() {
  const { tenantId } = useTenant()
  const [categories, setCategories] = useState([])
  const [total,      setTotal]      = useState(0)
  const [page,       setPage]       = useState(1)
  const [search,     setSearch]     = useState('')
  const [loading,    setLoading]    = useState(true)
  const [showModal,  setShowModal]  = useState(false)
  const [editCat,    setEditCat]    = useState(null)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const fetchCategories = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      let query = supabase
        .from('asset_categories')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('name')
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (search.trim()) query = query.ilike('name', `%${search.trim()}%`)

      const { data, count, error } = await query
      if (error) throw error
      setCategories(data || [])
      setTotal(count || 0)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId, page, search])

  useEffect(() => { fetchCategories() }, [fetchCategories])
  useEffect(() => { setPage(1) }, [search])

  const openNew    = ()  => { setEditCat(null); setShowModal(true) }
  const openEdit   = (c) => { setEditCat(c);    setShowModal(true) }
  const closeModal = ()  => { setShowModal(false); setEditCat(null) }

  const handleDelete = async (c) => {
    if (!window.confirm(`Delete category "${c.name}"? Assets using it will keep the reference but it won't appear in new asset forms.`)) return
    const { error } = await supabase.from('asset_categories').delete().eq('id', c.id)
    if (error) { toast.error(error.message); return }
    toast.success('Category deleted.')
    fetchCategories()
  }

  const handleToggleActive = async (c) => {
    const { error } = await supabase
      .from('asset_categories')
      .update({ is_active: !c.is_active })
      .eq('id', c.id)
    if (error) { toast.error(error.message); return }
    toast.success(c.is_active ? 'Category deactivated.' : 'Category activated.')
    fetchCategories()
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
        {/* Toolbar */}
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

        {/* Body */}
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
                  <Td>
                    <span className="text-slate-600 dark:text-slate-400">{c.default_salvage_rate}%</span>
                  </Td>
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
                        <Button
                          variant={c.is_active ? 'outline' : 'success'}
                          size="xs"
                          onClick={() => handleToggleActive(c)}
                        >
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
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          total={total}
          pageSize={PAGE_SIZE}
          label="categories"
          className="border-t border-surface-200 dark:border-surface-800"
        />
      </Card>

      <CategoryModal
        open={showModal}
        onClose={closeModal}
        onSaved={fetchCategories}
        category={editCat}
      />
    </div>
  )
}
