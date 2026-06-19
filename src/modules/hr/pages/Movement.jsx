import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Check, X, ArrowLeftRight, UserX } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card,
  Modal, Input, Select, EmptyState,
} from '@shared/components/ui'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import useStore from '@core/store/useStore'
import {
  PAGE_SIZE_TABLE as PAGE_SIZE,
  MOVEMENT_TYPES,
  MOVEMENT_STATUS,
  MOVEMENT_STATUS_TABS,
} from '@shared/lib/constants'

// ── Apply Modal ───────────────────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10)

const moveSchema = z.object({
  employee_id:   z.string().min(1, 'Employee is required'),
  movement_type: z.string().min(1, 'Movement type is required'),
  from_date:     z.string().min(1, 'From date is required'),
  to_date:       z.string().min(1, 'To date is required'),
  start_time:    z.string().optional(),
  end_time:      z.string().optional(),
  location:      z.string().optional(),
  reason:        z.string().trim().min(1, 'Reason is required'),
}).refine(d => d.to_date >= d.from_date, {
  message: 'To date must be on or after from date', path: ['to_date'],
})

function ApplyModal({ open, onClose, onSaved, employees, myEmployee, isManager }) {
  const { tenantId } = useTenant()
  const session      = useStore(s => s.session)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm({
      resolver: zodResolver(moveSchema),
      defaultValues: {
        employee_id: '', movement_type: '', from_date: today, to_date: today,
        start_time: '', end_time: '', location: '', reason: '',
      },
    })

  useEffect(() => {
    if (!open) return
    reset({
      employee_id: myEmployee?.id || '', movement_type: '', from_date: today, to_date: today,
      start_time: '', end_time: '', location: '', reason: '',
    })
  }, [open, myEmployee, reset])

  const onSubmit = async (data) => {
    const { error } = await supabase.from('hr_movements').insert({
      tenant_id:     tenantId,
      employee_id:   data.employee_id,
      movement_type: data.movement_type,
      from_date:     data.from_date,
      to_date:       data.to_date,
      start_time:    data.start_time || null,
      end_time:      data.end_time   || null,
      location:      data.location   || null,
      reason:        data.reason,
      status:        'pending',
      created_by:    session?.user?.id || null,
    })
    if (error) { toast.error(error.message); return }
    toast.success('Movement request submitted.')
    onSaved(); onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Apply Movement" size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {isManager ? (
          <Select label="Employee" error={errors.employee_id?.message} {...register('employee_id')}>
            <option value="">— Select employee —</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_number})</option>
            ))}
          </Select>
        ) : (
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-surface-800 text-sm">
            <span className="text-slate-500">Employee: </span>
            <span className="font-semibold">{myEmployee?.first_name} {myEmployee?.last_name}</span>
            <span className="font-mono text-xs text-pink-500 ml-2">{myEmployee?.employee_number}</span>
          </div>
        )}

        <Select label="Movement Type *" error={errors.movement_type?.message} {...register('movement_type')}>
          <option value="">Select Movement Type</option>
          {MOVEMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </Select>

        <div className="grid grid-cols-2 gap-3">
          <Input label="From Date" type="date" error={errors.from_date?.message} {...register('from_date')} />
          <Input label="To Date"   type="date" error={errors.to_date?.message}   {...register('to_date')}   />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Start Time" type="time" {...register('start_time')} />
          <Input label="End Time"   type="time" {...register('end_time')}   />
        </div>
        <Input label="Location" placeholder="Write Your Location" {...register('location')} />
        <div>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1.5">
            Reason *
          </label>
          <textarea
            {...register('reason')}
            placeholder="Reason for movement"
            rows={3}
            className="w-full px-3 py-2 rounded-lg text-sm
                       text-slate-900 dark:text-slate-200
                       placeholder:text-slate-400 dark:placeholder:text-slate-600
                       bg-white dark:bg-surface-900
                       border border-surface-200 dark:border-surface-700
                       focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500
                       resize-none"
          />
          {errors.reason && <p className="text-xs text-red-500 mt-1">{errors.reason.message}</p>}
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isSubmitting}>Apply</Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Reject Modal ──────────────────────────────────────────────────────────────

function RejectModal({ open, onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  const [busy,   setBusy]   = useState(false)
  useEffect(() => { if (open) setReason('') }, [open])
  const handleConfirm = async () => { setBusy(true); await onConfirm(reason); setBusy(false) }
  return (
    <Modal open={open} onClose={onClose} title="Reject Movement" size="sm">
      <div className="space-y-4">
        <Input
          label="Rejection Reason (optional)"
          placeholder="Provide reason"
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="danger"    className="flex-1" loading={busy} onClick={handleConfirm}>Reject</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Movement() {
  const { tenantId, isManager } = useTenant()
  const session = useStore(s => s.session)
  const userId  = session?.user?.id

  const [myEmployee,   setMyEmployee]   = useState(null)
  const [myEmpLoading, setMyEmpLoading] = useState(true)
  const [movements,    setMovements]    = useState([])
  const [employees,    setEmployees]    = useState([])
  const [total,        setTotal]        = useState(0)
  const [page,         setPage]         = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading,      setLoading]      = useState(true)
  const [showApply,    setShowApply]    = useState(false)
  const [rejectTarget, setRejectTarget] = useState(null)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Find linked employee for normal users
  useEffect(() => {
    if (!tenantId || !userId) { setMyEmpLoading(false); return }
    supabase.from('hr_employees')
      .select('id, first_name, last_name, employee_number')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => { setMyEmployee(data); setMyEmpLoading(false) })
  }, [tenantId, userId])

  const fetchEmployees = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase
      .from('hr_employees')
      .select('id, first_name, last_name, employee_number')
      .eq('tenant_id', tenantId)
      .in('status', ['active', 'on_leave'])
      .order('first_name')
    setEmployees(data || [])
  }, [tenantId])

  const fetchMovements = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      let q = supabase
        .from('hr_movements')
        .select('*, hr_employees(first_name, last_name, employee_number)', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (!isManager && myEmployee) q = q.eq('employee_id', myEmployee.id)
      if (statusFilter !== 'all')   q = q.eq('status', statusFilter)

      const { data, count, error } = await q
      if (error) throw error
      setMovements(data || [])
      setTotal(count || 0)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId, isManager, myEmployee, statusFilter, page])

  useEffect(() => { fetchEmployees() }, [fetchEmployees])
  useEffect(() => { fetchMovements() }, [fetchMovements])
  useEffect(() => { setPage(1) },       [statusFilter])

  const handleApprove = async (mv) => {
    const now = new Date().toISOString()
    const { error } = await supabase.from('hr_movements')
      .update({ status: 'approved', approved_by: userId, approved_at: now, updated_at: now })
      .eq('id', mv.id)
    if (error) { toast.error(error.message); return }
    toast.success('Movement approved.')
    fetchMovements()
  }

  const handleReject = async (reason) => {
    if (!rejectTarget) return
    const { error } = await supabase.from('hr_movements')
      .update({ status: 'rejected', rejection_reason: reason || null, updated_at: new Date().toISOString() })
      .eq('id', rejectTarget.id)
    if (error) { toast.error(error.message); return }
    toast.success('Movement rejected.')
    setRejectTarget(null)
    fetchMovements()
  }

  const handleCancel = async (mv) => {
    if (!window.confirm('Cancel this movement request?')) return
    const { error } = await supabase.from('hr_movements')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', mv.id)
    if (error) { toast.error(error.message); return }
    toast.success('Movement cancelled.')
    fetchMovements()
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

      {/* Not linked warning for normal users */}
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
          {/* Status tabs */}
          <div className="flex items-center gap-3 p-4 border-b border-surface-200 dark:border-surface-800 flex-wrap">
            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-surface-800 flex-wrap">
              {MOVEMENT_STATUS_TABS.map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    statusFilter === s
                      ? 'bg-white dark:bg-surface-700 text-slate-800 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {s === 'all' ? 'All' : MOVEMENT_STATUS[s]?.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <ArrowLeftRight className="w-8 h-8 text-pink-400 animate-pulse" />
              <p className="text-sm text-slate-400">Loading movement requests…</p>
            </div>
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
        onSaved={() => { setShowApply(false); fetchMovements() }}
        employees={employees}
        myEmployee={myEmployee}
        isManager={isManager}
      />

      <RejectModal
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        onConfirm={handleReject}
      />
    </div>
  )
}
