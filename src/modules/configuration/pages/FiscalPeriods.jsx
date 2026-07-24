import { useState, useEffect, useCallback } from 'react'
import { Plus, Lock, Unlock, CalendarDays } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td,
  PageHeader, Card, Spinner, EmptyState, StatCard,
} from '@shared/components/ui'
import { useTenant } from '@core/tenant/TenantContext'
import PermissionGate from '@shared/components/PermissionGate'
import toast from '@shared/lib/toast'
import { fetchFiscalPeriods, createFiscalPeriod, setFiscalPeriodStatus, deleteFiscalPeriod } from '../api/fiscalPeriods'
import NewPeriodModal from '../components/NewPeriodModal'

const STATUS_CONFIG = {
  open:   { label: 'Open',   color: 'green'  },
  closed: { label: 'Closed', color: 'yellow' },
  locked: { label: 'Locked', color: 'red'    },
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function FiscalPeriods() {
  const { tenantId } = useTenant()
  const [periods, setPeriods] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)

  const fetchPeriods = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setPeriods(await fetchFiscalPeriods(tenantId))
    setLoading(false)
  }, [tenantId])

  useEffect(() => { fetchPeriods() }, [fetchPeriods])

  const handleCreate = async (data) => {
    try {
      await createFiscalPeriod(tenantId, data)
      fetchPeriods()
      return null
    } catch (err) {
      return err.message
    }
  }

  const handleSetStatus = async (period, status) => {
    try {
      await setFiscalPeriodStatus(period, status)
      toast.success(`"${period.name}" marked as ${status}.`)
      fetchPeriods()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleDelete = async (period) => {
    if (period.status === 'locked') return
    if (!window.confirm(`Delete "${period.name}"? This cannot be undone.`)) return
    try {
      await deleteFiscalPeriod(period)
      toast.success(`"${period.name}" deleted.`)
      fetchPeriods()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const counts = {
    open:   periods.filter(p => p.status === 'open').length,
    closed: periods.filter(p => p.status === 'closed').length,
    locked: periods.filter(p => p.status === 'locked').length,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fiscal Periods"
        subtitle={`${periods.length} period${periods.length !== 1 ? 's' : ''}`}
        breadcrumb="Configuration / Fiscal Periods"
        actions={
          <PermissionGate action="create" moduleId="configuration">
            <Button size="sm" onClick={() => setShowNew(true)}>
              <Plus className="w-4 h-4" />New Period
            </Button>
          </PermissionGate>
        }
      />

      {periods.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Open"   value={counts.open}   icon={CalendarDays} color="#10b981" />
          <StatCard label="Closed" value={counts.closed} icon={CalendarDays} color="#f59e0b" />
          <StatCard label="Locked" value={counts.locked} icon={Lock}         color="#ef4444" />
        </div>
      )}

      <Card>
        {loading ? (
          <div className="flex justify-center py-14"><Spinner className="w-6 h-6" /></div>
        ) : periods.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No fiscal periods"
            description="Create your first fiscal period to track accounting periods and lock historical data."
            action={
              <PermissionGate action="create" moduleId="configuration">
                <Button size="sm" onClick={() => setShowNew(true)}>
                  <Plus className="w-4 h-4" />Create Period
                </Button>
              </PermissionGate>
            }
          />
        ) : (
          <Table>
            <Thead>
              <Th>Period Name</Th>
              <Th>Start Date</Th>
              <Th>End Date</Th>
              <Th>Status</Th>
              <Th>Created</Th>
              <Th></Th>
            </Thead>
            <Tbody>
              {periods.map(p => {
                const s = STATUS_CONFIG[p.status]
                return (
                  <Tr key={p.id}>
                    <Td>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{p.name}</span>
                    </Td>
                    <Td>
                      <span className="font-mono text-xs text-slate-500">{p.start_date}</span>
                    </Td>
                    <Td>
                      <span className="font-mono text-xs text-slate-500">{p.end_date}</span>
                    </Td>
                    <Td>
                      <Badge color={s.color}>{s.label}</Badge>
                    </Td>
                    <Td>
                      <span className="text-slate-500 text-xs">
                        {new Date(p.created_at).toLocaleDateString()}
                      </span>
                    </Td>
                    <Td>
                      <PermissionGate action="edit" moduleId="configuration">
                        <div className="flex items-center gap-1">
                          {p.status === 'open' && (
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => handleSetStatus(p, 'closed')}
                              title="Close this period"
                            >
                              Close
                            </Button>
                          )}
                          {p.status === 'closed' && (
                            <>
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => handleSetStatus(p, 'open')}
                                title="Re-open this period"
                              >
                                <Unlock className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => handleSetStatus(p, 'locked')}
                                title="Lock — prevents any further edits"
                              >
                                <Lock className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                          {p.status !== 'locked' && (
                            <Button
                              variant="danger"
                              size="xs"
                              onClick={() => handleDelete(p)}
                              title="Delete period"
                            >
                              Del
                            </Button>
                          )}
                          {p.status === 'locked' && (
                            <span className="text-xs text-slate-600 italic px-1">Locked</span>
                          )}
                        </div>
                      </PermissionGate>
                    </Td>
                  </Tr>
                )
              })}
            </Tbody>
          </Table>
        )}
      </Card>

      {showNew && (
        <NewPeriodModal
          onClose={() => setShowNew(false)}
          onSave={handleCreate}
        />
      )}
    </div>
  )
}
