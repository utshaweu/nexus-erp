import { useState, useEffect, useCallback } from 'react'
import { Plus, Check, X, ArrowLeftRight, UserX } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card, EmptyState,
} from '@shared/components/ui'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import useStore from '@core/store/useStore'
import {
  PAGE_SIZE_TABLE as PAGE_SIZE, MOVEMENT_STATUS, MOVEMENT_STATUS_TABS,
} from '@shared/lib/constants'
import { fetchActiveEmployeeOptions } from '../api/employees'
import { fetchLinkedEmployee, fetchMovements, approveMovement, rejectMovement, cancelMovement } from '../api/movements'
import { useResourceList } from '../hooks/useResourceList'
import ListToolbar from '../components/ListToolbar'
import { ListLoading } from '../components/ListStates'
import ApplyModal from '../components/ApplyModal'
import RejectModal from '../components/RejectModal'

const STATUS_TABS = MOVEMENT_STATUS_TABS.map(s => ({ value: s, label: s === 'all' ? 'All' : MOVEMENT_STATUS[s]?.label }))

export default function Movement() {
  const { tenantId, isManager } = useTenant()
  const session = useStore(s => s.session)
  const userId  = session?.user?.id

  const [myEmployee,   setMyEmployee]   = useState(null)
  const [myEmpLoading, setMyEmpLoading] = useState(true)
  const [employees,    setEmployees]    = useState([])
  const [showApply,    setShowApply]    = useState(false)
  const [rejectTarget, setRejectTarget] = useState(null)

  const fetchFn = useCallback(
    ({ page, filter }) => fetchMovements(tenantId, { page, filter, isManager, myEmployeeId: myEmployee?.id }),
    [tenantId, isManager, myEmployee]
  )
  const {
    items: movements, total, page, setPage, filter: statusFilter, setFilter: setStatusFilter,
    loading, refetch,
  } = useResourceList(fetchFn, [tenantId, isManager, myEmployee])
  const totalPages = Math.ceil(total / PAGE_SIZE)

  useEffect(() => {
    if (!tenantId || !userId) { setMyEmpLoading(false); return }
    fetchLinkedEmployee(tenantId, userId).then(data => { setMyEmployee(data); setMyEmpLoading(false) })
  }, [tenantId, userId])

  useEffect(() => { fetchActiveEmployeeOptions(tenantId).then(setEmployees) }, [tenantId])

  const handleApprove = async (mv) => {
    try {
      await approveMovement(mv, userId)
      toast.success('Movement approved.')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleReject = async (reason) => {
    if (!rejectTarget) return
    try {
      await rejectMovement(rejectTarget, reason)
      toast.success('Movement rejected.')
      setRejectTarget(null)
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleCancel = async (mv) => {
    if (!window.confirm('Cancel this movement request?')) return
    try {
      await cancelMovement(mv)
      toast.success('Movement cancelled.')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const showNotLinked = !isManager && !myEmpLoading && !myEmployee

  return (
    <div className="space-y-6">
      <PageHeader
        title="Movement"
        subtitle="Track out-of-office requests: field visits, WFH, tours, and more"
        breadcrumb="HR / Movement"
        actions={
          (!isManager ? myEmployee != null : true) && (
            <Button size="sm" onClick={() => setShowApply(true)}>
              <Plus className="w-4 h-4" />Apply Movement
            </Button>
          )
        }
      />

      {showNotLinked && (
        <Card className="p-8 text-center">
          <UserX className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Account not linked</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            Your user account is not linked to an employee profile yet. Please contact your HR admin.
          </p>
        </Card>
      )}

      {!showNotLinked && (
        <Card>
          <ListToolbar tabs={STATUS_TABS} activeTab={statusFilter} onTabChange={setStatusFilter} />

          {loading ? (
            <ListLoading icon={ArrowLeftRight} label="Loading movement requests…" />
          ) : movements.length === 0 ? (
            <EmptyState
              icon={ArrowLeftRight}
              title="No movement requests"
              description="Submit a movement request using the Apply button."
            />
          ) : (
            <>
              <Table>
                <Thead>
                  {isManager && <Th>Employee</Th>}
                  <Th>Type</Th>
                  <Th>From</Th>
                  <Th>To</Th>
                  <Th>Time</Th>
                  <Th>Location</Th>
                  <Th>Reason</Th>
                  <Th>Status</Th>
                  <Th></Th>
                </Thead>
                <Tbody>
                  {movements.map(mv => {
                    const emp = mv.hr_employees
                    const s   = MOVEMENT_STATUS[mv.status]
                    return (
                      <Tr key={mv.id}>
                        {isManager && (
                          <Td>
                            <div>
                              <span className="font-medium text-slate-900 dark:text-slate-100">
                                {emp ? `${emp.first_name} ${emp.last_name}` : '—'}
                              </span>
                              {emp?.employee_number && (
                                <p className="text-xs font-mono text-pink-500">{emp.employee_number}</p>
                              )}
                            </div>
                          </Td>
                        )}
                        <Td>
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {mv.movement_type}
                          </span>
                        </Td>
                        <Td><span className="text-sm text-slate-600 dark:text-slate-400">{mv.from_date}</span></Td>
                        <Td><span className="text-sm text-slate-600 dark:text-slate-400">{mv.to_date}</span></Td>
                        <Td>
                          <span className="text-xs font-mono text-slate-500">
                            {mv.start_time || '—'}
                            {mv.start_time && mv.end_time ? ' – ' : ''}
                            {mv.end_time || ''}
                          </span>
                        </Td>
                        <Td>
                          <span className="text-xs text-slate-500 truncate max-w-[100px] block">
                            {mv.location || '—'}
                          </span>
                        </Td>
                        <Td>
                          <span className="text-xs text-slate-500 truncate max-w-[120px] block">
                            {mv.reason}
                          </span>
                        </Td>
                        <Td><Badge color={s?.color || 'default'}>{s?.label || mv.status}</Badge></Td>
                        <Td onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            {mv.status === 'pending' && isManager && (
                              <>
                                <Button variant="success" size="xs" onClick={() => handleApprove(mv)} title="Approve">
                                  <Check className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="danger" size="xs" onClick={() => setRejectTarget(mv)} title="Reject">
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}
                            {(mv.status === 'pending' || mv.status === 'approved') && (
                              <Button variant="outline" size="xs" onClick={() => handleCancel(mv)}>
                                Cancel
                              </Button>
                            )}
                          </div>
                        </Td>
                      </Tr>
                    )
                  })}
                </Tbody>
              </Table>
              <Pagination
                page={page} totalPages={totalPages} onPageChange={setPage}
                total={total} pageSize={PAGE_SIZE} label="requests"
                className="border-t border-surface-200 dark:border-surface-800"
              />
            </>
          )}
        </Card>
      )}

      <ApplyModal
        open={showApply}
        onClose={() => setShowApply(false)}
        onSaved={() => { setShowApply(false); refetch() }}
        employees={employees}
        myEmployee={myEmployee}
        isManager={isManager}
      />

      <RejectModal
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        onConfirm={handleReject}
        title="Reject Movement"
      />
    </div>
  )
}
