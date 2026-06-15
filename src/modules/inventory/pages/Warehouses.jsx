import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Warehouse, MapPin, Pencil, Trash2, Search, CheckCircle2, XCircle, Gauge, X } from 'lucide-react'
import {
  Button, Badge, PageHeader, Card, Modal, Input, Select, Spinner,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import toast from '@shared/lib/toast'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'

const warehouseSchema = z.object({
  code:         z.string().trim().min(1, 'Code is required').max(20, 'Max 20 characters'),
  name:         z.string().trim().min(1, 'Warehouse name is required'),
  location:     z.string().trim().optional(),
  capacity_pct: z.coerce.number({ invalid_type_error: 'Enter a number' })
                  .min(0, 'Min 0').max(100, 'Max 100').optional().default(0),
  status:       z.enum(['active', 'inactive']),
})

const DEFAULT_VALUES = { code: '', name: '', location: '', capacity_pct: 0, status: 'active' }

// ── WarehouseModal ────────────────────────────────────────────────────────────

function WarehouseModal({ open, onClose, onSaved, warehouse }) {
  const { tenantId } = useTenant()
  const isEdit = Boolean(warehouse)

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(warehouseSchema), defaultValues: DEFAULT_VALUES })

  useEffect(() => {
    if (!open) return
    reset(warehouse ? {
      code:         warehouse.code         || '',
      name:         warehouse.name         || '',
      location:     warehouse.location     || '',
      capacity_pct: warehouse.capacity_pct ?? 0,
      status:       warehouse.status       || 'active',
    } : DEFAULT_VALUES)
  }, [open, warehouse, reset])

  const onSubmit = async (data) => {
    const payload = {
      code:         data.code,
      name:         data.name,
      location:     data.location     || null,
      capacity_pct: data.capacity_pct ?? 0,
      status:       data.status,
    }
    if (isEdit) {
      const { error } = await supabase.from('warehouses').update(payload).eq('id', warehouse.id)
      if (error) { toast.error(error.message); return }
      toast.success('Warehouse updated.')
    } else {
      const { error } = await supabase.from('warehouses').insert({ ...payload, tenant_id: tenantId })
      if (error) { toast.error(error.message); return }
      toast.success('Warehouse created.')
    }
    onSaved(); onClose()
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? 'Edit Warehouse' : 'New Warehouse'} size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-5">

          {/* Code + Status row */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Warehouse Code"
              placeholder="e.g. WH-MAIN"
              error={errors.code?.message}
              {...register('code')}
            />
            <div>
              <Select label="Status" {...register('status')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>
          </div>

          <Input
            label="Warehouse Name"
            placeholder="e.g. Main Warehouse"
            error={errors.name?.message}
            {...register('name')}
          />

          <Input
            label="Location"
            placeholder="City, Country"
            {...register('location')}
          />

          {/* Capacity slider-style input */}
          <div className="space-y-2">
            <Input
              label="Capacity Used (%)"
              type="number"
              min="0"
              max="100"
              step="1"
              placeholder="0"
              error={errors.capacity_pct?.message}
              {...register('capacity_pct')}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              {isEdit ? 'Save Changes' : 'Create Warehouse'}
            </Button>
          </div>

        </div>
      </form>
    </Modal>
  )
}

// ── Capacity helpers ──────────────────────────────────────────────────────────

function capacityConfig(pct) {
  if (pct >= 90) return { color: '#ef4444', bg: 'bg-red-500',    label: 'Critical', badge: 'red'    }
  if (pct >= 70) return { color: '#f59e0b', bg: 'bg-amber-500',  label: 'High',     badge: 'yellow' }
  if (pct >= 40) return { color: '#3b82f6', bg: 'bg-blue-500',   label: 'Normal',   badge: 'blue'   }
  return              { color: '#10b981', bg: 'bg-emerald-500', label: 'Low',      badge: 'green'  }
}

// ── WarehouseCard ─────────────────────────────────────────────────────────────

function WarehouseCard({ warehouse: wh, onEdit, onDelete }) {
  const pct    = Math.min(Number(wh.capacity_pct || 0), 100)
  const capCfg = capacityConfig(pct)

  return (
    <div className="group relative rounded-2xl overflow-hidden
                    bg-white dark:bg-surface-900
                    border border-surface-200 dark:border-surface-800
                    shadow-sm hover:shadow-md dark:hover:shadow-surface-800/60
                    transition-all duration-200 hover:-translate-y-0.5">

      {/* Coloured top accent bar */}
      <div className="h-1 w-full" style={{ backgroundColor: capCfg.color }} />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between mb-4">
          {/* Icon */}
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: `${capCfg.color}18`,
              border:          `1px solid ${capCfg.color}35`,
            }}
          >
            <Warehouse className="w-5 h-5" style={{ color: capCfg.color }} />
          </div>

          {/* Status + actions */}
          <div className="flex items-center gap-1.5">
            <Badge color={wh.status === 'active' ? 'green' : 'default'}>
              {wh.status === 'active'
                ? <><CheckCircle2 className="w-3 h-3 inline mr-0.5" />Active</>
                : <><XCircle     className="w-3 h-3 inline mr-0.5" />Inactive</>}
            </Badge>
          </div>
        </div>

        {/* Name + code */}
        <h3 className="font-display font-bold text-base text-slate-900 dark:text-slate-100 leading-tight">
          {wh.name}
        </h3>
        <p className="mt-0.5 text-xs font-mono font-medium text-slate-400 dark:text-slate-500 tracking-wider">
          {wh.code}
        </p>

        {/* Location */}
        {wh.location && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{wh.location}</span>
          </div>
        )}

        {/* Capacity section */}
        <div className="mt-4 pt-4 border-t border-surface-100 dark:border-surface-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Capacity Used
            </span>
            <div className="flex items-center gap-2">
              <Badge color={capCfg.badge} className="text-[10px]">{capCfg.label}</Badge>
              <span className="text-xs font-bold" style={{ color: capCfg.color }}>{pct}%</span>
            </div>
          </div>
          <div className="h-2 rounded-full bg-slate-100 dark:bg-surface-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: capCfg.color }}
            />
          </div>
        </div>

        {/* Action buttons — appear on hover */}
        <div className="mt-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <PermissionGate action="edit" moduleId="inventory">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => onEdit(wh)}
            >
              <Pencil className="w-3.5 h-3.5" />Edit
            </Button>
          </PermissionGate>
          <PermissionGate action="delete" moduleId="inventory">
            <Button
              variant="danger"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => onDelete(wh)}
            >
              <Trash2 className="w-3.5 h-3.5" />Delete
            </Button>
          </PermissionGate>
        </div>
      </div>
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyWarehouses({ onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="relative mb-6">
        {/* Decorative rings */}
        <div className="absolute inset-0 rounded-full bg-blue-500/5 dark:bg-blue-500/10 scale-[2.5]" />
        <div className="absolute inset-0 rounded-full bg-blue-500/8 dark:bg-blue-500/15 scale-[1.8]" />
        <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/10
                        border border-blue-500/20 flex items-center justify-center">
          <Warehouse className="w-9 h-9 text-blue-400" />
        </div>
      </div>
      <h3 className="text-lg font-display font-bold text-slate-800 dark:text-slate-200 mb-2">
        No warehouses yet
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-xs mb-6">
        Create your first warehouse to start managing stock locations and inventory movements.
      </p>
      <PermissionGate action="create" moduleId="inventory">
        <Button onClick={onAdd} className="gap-2">
          <Plus className="w-4 h-4" />Create First Warehouse
        </Button>
      </PermissionGate>
    </div>
  )
}

// ── Summary stat chip ─────────────────────────────────────────────────────────

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

// ── Capacity filter config ────────────────────────────────────────────────────

const CAPACITY_FILTERS = [
  { key: 'all',      label: 'All',      match: () => true },
  { key: 'low',      label: 'Low',      match: (p) => p < 40   },
  { key: 'normal',   label: 'Normal',   match: (p) => p >= 40 && p < 70  },
  { key: 'high',     label: 'High',     match: (p) => p >= 70 && p < 90  },
  { key: 'critical', label: 'Critical', match: (p) => p >= 90  },
]

const CAPACITY_COLORS = {
  all:      '#6366f1',
  low:      '#10b981',
  normal:   '#3b82f6',
  high:     '#f59e0b',
  critical: '#ef4444',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Warehouses() {
  const { tenantId }      = useTenant()
  const [warehouses,      setWarehouses]      = useState([])
  const [loading,         setLoading]         = useState(true)
  const [search,          setSearch]          = useState('')
  const [statusFilter,    setStatusFilter]    = useState('all')
  const [capacityFilter,  setCapacityFilter]  = useState('all')
  const [showModal,       setShowModal]       = useState(false)
  const [editWarehouse,   setEditWarehouse]   = useState(null)

  const fetchWarehouses = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name')
      if (error) throw error
      setWarehouses(data || [])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { fetchWarehouses() }, [fetchWarehouses])

  const openNew    = ()    => { setEditWarehouse(null); setShowModal(true)  }
  const openEdit   = (wh)  => { setEditWarehouse(wh);  setShowModal(true)  }
  const closeModal = ()    => { setShowModal(false);   setEditWarehouse(null) }

  const handleDelete = async (wh) => {
    if (!window.confirm(`Delete warehouse "${wh.name}"? This cannot be undone.`)) return
    const { error } = await supabase.from('warehouses').delete().eq('id', wh.id)
    if (error) { toast.error(error.message); return }
    toast.success('Warehouse deleted.')
    fetchWarehouses()
  }

  const clearFilters = () => { setSearch(''); setStatusFilter('all'); setCapacityFilter('all') }
  const hasActiveFilters = search.trim() || statusFilter !== 'all' || capacityFilter !== 'all'

  // Client-side filter — search + status + capacity
  const capMatch = CAPACITY_FILTERS.find(f => f.key === capacityFilter)?.match ?? (() => true)
  const filtered = warehouses.filter(wh => {
    const pct = Number(wh.capacity_pct || 0)
    const matchesSearch   = !search.trim() ||
      wh.name.toLowerCase().includes(search.toLowerCase()) ||
      wh.code.toLowerCase().includes(search.toLowerCase()) ||
      (wh.location || '').toLowerCase().includes(search.toLowerCase())
    const matchesStatus   = statusFilter === 'all' || wh.status === statusFilter
    const matchesCapacity = capMatch(pct)
    return matchesSearch && matchesStatus && matchesCapacity
  })

  const activeCount   = warehouses.filter(w => w.status === 'active').length
  const inactiveCount = warehouses.filter(w => w.status === 'inactive').length
  const avgCapacity   = warehouses.length
    ? Math.round(warehouses.reduce((s, w) => s + Number(w.capacity_pct || 0), 0) / warehouses.length)
    : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouses"
        subtitle="Manage stock locations and capacity"
        breadcrumb="Inventory / Warehouses"
        actions={
          <PermissionGate action="create" moduleId="inventory">
            <Button onClick={openNew} className="gap-2">
              <Plus className="w-4 h-4" />New Warehouse
            </Button>
          </PermissionGate>
        }
      />

      {/* Summary chips */}
      {!loading && warehouses.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <StatChip value={warehouses.length} label="Total"    color="#6366f1" />
          <StatChip value={activeCount}        label="Active"   color="#10b981" />
          <StatChip value={inactiveCount}      label="Inactive" color="#94a3b8" />
          <StatChip value={`${avgCapacity}%`}  label="Avg Capacity" color="#f59e0b" />
        </div>
      )}

      {/* Toolbar */}
      {!loading && warehouses.length > 0 && (
        <Card className="p-4 space-y-3">
          {/* Row 1: search + status */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-xs
                            px-3 py-2 rounded-lg
                            bg-slate-50 dark:bg-surface-800
                            border border-surface-200 dark:border-surface-700">
              <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, code, location…"
                className="bg-transparent text-sm text-slate-700 dark:text-slate-300
                           placeholder:text-slate-400 dark:placeholder:text-slate-600
                           flex-1 outline-none"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status tabs */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-surface-800">
              {['all', 'active', 'inactive'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all capitalize ${
                    statusFilter === s
                      ? 'bg-white dark:bg-surface-700 text-slate-800 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {s === 'all' ? 'All Status' : s}
                </button>
              ))}
            </div>

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                           text-red-500 dark:text-red-400
                           bg-red-50 dark:bg-red-500/10
                           border border-red-200 dark:border-red-500/20
                           hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
              >
                <X className="w-3 h-3" />Clear filters
              </button>
            )}
          </div>

          {/* Row 2: capacity filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              <Gauge className="w-3.5 h-3.5" />
              Capacity:
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {CAPACITY_FILTERS.map(({ key, label }) => {
                const color = CAPACITY_COLORS[key]
                const isActive = capacityFilter === key
                return (
                  <button
                    key={key}
                    onClick={() => setCapacityFilter(key)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                                border transition-all ${
                      isActive
                        ? 'text-white border-transparent shadow-sm'
                        : 'bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-surface-600'
                    }`}
                    style={isActive ? { backgroundColor: color, borderColor: color } : {}}
                  >
                    {key !== 'all' && (
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.7)' : color }}
                      />
                    )}
                    {label}
                    {/* Show count per capacity bucket */}
                    {key !== 'all' && (
                      <span
                        className={`text-[10px] font-bold ${isActive ? 'opacity-80' : 'opacity-60'}`}
                      >
                        ({warehouses.filter(w =>
                          CAPACITY_FILTERS.find(f => f.key === key)?.match(Number(w.capacity_pct || 0))
                        ).length})
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Active filter summary */}
          {hasActiveFilters && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{filtered.length}</span> of{' '}
              <span className="font-semibold">{warehouses.length}</span> warehouses
            </p>
          )}
        </Card>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20
                          flex items-center justify-center">
            <Warehouse className="w-5 h-5 text-blue-400 animate-pulse" />
          </div>
          <p className="text-sm text-slate-400">Loading warehouses…</p>
        </div>
      ) : warehouses.length === 0 ? (
        <EmptyWarehouses onAdd={openNew} />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-surface-800
                          border border-surface-200 dark:border-surface-700
                          flex items-center justify-center">
            <Search className="w-6 h-6 text-slate-400 dark:text-slate-500" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No warehouses match</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              Try adjusting your search, status, or capacity filter
            </p>
          </div>
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                       text-brand-600 dark:text-brand-400
                       bg-brand-50 dark:bg-brand-500/10
                       border border-brand-200 dark:border-brand-500/20
                       hover:bg-brand-100 dark:hover:bg-brand-500/20 transition-colors"
          >
            <X className="w-3 h-3" />Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map(wh => (
            <WarehouseCard
              key={wh.id}
              warehouse={wh}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <WarehouseModal
        open={showModal}
        onClose={closeModal}
        onSaved={fetchWarehouses}
        warehouse={editWarehouse}
      />
    </div>
  )
}
