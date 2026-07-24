import { useState, useCallback } from 'react'
import { Plus, DollarSign, Eye, Trash2 } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card, EmptyState,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import {
  PAGE_SIZE_TABLE as PAGE_SIZE, PAYROLL_RUN_STATUS, PAYROLL_RUN_STATUS_TABS,
} from '@shared/lib/constants'
import { fetchPayrollRuns, deletePayrollRun } from '../api/payroll'
import { useResourceList } from '@shared/hooks/useResourceList'
import ListToolbar from '../components/ListToolbar'
import { ListLoading } from '../components/ListStates'
import PayrollRunModal, { MONTHS } from '../components/PayrollRunModal'
import RunDetailModal from '../components/RunDetailModal'

const fmt = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const STATUS_TABS = PAYROLL_RUN_STATUS_TABS.map(s => ({ value: s, label: s === 'all' ? 'All' : PAYROLL_RUN_STATUS[s]?.label }))

export default function Payroll() {
  const { tenantId } = useTenant()
  const [showModal, setShowModal] = useState(false)
  const [viewRun,   setViewRun]   = useState(null)

  const fetchFn = useCallback(
    ({ page, search, filter }) => fetchPayrollRuns(tenantId, { page, search, filter }),
    [tenantId]
  )
  const {
    items: runs, total, page, setPage, search, setSearch, filter: statusFilter, setFilter: setStatusFilter,
    loading, refetch,
  } = useResourceList(fetchFn, [tenantId])
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const handleDelete = async (run) => {
    if (!window.confirm(`Delete payroll run ${run.run_number}? All entries will be removed.`)) return
    try {
      await deletePayrollRun(run)
      toast.success('Payroll run deleted.')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        subtitle="Manage monthly payroll runs"
        breadcrumb="HR / Payroll"
        actions={
          <PermissionGate action="create" moduleId="hr">
            <Button size="sm" onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4" />New Payroll Run
            </Button>
          </PermissionGate>
        }
      />

      <Card>
        <ListToolbar
          search={search} onSearchChange={setSearch} placeholder="Search run number…"
          tabs={STATUS_TABS} activeTab={statusFilter} onTabChange={setStatusFilter}
        />

        {loading ? (
          <ListLoading icon={DollarSign} label="Loading payroll runs…" />
        ) : runs.length === 0 ? (
          <EmptyState
            icon={DollarSign}
            title={search || statusFilter !== 'all' ? 'No runs match' : 'No payroll runs yet'}
            description={
              search || statusFilter !== 'all'
                ? 'Try adjusting your search or filter.'
                : 'Create your first monthly payroll run.'
            }
            action={!search && statusFilter === 'all' && (
              <PermissionGate action="create" moduleId="hr">
                <Button size="sm" onClick={() => setShowModal(true)}>
                  <Plus className="w-4 h-4" />New Payroll Run
                </Button>
              </PermissionGate>
            )}
          />
        ) : (
          <Table>
            <Thead>
              <Th>Run #</Th>
              <Th>Period</Th>
              <Th>Total Gross</Th>
              <Th>Total Deductions</Th>
              <Th>Total Net</Th>
              <Th>Status</Th>
              <Th></Th>
            </Thead>
            <Tbody>
              {runs.map(run => {
                const s = PAYROLL_RUN_STATUS[run.status]
                return (
                  <Tr key={run.id}>
                    <Td>
                      <span className="font-mono text-xs font-medium
                                       text-pink-600 dark:text-pink-400
                                       bg-pink-50 dark:bg-pink-500/10
                                       px-2 py-0.5 rounded-md">
                        {run.run_number}
                      </span>
                    </Td>
                    <Td>
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {MONTHS[(run.period_month || 1) - 1]} {run.period_year}
                      </span>
                    </Td>
                    <Td><span className="font-mono text-sm">${fmt(run.total_gross)}</span></Td>
                    <Td><span className="font-mono text-sm text-red-600 dark:text-red-400">-${fmt(run.total_deductions)}</span></Td>
                    <Td><span className="font-mono text-sm font-bold text-pink-600 dark:text-pink-400">${fmt(run.total_net)}</span></Td>
                    <Td><Badge color={s?.color || 'default'}>{s?.label || run.status}</Badge></Td>
                    <Td onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="xs" onClick={() => setViewRun(run)}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        {run.status === 'draft' && (
                          <PermissionGate action="delete" moduleId="hr">
                            <Button variant="danger" size="xs" onClick={() => handleDelete(run)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </PermissionGate>
                        )}
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
          total={total} pageSize={PAGE_SIZE} label="payroll runs"
          className="border-t border-surface-200 dark:border-surface-800"
        />
      </Card>

      <PayrollRunModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSaved={() => { setShowModal(false); refetch() }}
      />

      <RunDetailModal
        open={Boolean(viewRun)}
        onClose={() => { setViewRun(null); refetch() }}
        run={viewRun}
        tenantId={tenantId}
      />
    </div>
  )
}
