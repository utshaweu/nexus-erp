import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Pencil, Trash2, Package, Tag, DollarSign } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card,
  Modal, Input, Select, Spinner, EmptyState,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import {
  PAGE_SIZE_TABLE as PAGE_SIZE,
  PRODUCT_CATEGORIES,
  PRODUCT_UNITS,
  PRODUCT_STATUS,
  PRODUCT_STATUS_TABS,
} from '@shared/lib/constants'

const productSchema = z.object({
  name:            z.string().trim().min(1, 'Product name is required'),
  sku:             z.string().trim().min(1, 'SKU is required'),
  category:        z.string().min(1, 'Category is required'),
  unit_of_measure: z.string().min(1, 'Unit of measure is required'),
  cost_price:      z.coerce.number({ invalid_type_error: 'Enter a valid price' }).min(0, 'Must be ≥ 0'),
  sale_price:      z.coerce.number({ invalid_type_error: 'Enter a valid price' }).min(0, 'Must be ≥ 0'),
  reorder_qty:     z.coerce.number({ invalid_type_error: 'Enter a valid quantity' }).min(0, 'Must be ≥ 0'),
  status:          z.enum(['active', 'inactive', 'archived']),
  description:     z.string().trim().optional(),
})

const DEFAULT_VALUES = {
  name: '', sku: '', category: '', unit_of_measure: 'unit',
  cost_price: 0, sale_price: 0, reorder_qty: 0, status: 'active', description: '',
}

// ── ProductModal ──────────────────────────────────────────────────────────────

function ProductModal({ open, onClose, onSaved, product }) {
  const { tenantId } = useTenant()
  const isEdit = Boolean(product)

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(productSchema), defaultValues: DEFAULT_VALUES })

  useEffect(() => {
    if (!open) return
    reset(product ? {
      name:            product.name            || '',
      sku:             product.sku             || '',
      category:        product.category        || '',
      unit_of_measure: product.unit_of_measure || 'unit',
      cost_price:      product.cost_price      ?? 0,
      sale_price:      product.sale_price      ?? 0,
      reorder_qty:     product.reorder_qty     ?? 0,
      status:          product.status          || 'active',
      description:     product.description     || '',
    } : DEFAULT_VALUES)
  }, [open, product, reset])

  const onSubmit = async (data) => {
    const payload = {
      name: data.name, sku: data.sku, category: data.category,
      unit_of_measure: data.unit_of_measure,
      cost_price: data.cost_price, sale_price: data.sale_price,
      reorder_qty: data.reorder_qty, status: data.status,
      description: data.description || null,
    }
    if (isEdit) {
      const { error } = await supabase
        .from('products')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', product.id)
      if (error) { toast.error(error.message); return }
      toast.success('Product updated.')
    } else {
      const { error } = await supabase.from('products').insert({ ...payload, tenant_id: tenantId })
      if (error) { toast.error(error.message); return }
      toast.success('Product created.')
    }
    onSaved(); onClose()
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? 'Edit Product' : 'New Product'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-5">

          <Input
            label="Product Name"
            placeholder="e.g. USB-C Cable 2m"
            error={errors.name?.message}
            {...register('name')}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="SKU"
              placeholder="e.g. SKU-001"
              error={errors.sku?.message}
              {...register('sku')}
            />
            <div>
              <Select label="Category" error={errors.category?.message} {...register('category')}>
                <option value="">Select category…</option>
                {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Select label="Unit of Measure" {...register('unit_of_measure')}>
                {PRODUCT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </Select>
            </div>
            <div>
              <Select label="Status" {...register('status')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </Select>
            </div>
          </div>

          {/* Pricing section */}
          <div className="rounded-xl bg-slate-50 dark:bg-surface-800/60 p-4 space-y-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Pricing & Stock
            </p>
            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Cost Price"
                type="number" step="0.01" min="0" placeholder="0.00"
                error={errors.cost_price?.message}
                {...register('cost_price')}
              />
              <Input
                label="Sale Price"
                type="number" step="0.01" min="0" placeholder="0.00"
                error={errors.sale_price?.message}
                {...register('sale_price')}
              />
              <Input
                label="Reorder Qty"
                type="number" step="1" min="0" placeholder="0"
                error={errors.reorder_qty?.message}
                {...register('reorder_qty')}
              />
            </div>
          </div>

          <Input
            label="Description (optional)"
            placeholder="Short product description"
            {...register('description')}
          />

          <div className="flex gap-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              {isEdit ? 'Save Changes' : 'Create Product'}
            </Button>
          </div>

        </div>
      </form>
    </Modal>
  )
}

// ── Stat chip ─────────────────────────────────────────────────────────────────

function StatChip({ value, label, color }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg
                    bg-slate-50 dark:bg-surface-800
                    border border-surface-200 dark:border-surface-700">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{value}</span>
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Products() {
  const { tenantId } = useTenant()
  const [products,     setProducts]     = useState([])
  const [total,        setTotal]        = useState(0)
  const [page,         setPage]         = useState(1)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading,      setLoading]      = useState(true)
  const [showModal,    setShowModal]    = useState(false)
  const [editProduct,  setEditProduct]  = useState(null)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const fetchProducts = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      let query = supabase
        .from('products')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('name')
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (statusFilter !== 'all') query = query.eq('status', statusFilter)
      if (search.trim()) {
        query = query.or(
          `name.ilike.%${search.trim()}%,sku.ilike.%${search.trim()}%,category.ilike.%${search.trim()}%`,
        )
      }

      const { data, count, error } = await query
      if (error) throw error
      setProducts(data || [])
      setTotal(count || 0)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId, page, search, statusFilter])

  useEffect(() => { fetchProducts() }, [fetchProducts])
  useEffect(() => { setPage(1) }, [search, statusFilter])

  const openNew    = ()  => { setEditProduct(null); setShowModal(true)  }
  const openEdit   = (p) => { setEditProduct(p);    setShowModal(true)  }
  const closeModal = () => { setShowModal(false);   setEditProduct(null) }

  const handleDelete = async (p) => {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return
    const { error } = await supabase.from('products').delete().eq('id', p.id)
    if (error) { toast.error(error.message); return }
    toast.success('Product deleted.')
    fetchProducts()
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

      {/* Summary chips */}
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
        {/* Toolbar */}
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

          {/* Status tabs — pill style */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-surface-800">
            {PRODUCT_STATUS_TABS.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
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

        {/* Body */}
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
        onSaved={fetchProducts}
        product={editProduct}
      />
    </div>
  )
}
