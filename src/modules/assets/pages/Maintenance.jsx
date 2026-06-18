import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Pencil, Trash2, Wrench } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card,
  Modal, Input, Select, EmptyState,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import {
  PAGE_SIZE_TABLE as PAGE_SIZE,
  MAINTENANCE_TYPE,
  MAINTENANCE_STATUS,
  MAINTENANCE_STATUS_TABS,
} from '@shared/lib/constants'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── Validation ────────────────────────────────────────────────────────────────

const maintenanceSchema = z.object({
  asset_id:         z.string().min(1, 'Asset is required'),
  maintenance_type: z.enum(['preventive', 'corrective', 'emergency', 'inspection']),
  status:           z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']),
  scheduled_date:   z.string().min(1, 'Scheduled date is required'),
  completed_date:   z.string().optional(),
  description:      z.string().trim().min(1, 'Description is required'),
  cost:             z.coerce.number({ invalid_type_error: 'Enter a valid amount' }).min(0, 'Must be 0 or more'),
  performed_by:     z.string().optional(),
  notes:            z.string().optional(),
})

const DEFAULT_VALUES = {
  asset_id:         '',
  maintenance_type: 'preventive',
  status:           'scheduled',
  scheduled_date:   new Date().toISOString().slice(0, 10),
  completed_date:   '',
  description:      '',
  cost:             0,
  performed_by:     '',
  notes:            '',
}

// ── Maintenance Modal ─────────────────────────────────────────────────────────

function MaintenanceModal({ open, onClose, onSaved, log, allAssets }) {
  const { tenantId } = useTenant()
  const isEdit = Boolean(log)

  const {
    register, handleSubmit, reset, watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(maintenanceSchema), defaultValues: DEFAULT_VALUES })

  const watchedStatus = watch('status')

  useEffect(() => {
    if (!open) return
    reset(log
      ? {
          asset_id:         log.asset_id,
          maintenance_type: log.maintenance_type,
          status:           log.status,
          scheduled_date:   log.scheduled_date,
          completed_date:   log.completed_date    || '',
          description:      log.description,
          cost:             log.cost,
          performed_by:     log.performed_by      || '',
          notes:            log.notes             || '',
        }
      : DEFAULT_VALUES
    )
  }, [open, log, reset])

  const onSubmit = async (data) => {
    const payload = {
      asset_id:         data.asset_id,
      maintenance_type: data.maintenance_type,
      status:           data.status,
      scheduled_date:   data.scheduled_date,
      completed_date:   data.completed_date   || null,
      description:      data.description,
      cost:             parseFloat(data.cost),
      performed_by:     data.performed_by     || null,
      notes:            data.notes            || null,
      updated_at:       new Date().toISOString(),
    }

    if (isEdit) {
      const { error } = await supabase.from('asset_maintenance_logs').update(payload).eq('id', log.id)
      if (error) { toast.error(error.message); return }

      // Sync asset status with maintenance status
      if (data.status === 'in_progress' || data.status === 'scheduled') {
        await supabase.from('assets')
          .update({ status: 'maintenance', updated_at: new Date().toISOString() })
          .eq('id', data.asset_id)
          .eq('status', 'active')
      } else if (data.status === 'completed' || data.status === 'cancelled') {
        const { data: otherLogs } = await supabase
          .from('asset_maintenance_logs')
          .select('id')
          .eq('asset_id', data.asset_id)
          .in('status', ['scheduled', 'in_progress'])
          .neq('id', log.id)
        if (!otherLogs?.length) {
          await supabase.from('assets')
            .update({ status: 'active', updated_at: new Date().toISOString() })
            .eq('id', data.asset_id)
            .eq('status', 'maintenance')
        }
      }

      toast.success('Maintenance log updated.')
    } else {
      const { data: num, error: numErr } = await supabase.rpc('generate_maintenance_log_number')
      if (numErr) { toast.error(numErr.message); return }

      const { error } = await supabase.from('asset_maintenance_logs').insert({
        ...payload,
        tenant_id:  tenantId,
        log_number: num,
      })
      if (error) { toast.error(error.message); return }

      if (data.status === 'in_progress' || data.status === 'scheduled') {
        await supabase.from('assets')
          .update({ status: 'maintenance', updated_at: new Date().toISOString() })
          .eq('id', data.asset_id)
          .eq('status', 'active')
      }
      toast.success('Maintenance log created.')
    }

    onSaved(); onClose()
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEdit ? `Edit ${log?.log_number}` : 'New Maintenance Log'}
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Asset
          </label>
          <select
            className={`w-full px-3 py-2 rounded-lg text-sm
              text-slate-900 dark:text-slate-200
              bg-white dark:bg-surface-900
              border ${errors.asset_id ? 'border-red-500' : 'border-surface-200 dark:border-surface-700'}
              focus:outline-none focus:ring-1 focus:ring-brand-500`}
            {...register('asset_id')}
          >
            <option value="">Select an asset…</option>
            {allAssets.map(a => (
              <option key={a.id} value={a.id}>{a.asset_number} — {a.name}</option>
            ))}
          </select>
          {errors.asset_id && (
            <p className="text-xs text-red-500">{errors.asset_id.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select label="Type" {...register('maintenance_type')}>
            {Object.entries(MAINTENANCE_TYPE).map(([v, { label }]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </Select>
          <Select label="Status" {...register('status')}>
            {Object.entries(MAINTENANCE_STATUS).map(([v, { label }]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </Select>
        </div>

        <Input
          label="Description"
          placeholder="Describe the maintenance work"
          error={errors.description?.message}
          {...register('description')}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Scheduled Date"
            type="date"
            error={errors.scheduled_date?.message}
            {...register('scheduled_date')}
          />
          <Input
            label="Completed Date"
            type="date"
            {...register('completed_date')}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Cost"
            type="number" min="0" step="0.01" placeholder="0.00"
            error={errors.cost?.message}
            {...register('cost')}
          />
          <Input
            label="Performed By (optional)"
            placeholder="Technician or vendor name"
            {...register('performed_by')}
          />
        </div>

        <Input
          label="Notes (optional)"
          placeholder="Additional details"
          {...register('notes')}
        />

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" loading={isSubmitting}>
            {isEdit ? 'Save Changes' : 'Create Log'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Maintenance() {
  const { tenantId }   = useTenant()
  const [logs,         setLogs]         = useState([])
  const [allAssets,    setAllAssets]    = useState([])
  const [total,        setTotal]        = useState(0)
  const [page,         setPage]         = useState(1)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [assetFilter,  setAssetFilter]  = useState('')
  const [loading,      setLoading]      = useState(true)
  const [showModal,    setShowModal]    = useState(false)
  const [editLog,      setEditLog]      = useState(null)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const fetchLogs = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      let query = supabase
        .from('asset_maintenance_logs')
        .select('*, assets(name, asset_number)', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('scheduled_date', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (statusFilter !== 'all') query = query.eq('status', statusFilter)
      if (assetFilter)            query = query.eq('asset_id', assetFilter)
      if (search.trim()) {
        query = query.or(
          `log_number.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%,performed_by.ilike.%${search.trim()}%`
        )
      }

      const { data, count, error } = await query
      if (error) throw error
      setLogs(data || [])
      setTotal(count || 0)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId, page, search, statusFilter, assetFilter])

  const fetchAssets = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase
      .from('assets')
      .select('id, asset_number, name')
      .eq('tenant_id', tenantId)
      .order('name')
    setAllAssets(data || [])
  }, [tenantId])

  useEffect(() => { fetchLogs()    }, [fetchLogs])
  useEffect(() => { fetchAssets()  }, [fetchAssets])
  useEffect(() => { setPage(1) },     [search, statusFilter, assetFilter])

  const openNew    = ()  => { setEditLog(null); setShowModal(true) }
  const openEdit   = (l) => { setEditLog(l);    setShowModal(true) }
  const closeModal = ()  => { setShowModal(false); setEditLog(null) }

  const handleDelete = async (l) => {
    if (!window.confirm(`Delete maintenance log ${l.log_number}? This cannot be undone.`)) return
    const { error } = await supabase.from('asset_maintenance_logs').delete().eq('id', l.id)
    if (error) { toast.error(error.message); return }
    toast.success('Maintenance log deleted.')
    fetchLogs()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance"
        subtitle="Track and manage asset maintenance and service records"
        breadcrumb="Assets / Maintenance"
        actions={
          <PermissionGate action="create" moduleId="assets">
            <Button size="sm" onClick={openNew}>
              <Plus className="w-4 h-4" />New Log
            </Button>
          </PermissionGate>
        }
      />

      <Card>
        {/* Toolbar */}
        <div className="flex items-center gap-3 p-4 border-b border-surface-200 dark:border-surface-800 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[180px] max-w-xs
                          px-3 py-2 rounded-lg
                          bg-slate-50 dark:bg-surface-800
                          border border-surface-200 dark:border-surface-700">
            <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search logs…"
              className="bg-transparent text-sm text-slate-700 dark:text-slate-300
                         placeholder:text-slate-400 dark:placeholder:text-slate-600
                         flex-1 outline-none"
            />
          </div>

          {/* Asset filter */}
          <select
            value={assetFilter}
            onChange={e => setAssetFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm
                       text-slate-900 dark:text-slate-200
                       bg-slate-50 dark:bg-surface-800
                       border border-surface-200 dark:border-surface-700
                       focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All Assets</option>
            {allAssets.map(a => (
              <option key={a.id} value={a.id}>{a.asset_number} — {a.name}</option>
            ))}
          </select>

          {/* Status filter */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-surface-800">
            {MAINTENANCE_STATUS_TABS.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  statusFilter === s
                    ? 'bg-white dark:bg-surface-700 text-slate-800 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {s === 'all' ? 'All' : MAINTENANCE_STATUS[s]?.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-orange-400 animate-pulse" />
            </div>
            <p className="text-sm text-slate-400">Loading maintenance logs…</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full bg-orange-500/5 dark:bg-orange-500/10 scale-[2.5]" />
              <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-600/10
                              border border-orange-500/20 flex items-center justify-center">
                {search || statusFilter !== 'all' || assetFilter
                  ? <Search className="w-9 h-9 text-slate-400" />
                  : <Wrench className="w-9 h-9 text-orange-400" />}
              </div>
            </div>
            <h3 className="text-base font-display font-bold text-slate-800 dark:text-slate-200 mb-1">
              {search || statusFilter !== 'all' || assetFilter ? 'No logs match' : 'No maintenance logs yet'}
            </h3>
            <p className="text-sm text-slate-500 text-center max-w-xs mb-5">
              {search || statusFilter !== 'all' || assetFilter
                ? 'Try adjusting your search or filters.'
                : 'Create your first maintenance record to track asset servicing.'}
            </p>
            {!search && statusFilter === 'all' && !assetFilter && (
              <PermissionGate action="create" moduleId="assets">
                <Button size="sm" onClick={openNew}><Plus className="w-4 h-4" />New Maintenance Log</Button>
              </PermissionGate>
            )}
          </div>
        ) : (
          <Table>
            <Thead>
              <Th>Log #</Th>
              <Th>Asset</Th>
              <Th>Type</Th>
              <Th>Description</Th>
              <Th>Scheduled</Th>
              <Th>Completed</Th>
              <Th>Cost</Th>
              <Th>Performed By</Th>
              <Th>Status</Th>
              <Th></Th>
            </Thead>
            <Tbody>
              {logs.map(l => {
                const mt = MAINTENANCE_TYPE[l.maintenance_type]
                const ms = MAINTENANCE_STATUS[l.status]
                return (
                  <Tr key={l.id} onClick={() => openEdit(l)}>
                    <Td>
                      <span className="font-mono text-xs font-medium
                                       text-orange-600 dark:text-orange-400
                                       bg-orange-50 dark:bg-orange-500/10
                                       px-2 py-0.5 rounded-md whitespace-nowrap">
                        {l.log_number}
                      </span>
                    </Td>
                    <Td>
                      <div>
                        <span className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                          {l.assets?.name || '—'}
                        </span>
                        <p className="text-xs text-orange-500 font-mono">{l.assets?.asset_number}</p>
                      </div>
                    </Td>
                    <Td>
                      <Badge color={mt?.color || 'default'}>{mt?.label || l.maintenance_type}</Badge>
                    </Td>
                    <Td>
                      <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-[180px] block">
                        {l.description}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-sm text-slate-500">{l.scheduled_date}</span>
                    </Td>
                    <Td>
                      <span className="text-sm text-slate-500">{l.completed_date || '—'}</span>
                    </Td>
                    <Td>
                      <span className="font-mono text-sm">${fmt(l.cost)}</span>
                    </Td>
                    <Td>
                      <span className="text-sm text-slate-500 truncate max-w-[120px] block">
                        {l.performed_by || '—'}
                      </span>
                    </Td>
                    <Td>
                      <Badge color={ms?.color || 'default'}>{ms?.label || l.status}</Badge>
                    </Td>
                    <Td onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <PermissionGate action="edit" moduleId="assets">
                          <Button variant="ghost" size="xs" onClick={() => openEdit(l)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate action="delete" moduleId="assets">
                          <Button variant="danger" size="xs" onClick={e => { e.stopPropagation(); handleDelete(l) }}>
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
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          total={total}
          pageSize={PAGE_SIZE}
          label="logs"
          className="border-t border-surface-200 dark:border-surface-800"
        />
      </Card>

      <MaintenanceModal
        open={showModal}
        onClose={closeModal}
        onSaved={fetchLogs}
        log={editLog}
        allAssets={allAssets}
      />
    </div>
  )
}
