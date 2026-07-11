import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Calendar, Check, X, Tag, Pencil, Trash2 } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card,
  Modal, Input, Select, EmptyState,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import useStore from '@core/store/useStore'
import {
  PAGE_SIZE_TABLE as PAGE_SIZE,
  LEAVE_REQUEST_STATUS,
  LEAVE_REQUEST_STATUS_TABS,
  EMPLOYMENT_TYPES,
} from '@shared/lib/constants'
import { submitForApproval } from '@shared/lib/approvalWorkflow'
import { deductLeaveBalance, refundLeaveBalance } from '@shared/lib/leaveBalances'

// ── Leave Type Modal ──────────────────────────────────────────────────────────

const leaveTypeSchema = z.object({
  name:            z.string().trim().min(1, 'Name is required'),
  days_allowed:    z.coerce.number().int().min(0, 'Must be 0 or more'),
  employment_type: z.string().min(1, 'Employment type is required'),
  is_paid:         z.boolean(),
})

function LeaveTypeModal({ open, onClose, onSaved, leaveType }) {
  const { tenantId } = useTenant()
  const isEdit = Boolean(leaveType)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm({
      resolver: zodResolver(leaveTypeSchema),
      defaultValues: { name: '', days_allowed: 0, employment_type: '', is_paid: true },
    })

  useEffect(() => {
    if (!open) return
    reset(leaveType
      ? {
          name: leaveType.name,
          days_allowed: leaveType.days_allowed,
          employment_type: leaveType.employment_type || '',
          is_paid: leaveType.is_paid,
        }
      : { name: '', days_allowed: 0, employment_type: '', is_paid: true }
    )
  }, [open, leaveType, reset])

  const onSubmit = async (data) => {
    if (isEdit) {
      const { error } = await supabase.from('hr_leave_types').update(data).eq('id', leaveType.id)
      if (error) { toast.error(error.message); return }
      toast.success('Leave type updated.')
    } else {
      const { error } = await supabase.from('hr_leave_types').insert({ ...data, tenant_id: tenantId })
      if (error) { toast.error(error.message); return }
      toast.success('Leave type created.')
    }
    onSaved(); onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Leave Type' : 'New Leave Type'} size="sm">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Input
          label="Name"
          placeholder="e.g. Annual Leave"
          error={errors.name?.message}
          {...register('name')}
        />
        <Input
          label="Days Allowed per Year"
          type="number" min="0"
          error={errors.days_allowed?.message}
          {...register('days_allowed')}
        />
        <Select label="Employment Type" error={errors.employment_type?.message} {...register('employment_type')}>
          <option value="">— Select employment type —</option>
          {Object.entries(EMPLOYMENT_TYPES).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" {...register('is_paid')} className="w-4 h-4 rounded accent-pink-500" />
          <span className="text-sm text-slate-700 dark:text-slate-300">Paid leave</span>
        </label>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isSubmitting}>
            {isEdit ? 'Save Changes' : 'Create Type'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Leave Request Modal ───────────────────────────────────────────────────────

const leaveReqSchema = z.object({
  employee_id:   z.string().min(1, 'Employee is required'),
  leave_type_id: z.string().min(1, 'Leave type is required'),
  start_date:    z.string().min(1, 'Start date is required'),
  end_date:      z.string().min(1, 'End date is required'),
  reason:        z.string().optional(),
}).refine(d => d.end_date >= d.start_date, {
  message: 'End date must be on or after start date',
  path: ['end_date'],
})

function countWeekdays(start, end) {
  let count = 0
  const d = new Date(start)
  const e = new Date(end)
  while (d <= e) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

function LeaveRequestModal({ open, onClose, onSaved, employees, leaveTypes }) {
  const { tenantId } = useTenant()
  const session      = useStore(s => s.session)

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } =
    useForm({
      resolver: zodResolver(leaveReqSchema),
      defaultValues: {
        employee_id: '', leave_type_id: '',
        start_date: new Date().toISOString().slice(0, 10),
        end_date:   new Date().toISOString().slice(0, 10),
        reason: '',
      },
    })

  const startDate = watch('start_date')
  const endDate   = watch('end_date')
  const days = (startDate && endDate && endDate >= startDate)
    ? countWeekdays(startDate, endDate)
    : 0

  const employeeId = watch('employee_id')
  const selectedEmployee = employees.find(e => e.id === employeeId)
  const availableLeaveTypes = selectedEmployee
    ? leaveTypes.filter(t => t.is_active && t.employment_type === selectedEmployee.employment_type)
    : []

  // Leave type options depend on the selected employee's employment type —
  // clear any prior selection when the employee changes so a stale/invalid pick can't be submitted.
  useEffect(() => {
    setValue('leave_type_id', '')
  }, [employeeId, setValue])

  useEffect(() => {
    if (!open) return
    reset({
      employee_id: '', leave_type_id: '',
      start_date: new Date().toISOString().slice(0, 10),
      end_date:   new Date().toISOString().slice(0, 10),
      reason: '',
    })
  }, [open, reset])

  const onSubmit = async (data) => {
    const { data: inserted, error } = await supabase
      .from('hr_leave_requests')
      .insert({
        tenant_id:     tenantId,
        employee_id:   data.employee_id,
        leave_type_id: data.leave_type_id,
        start_date:    data.start_date,
        end_date:      data.end_date,
        days_count:    days,
        reason:        data.reason || null,
        status:        'pending',
        created_by:    session?.user?.id || null,
      })
      .select('id')
      .single()
    if (error) { toast.error(error.message); return }

    let message = 'Leave request submitted.'
    try {
      const emp  = employees.find(e => e.id === data.employee_id)
      const type = leaveTypes.find(t => t.id === data.leave_type_id)
      const result = await submitForApproval({
        tenantId, module: 'hr', recordId: inserted.id, recordType: 'leave_request',
        title: `Leave Request${emp ? ` — ${emp.first_name} ${emp.last_name}` : ''}`,
        description: `${type?.name || 'Leave'} · ${data.start_date} → ${data.end_date} (${days} day${days !== 1 ? 's' : ''})${data.reason ? ` · ${data.reason}` : ''}`,
        requestedBy: session?.user?.id || null,
      })
      if (result.submitted) message = `Leave request submitted for approval (${result.request.request_number}).`
    } catch (err) {
      toast.error(err.message)
    }

    toast.success(message)
    onSaved(); onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="New Leave Request" size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Select label="Employee" error={errors.employee_id?.message} {...register('employee_id')}>
          <option value="">— Select employee —</option>
          {employees.map(e => (
            <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_number})</option>
          ))}
        </Select>
        <Select
          label="Leave Type"
          error={errors.leave_type_id?.message}
          disabled={!selectedEmployee}
          {...register('leave_type_id')}
        >
          <option value="">
            {selectedEmployee ? '— Select type —' : '— Select employee first —'}
          </option>
          {availableLeaveTypes.map(t => (
            <option key={t.id} value={t.id}>{t.name} ({t.days_allowed} days/yr, {t.is_paid ? 'Paid' : 'Unpaid'})</option>
          ))}
        </Select>
        {selectedEmployee && availableLeaveTypes.length === 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 -mt-2">
            No active leave types configured for {EMPLOYMENT_TYPES[selectedEmployee.employment_type] || selectedEmployee.employment_type} employees.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Start Date"
            type="date"
            error={errors.start_date?.message}
            {...register('start_date')}
          />
          <Input
            label="End Date"
            type="date"
            error={errors.end_date?.message}
            {...register('end_date')}
          />
        </div>
        {days > 0 && (
          <p className="text-sm text-pink-600 dark:text-pink-400 font-medium">
            {days} working day{days !== 1 ? 's' : ''}
          </p>
        )}
        <Input label="Reason (optional)" placeholder="Reason for leave" {...register('reason')} />
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isSubmitting}>Submit Request</Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Rejection Modal ───────────────────────────────────────────────────────────

function RejectModal({ open, onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  const [busy,   setBusy]   = useState(false)

  useEffect(() => { if (open) setReason('') }, [open])

  const handleConfirm = async () => {
    setBusy(true)
    await onConfirm(reason)
    setBusy(false)
  }

  return (
    <Modal open={open} onClose={onClose} title="Reject Leave Request" size="sm">
      <div className="space-y-4">
        <Input
          label="Rejection Reason (optional)"
          placeholder="Provide a reason for rejection"
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="danger" className="flex-1" loading={busy} onClick={handleConfirm}>
            Reject
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Leave Types Sub-section ───────────────────────────────────────────────────

function LeaveTypesSection({ leaveTypes, onRefresh }) {
  const [showModal, setShowModal]   = useState(false)
  const [editType,  setEditType]    = useState(null)

  const handleDelete = async (t) => {
    if (!window.confirm(`Delete leave type "${t.name}"?`)) return
    const { error } = await supabase.from('hr_leave_types').delete().eq('id', t.id)
    if (error) { toast.error(error.message); return }
    toast.success('Leave type deleted.')
    onRefresh()
  }

  return (
    <Card>
      <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-800">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <Tag className="w-4 h-4 text-pink-400" />Leave Types
        </h3>
        <PermissionGate action="create" moduleId="hr">
          <Button size="sm" onClick={() => { setEditType(null); setShowModal(true) }}>
            <Plus className="w-4 h-4" />New Type
          </Button>
        </PermissionGate>
      </div>
      {leaveTypes.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">No leave types yet.</div>
      ) : (
        <Table>
          <Thead><Th>Name</Th><Th>Days/Year</Th><Th>Employment Type</Th><Th>Paid</Th><Th>Status</Th><Th></Th></Thead>
          <Tbody>
            {leaveTypes.map(t => (
              <Tr key={t.id}>
                <Td><span className="font-medium text-slate-900 dark:text-slate-100">{t.name}</span></Td>
                <Td><span className="text-slate-600 dark:text-slate-400">{t.days_allowed}</span></Td>
                <Td><span className="text-slate-600 dark:text-slate-400">{EMPLOYMENT_TYPES[t.employment_type] || t.employment_type || '—'}</span></Td>
                <Td>
                  <Badge color={t.is_paid ? 'green' : 'default'}>{t.is_paid ? 'Paid' : 'Unpaid'}</Badge>
                </Td>
                <Td>
                  <Badge color={t.is_active ? 'green' : 'default'}>{t.is_active ? 'Active' : 'Inactive'}</Badge>
                </Td>
                <Td onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <PermissionGate action="edit" moduleId="hr">
                      <Button variant="ghost" size="xs" onClick={() => { setEditType(t); setShowModal(true) }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </PermissionGate>
                    <PermissionGate action="delete" moduleId="hr">
                      <Button variant="danger" size="xs" onClick={() => handleDelete(t)}>
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
      <LeaveTypeModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditType(null) }}
        onSaved={() => { setShowModal(false); setEditType(null); onRefresh() }}
        leaveType={editType}
      />
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Leave() {
  const { tenantId, isManager } = useTenant()
  const session        = useStore(s => s.session)
  const userId         = session?.user?.id
  const [myEmployee,   setMyEmployee]  = useState(null)
  const [requests,     setRequests]   = useState([])
  const [employees,    setEmployees]  = useState([])
  const [leaveTypes,   setLeaveTypes] = useState([])
  const [total,        setTotal]      = useState(0)
  const [page,         setPage]       = useState(1)
  const [search,       setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading,      setLoading]    = useState(true)
  const [showReqModal, setShowReqModal] = useState(false)
  const [rejectTarget, setRejectTarget] = useState(null)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Fetch linked employee for normal user self-service filter
  useEffect(() => {
    if (!tenantId || !userId || isManager) return
    supabase.from('hr_employees')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => setMyEmployee(data))
  }, [tenantId, userId, isManager])

  const fetchRequests = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      let query = supabase
        .from('hr_leave_requests')
        .select(
          '*, hr_employees(first_name, last_name, employee_number), hr_leave_types(name)',
          { count: 'exact' }
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      // Normal user sees only their own requests
      if (!isManager && myEmployee) query = query.eq('employee_id', myEmployee.id)

      if (statusFilter !== 'all') query = query.eq('status', statusFilter)
      if (search.trim()) {
        query = query.or(`reason.ilike.%${search.trim()}%`)
      }

      const { data, count, error } = await query
      if (error) throw error
      setRequests(data || [])
      setTotal(count || 0)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId, isManager, myEmployee, page, search, statusFilter])

  const fetchEmployees = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase
      .from('hr_employees')
      .select('id, first_name, last_name, employee_number, employment_type')
      .eq('tenant_id', tenantId)
      .in('status', ['active', 'on_leave'])
      .order('first_name')
    setEmployees(data || [])
  }, [tenantId])

  const fetchLeaveTypes = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase
      .from('hr_leave_types')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name')
    setLeaveTypes(data || [])
  }, [tenantId])

  useEffect(() => { fetchRequests()  }, [fetchRequests])
  useEffect(() => { fetchEmployees() }, [fetchEmployees])
  useEffect(() => { fetchLeaveTypes()}, [fetchLeaveTypes])
  useEffect(() => { setPage(1) }, [search, statusFilter])

  const handleApprove = async (req) => {
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('hr_leave_requests')
      .update({ status: 'approved', approved_by: userId || null, approved_at: now, updated_at: now })
      .eq('id', req.id)
    if (error) { toast.error(error.message); return }

    await deductLeaveBalance(tenantId, req.employee_id, req.leave_type_id, req.days_count)

    if (req.start_date <= new Date().toISOString().slice(0, 10)) {
      await supabase.from('hr_employees')
        .update({ status: 'on_leave', updated_at: now })
        .eq('id', req.employee_id)
    }
    toast.success('Leave request approved.')
    fetchRequests()
  }

  const handleReject = async (reason) => {
    if (!rejectTarget) return
    const { error } = await supabase
      .from('hr_leave_requests')
      .update({ status: 'rejected', rejection_reason: reason || null, updated_at: new Date().toISOString() })
      .eq('id', rejectTarget.id)
    if (error) { toast.error(error.message); return }
    toast.success('Leave request rejected.')
    setRejectTarget(null)
    fetchRequests()
  }

  const handleCancel = async (req) => {
    if (!window.confirm('Cancel this leave request?')) return
    const wasApproved = req.status === 'approved'
    const { error } = await supabase
      .from('hr_leave_requests')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', req.id)
    if (error) { toast.error(error.message); return }
    if (wasApproved) {
      await refundLeaveBalance(req.employee_id, req.leave_type_id, req.days_count)
    }
    toast.success('Leave request cancelled.')
    fetchRequests()
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
        <div className="flex items-center gap-3 p-4 border-b border-surface-200 dark:border-surface-800 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-xs
                          px-3 py-2 rounded-lg bg-slate-50 dark:bg-surface-800
                          border border-surface-200 dark:border-surface-700">
            <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by reason…"
              className="bg-transparent text-sm text-slate-700 dark:text-slate-300
                         placeholder:text-slate-400 dark:placeholder:text-slate-600 flex-1 outline-none"
            />
          </div>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-surface-800">
            {LEAVE_REQUEST_STATUS_TABS.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  statusFilter === s
                    ? 'bg-white dark:bg-surface-700 text-slate-800 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {s === 'all' ? 'All' : LEAVE_REQUEST_STATUS[s]?.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Calendar className="w-8 h-8 text-pink-400 animate-pulse" />
            <p className="text-sm text-slate-400">Loading leave requests…</p>
          </div>
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
      <LeaveTypesSection leaveTypes={leaveTypes} onRefresh={fetchLeaveTypes} />

      <LeaveRequestModal
        open={showReqModal}
        onClose={() => setShowReqModal(false)}
        onSaved={fetchRequests}
        employees={employees}
        leaveTypes={leaveTypes}
      />

      <RejectModal
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        onConfirm={handleReject}
      />
    </div>
  )
}
