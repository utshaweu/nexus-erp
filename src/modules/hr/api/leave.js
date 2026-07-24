import { supabase } from '@shared/api/supabase'
import { PAGE_SIZE_TABLE as PAGE_SIZE } from '@shared/lib/constants'
import { submitForApproval } from '@shared/lib/approvalWorkflow'
import { deductLeaveBalance, refundLeaveBalance } from '@shared/lib/leaveBalances'

export async function fetchLinkedEmployeeId(tenantId, userId) {
  if (!tenantId || !userId) return null
  const { data } = await supabase
    .from('hr_employees')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

export async function fetchLeaveRequests(tenantId, { page, search, filter, isManager, myEmployeeId }) {
  if (!tenantId) return { items: [], total: 0 }

  let query = supabase
    .from('hr_leave_requests')
    .select('*, hr_employees(first_name, last_name, employee_number), hr_leave_types(name)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (!isManager && myEmployeeId) query = query.eq('employee_id', myEmployeeId)
  if (filter !== 'all') query = query.eq('status', filter)
  if (search.trim()) query = query.or(`reason.ilike.%${search.trim()}%`)

  const { data, count, error } = await query
  if (error) throw error
  return { items: data || [], total: count || 0 }
}

/** id/name/number/employment_type only — feeds the employee picker on the leave request form. */
export async function fetchEmployeeOptionsForLeave(tenantId) {
  if (!tenantId) return []
  const { data } = await supabase
    .from('hr_employees')
    .select('id, first_name, last_name, employee_number, employment_type')
    .eq('tenant_id', tenantId)
    .in('status', ['active', 'on_leave'])
    .order('first_name')
  return data || []
}

export async function fetchLeaveTypes(tenantId) {
  if (!tenantId) return []
  const { data } = await supabase.from('hr_leave_types').select('*').eq('tenant_id', tenantId).order('name')
  return data || []
}

export async function saveLeaveType(tenantId, leaveType, data) {
  if (leaveType) {
    const { error } = await supabase.from('hr_leave_types').update(data).eq('id', leaveType.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('hr_leave_types').insert({ ...data, tenant_id: tenantId })
    if (error) throw error
  }
}

export async function deleteLeaveType(leaveType) {
  const { error } = await supabase.from('hr_leave_types').delete().eq('id', leaveType.id)
  if (error) throw error
}

/** Inserts the request and, if hr has an active approval workflow, routes it through approval. */
export async function createLeaveRequest(tenantId, data, days, employees, leaveTypes, userId) {
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
      created_by:    userId || null,
    })
    .select('id')
    .single()
  if (error) throw error

  let message = 'Leave request submitted.'
  let approvalError = null
  try {
    const emp  = employees.find(e => e.id === data.employee_id)
    const type = leaveTypes.find(t => t.id === data.leave_type_id)
    const result = await submitForApproval({
      tenantId, module: 'hr', recordId: inserted.id, recordType: 'leave_request',
      title: `Leave Request${emp ? ` — ${emp.first_name} ${emp.last_name}` : ''}`,
      description: `${type?.name || 'Leave'} · ${data.start_date} → ${data.end_date} (${days} day${days !== 1 ? 's' : ''})${data.reason ? ` · ${data.reason}` : ''}`,
      requestedBy: userId || null,
    })
    if (result.submitted) message = `Leave request submitted for approval (${result.request.request_number}).`
  } catch (err) {
    approvalError = err.message
  }
  return { message, approvalError }
}

export async function approveLeaveRequest(tenantId, req, userId) {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('hr_leave_requests')
    .update({ status: 'approved', approved_by: userId || null, approved_at: now, updated_at: now })
    .eq('id', req.id)
  if (error) throw error

  await deductLeaveBalance(tenantId, req.employee_id, req.leave_type_id, req.days_count)

  if (req.start_date <= new Date().toISOString().slice(0, 10)) {
    await supabase.from('hr_employees').update({ status: 'on_leave', updated_at: now }).eq('id', req.employee_id)
  }
}

export async function rejectLeaveRequest(req, reason) {
  const { error } = await supabase
    .from('hr_leave_requests')
    .update({ status: 'rejected', rejection_reason: reason || null, updated_at: new Date().toISOString() })
    .eq('id', req.id)
  if (error) throw error
}

export async function cancelLeaveRequest(req) {
  const wasApproved = req.status === 'approved'
  const { error } = await supabase
    .from('hr_leave_requests')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', req.id)
  if (error) throw error
  if (wasApproved) await refundLeaveBalance(req.employee_id, req.leave_type_id, req.days_count)
}
