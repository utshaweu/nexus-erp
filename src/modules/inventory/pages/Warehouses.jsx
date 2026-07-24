import { useState, useEffect, useCallback } from 'react'
import { Plus, Warehouse, Search, X } from 'lucide-react'
import { Button, PageHeader } from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { fetchWarehouses, deleteWarehouse } from '../api/warehouses'
import StatChip from '../components/StatChip'
import WarehouseCard from '../components/WarehouseCard'
import EmptyWarehouses from '../components/EmptyWarehouses'
import WarehouseModal from '../components/WarehouseModal'
import WarehouseFilterBar, { capacityMatch } from '../components/WarehouseFilterBar'

export default function Warehouses() {
  const { tenantId }      = useTenant()
  const [warehouses,      setWarehouses]      = useState([])
  const [loading,         setLoading]         = useState(true)
  const [search,          setSearch]          = useState('')
  const [statusFilter,    setStatusFilter]    = useState('all')
  const [capacityFilter,  setCapacityFilter]  = useState('all')
  const [showModal,       setShowModal]       = useState(false)
  const [editWarehouse,   setEditWarehouse]   = useState(null)

  const refetch = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      setWarehouses(await fetchWarehouses(tenantId))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { refetch() }, [refetch])

  const openNew    = ()    => { setEditWarehouse(null); setShowModal(true)  }
  const openEdit   = (wh)  => { setEditWarehouse(wh);  setShowModal(true)  }
  const closeModal = ()    => { setShowModal(false);   setEditWarehouse(null) }

  const handleDelete = async (wh) => {
    if (!window.confirm(`Delete warehouse "${wh.name}"? This cannot be undone.`)) return
    try {
      await deleteWarehouse(wh)
      toast.success('Warehouse deleted.')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const clearFilters = () => { setSearch(''); setStatusFilter('all'); setCapacityFilter('all') }
  const hasActiveFilters = search.trim() || statusFilter !== 'all' || capacityFilter !== 'all'

  const capMatch = capacityMatch(capacityFilter)
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

      {!loading && warehouses.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <StatChip value={warehouses.length} label="Total"    color="#6366f1" />
          <StatChip value={activeCount}        label="Active"   color="#10b981" />
          <StatChip value={inactiveCount}      label="Inactive" color="#94a3b8" />
          <StatChip value={`${avgCapacity}%`}  label="Avg Capacity" color="#f59e0b" />
        </div>
      )}

      {!loading && warehouses.length > 0 && (
        <WarehouseFilterBar
          search={search} onSearchChange={setSearch}
          statusFilter={statusFilter} onStatusChange={setStatusFilter}
          capacityFilter={capacityFilter} onCapacityChange={setCapacityFilter}
          warehouses={warehouses} filteredCount={filtered.length}
          hasActiveFilters={hasActiveFilters} onClear={clearFilters}
        />
      )}

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
        onSaved={refetch}
        warehouse={editWarehouse}
      />
    </div>
  )
}
