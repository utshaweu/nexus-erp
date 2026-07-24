import { useState, useEffect, useCallback } from 'react'
import { Plus, Calendar, Check, X } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card, EmptyState,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import useStore from '@core/store/useStore'
import {
  PAGE_SIZE_TABLE as PAGE_SIZE, LEAVE_REQUEST_STATUS, LEAVE_REQUEST_STATUS_TABS,
} from '@shared/lib/constants'
import {
  fetchLinkedEmployeeId, fetchLeaveRequests, fetchEmployeeOptionsForLeave, fetchLeaveTypes,
  approveLeaveRequest, rejectLeaveRequest, cancelLeaveRequest,
} from '../api/leave'
import { useResourceList } from '@shared/hooks/useResourceList'
import ListToolbar from '../components/ListToolbar'
import { ListLoading } from '../components/ListStates'
import LeaveRequestModal from '../components/LeaveRequestModal'
import RejectModal from '../components/RejectModal'
import LeaveTypesSection from '../components/LeaveTypesSection'

const STATUS_TABS = LEAVE_REQUEST_STATUS_TABS.map(s => ({ value: s, label: s === 'all' ? 'All' : LEAVE_REQUEST_STATUS[s]?.label }))

export default function Leave() {
  const { tenantId, isManager } = useTenant()
  const session        = useStore(s => s.session)
  const userId         = session?.user?.id
  const [myEmployee,  setMyEmployee]  = useState(null)
  const [employees,   setEmployees]   = useState([])
  const [leaveTypes,  setLeaveTypes]  = useState([])
  const [showReqModal, setShowReqModal] = useState(false)
  const [rejectTarget, setRejectTarget] = useState(null)

  const fetchFn = useCallback(
    ({ page, search, filter }) => fetchLeaveRequests(tenantId, { page, search, filter, isManager, myEmployeeId: myEmployee?.id }),
    [tenantId, isManager, myEmployee]
  )
  const {
    items: requests, total, page, setPage, search, setSearch, filter: statusFilter, setFilter: setStatusFilter,
    loading, refetch,
  } = useResourceList(fetchFn, [tenantId, isManager, myEmployee])
  const totalPages = Math.ceil(total / PAGE_SIZE)

  useEffect(() => {
    if (!tenantId || !userId || isManager) return
    fetchLinkedEmployeeId(tenantId, userId).then(setMyEmployee)
  }, [tenantId, userId, isManager])

  useEffect(() => { fetchEmployeeOptionsForLeave(tenantId).then(setEmployees) }, [tenantId])

  const refreshLeaveTypes = useCallback(() => {
    fetchLeaveTypes(tenantId).then(setLeaveTypes)
  }, [tenantId])
  useEffect(() => { refreshLeaveTypes() }, [refreshLeaveTypes])

  const handleApprove = async (req) => {
    try {
      await approveLeaveRequest(tenantId, req, userId)
      toast.success('Leave request approved.')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleReject = async (reason) => {
    if (!rejectTarget) return
    try {
      await rejectLeaveRequest(rejectTarget, reason)
      toast.success('Leave request rejected.')
      setRejectTarget(null)
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleCancel = async (req) => {
    if (!window.confirm('Cancel this leave request?')) return
    try {
      await cancelLeaveRequest(req)
      toast.success('Leave request cancelled.')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Management"
        subtitle="Manage employee leave requests and types"
        breadcrumb="HR / Leave"
        actions={
          <PermissionGate action="create" moduleId="hr">
            <Button size="sm" onClick={() => setShowReqModal(true)}>
              <Plus className="w-4 h-4" />New Request
            </Button>
          </PermissionGate>
        }
      />

      {/* Leave Requests */}
      <Card>
        <ListToolbar
          search={search} onSearchChange={setSearch} placeholder="Search by reason…"
          tabs={STATUS_TABS} activeTab={statusFilter} onTabChange={setStatusFilter}
        />

        {loading ? (
          <ListLoading icon={Calendar} label="Loading leave requests…" />
        ) : requests.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title={search || statusFilter !== 'all' ? 'No requests match' : 'No leave requests yet'}
            description={
              search || statusFilter !== 'all'
                ? 'Try adjusting your search or filter.'
                : 'Submit the first leave request.'
            }
            action={!search && statusFilter === 'all' && (
              <PermissionGate action="create" moduleId="hr">
                <Button size="sm" onClick={() => setShowReqModal(true)}>
                  <Plus className="w-4 h-4" />New Request
                </Button>
              </PermissionGate>
            )}
          />
        ) : (
          <Table>
            <Thead>
              <Th>Employee</Th>
              <Th>Leave Type</Th>
              <Th>From</Th>
              <Th>To</Th>
              <Th>Days</Th>
              <Th>Reason</Th>
              <Th>Status</Th>
              <Th></Th>
            </Thead>
            <Tbody>
              {requests.map(req => {
                const emp = req.hr_employees
                const s   = LEAVE_REQUEST_STATUS[req.status]
                return (
                  <Tr key={req.id}>
                    <Td>
                      <div>
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {emp ? `${emp.first_name} ${emp.last_name}` : '—'}
                        </span>
                        {emp?.employee_number && (
                          <p className="text-xs text-slate-500 font-mono">{emp.employee_number}</p>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <span className="text-slate-600 dark:text-slate-400 text-sm">
                        {req.hr_leave_types?.name || '—'}
                      </span>
                    </Td>
                    <Td><span className="text-sm text-slate-600 dark:text-slate-400">{req.start_date}</span></Td>
                    <Td><span className="text-sm text-slate-600 dark:text-slate-400">{req.end_date}</span></Td>
                    <Td><span className="font-medium">{req.days_count}</span></Td>
                    <Td>
                      <span className="text-slate-500 text-xs truncate max-w-[140px] block">
                        {req.reason || '—'}
                      </span>
                    </Td>
                    <Td><Badge color={s?.color || 'default'}>{s?.label || req.status}</Badge></Td>
                    <Td onClick={e => e.stopPropagation()}>
                      {req.status === 'pending' && (
                        <div className="flex items-center gap-1">
                          <PermissionGate action="approve" moduleId="hr">
                            <Button
                              variant="success"
                              size="xs"
                              onClick={() => handleApprove(req)}
                              title="Approve"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                          </PermissionGate>
                          <PermissionGate action="approve" moduleId="hr">
                            <Button
                              variant="danger"
                              size="xs"
                              onClick={() => setRejectTarget(req)}
                              title="Reject"
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </PermissionGate>
                          <PermissionGate action="edit" moduleId="hr">
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => handleCancel(req)}
                            >
                              Cancel
                            </Button>
                          </PermissionGate>
                        </div>
                      )}
                      {req.status === 'approved' && (
                        <PermissionGate action="edit" moduleId="hr">
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => handleCancel(req)}
                          >
                            Cancel
                          </Button>
                        </PermissionGate>
                      )}
                    </Td>
                  </Tr>
                )
              })}
            </Tbody>
          </Table>
        )}

        <Pagination
          page={page} totalPages={totalPages} onPageChange={setPage}
          total={total} pageSize={PAGE_SIZE} label="requests"
          className="border-t border-surface-200 dark:border-surface-800"
        />
      </Card>

      {/* Leave Types section */}
      <LeaveTypesSection leaveTypes={leaveTypes} onRefresh={refreshLeaveTypes} />

      <LeaveRequestModal
        open={showReqModal}
        onClose={() => setShowReqModal(false)}
        onSaved={refetch}
        employees={employees}
        leaveTypes={leaveTypes}
      />

      <RejectModal
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        onConfirm={handleReject}
        title="Reject Leave Request"
      />
    </div>
  )
}
