import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Wrench } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { PAGE_SIZE_TABLE as PAGE_SIZE, MAINTENANCE_TYPE, MAINTENANCE_STATUS, MAINTENANCE_STATUS_TABS } from '@shared/lib/constants'
import { fetchAssetOptions } from '../api/assets'
import { fetchMaintenanceLogs, deleteMaintenanceLog } from '../api/maintenance'
import { useResourceList } from '@shared/hooks/useResourceList'
import ListToolbar from '../components/ListToolbar'
import { ListLoading, ListEmptyState } from '../components/ListStates'
import MaintenanceModal from '../components/MaintenanceModal'

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const STATUS_TABS = MAINTENANCE_STATUS_TABS.map(s => ({ value: s, label: s === 'all' ? 'All' : MAINTENANCE_STATUS[s]?.label }))

export default function Maintenance() {
  const { tenantId } = useTenant()
  const [allAssets, setAllAssets] = useState([])
  const [assetFilter, setAssetFilter] = useState('')

  const fetchFn = useCallback(
    ({ page, search, filter }) => fetchMaintenanceLogs(tenantId, { page, search, statusFilter: filter, assetFilter }),
    [tenantId, assetFilter]
  )
  const {
    items: logs, total, page, setPage, search, setSearch, filter: statusFilter, setFilter: setStatusFilter,
    loading, refetch, showModal, editItem: editLog, openNew, openEdit, closeModal,
  } = useResourceList(fetchFn, [tenantId, assetFilter])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  useEffect(() => { fetchAssetOptions(tenantId).then(setAllAssets) }, [tenantId])
  useEffect(() => { setPage(1) }, [assetFilter, setPage])

  const handleDelete = async (l) => {
    if (!window.confirm(`Delete maintenance log ${l.log_number}? This cannot be undone.`)) return
    try {
      await deleteMaintenanceLog(l)
      toast.success('Maintenance log deleted.')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const searching = Boolean(search || statusFilter !== 'all' || assetFilter)

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
        <ListToolbar
          search={search} onSearchChange={setSearch} placeholder="Search logs…"
          tabs={STATUS_TABS} activeTab={statusFilter} onTabChange={setStatusFilter}
        >
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
        </ListToolbar>

        {loading ? (
          <ListLoading icon={Wrench} label="Loading maintenance logs…" />
        ) : logs.length === 0 ? (
          <ListEmptyState
            icon={Wrench} searching={searching} circles={1}
            title="No maintenance logs yet" description="Create your first maintenance record to track asset servicing."
            searchingTitle="No logs match" searchingDescription="Try adjusting your search or filters."
            action={
              <PermissionGate action="create" moduleId="assets">
                <Button size="sm" onClick={openNew}><Plus className="w-4 h-4" />New Maintenance Log</Button>
              </PermissionGate>
            }
          />
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
                        <span className="font-medium text-slate-900 dark:text-slate-100 text-sm">{l.assets?.name || '—'}</span>
                        <p className="text-xs text-orange-500 font-mono">{l.assets?.asset_number}</p>
                      </div>
                    </Td>
                    <Td><Badge color={mt?.color || 'default'}>{mt?.label || l.maintenance_type}</Badge></Td>
                    <Td><span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-[180px] block">{l.description}</span></Td>
                    <Td><span className="text-sm text-slate-500">{l.scheduled_date}</span></Td>
                    <Td><span className="text-sm text-slate-500">{l.completed_date || '—'}</span></Td>
                    <Td><span className="font-mono text-sm">${fmt(l.cost)}</span></Td>
                    <Td><span className="text-sm text-slate-500 truncate max-w-[120px] block">{l.performed_by || '—'}</span></Td>
                    <Td><Badge color={ms?.color || 'default'}>{ms?.label || l.status}</Badge></Td>
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
          page={page} totalPages={totalPages} onPageChange={setPage}
          total={total} pageSize={PAGE_SIZE} label="logs"
          className="border-t border-surface-200 dark:border-surface-800"
        />
      </Card>

      <MaintenanceModal open={showModal} onClose={closeModal} onSaved={refetch} log={editLog} allAssets={allAssets} />
    </div>
  )
}
