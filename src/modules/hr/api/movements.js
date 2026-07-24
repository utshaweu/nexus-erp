import { supabase } from '@shared/api/supabase'
import { PAGE_SIZE_TABLE as PAGE_SIZE } from '@shared/lib/constants'
import { submitForApproval } from '@shared/lib/approvalWorkflow'

export async function fetchLinkedEmployee(tenantId, userId) {
  if (!tenantId || !userId) return null
  const { data } = await supabase
    .from('hr_employees')
    .select('id, first_name, last_name, employee_number')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

export async function fetchMovements(tenantId, { page, filter, isManager, myEmployeeId }) {
  if (!tenantId) return { items: [], total: 0 }

  let query = supabase
    .from('hr_movements')
    .select('*, hr_employees(first_name, last_name, employee_number)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (!isManager && myEmployeeId) query = query.eq('employee_id', myEmployeeId)
  if (filter !== 'all') query = query.eq('status', filter)

  const { data, count, error } = await query
  if (error) throw error
  return { items: data || [], total: count || 0 }
}

/**
 * Inserts the request and, if the hr module has an active approval workflow, routes it through
 * approval. Returns { message, approvalError } rather than throwing on the approval step — the
 * insert already succeeded, so the caller toasts both the approval error and the fallback success
 * message (matching the original inline behavior) rather than losing the created record.
 */
export async function createMovement(tenantId, data, employees, myEmployee, isManager, userId) {
  const { data: inserted, error } = await supabase.from('hr_movements').insert({
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
    created_by:    userId || null,
  }).select('id').single()
  if (error) throw error

  let message = 'Movement request submitted.'
  let approvalError = null
  try {
    const emp = isManager ? employees.find(e => e.id === data.employee_id) : myEmployee
    const result = await submitForApproval({
      tenantId, module: 'hr', recordId: inserted.id, recordType: 'movement',
      title: `Movement Request${emp ? ` — ${emp.first_name} ${emp.last_name}` : ''}`,
      description: `${data.movement_type} · ${data.from_date} → ${data.to_date}${data.location ? ` · ${data.location}` : ''} · ${data.reason}`,
      requestedBy: userId || null,
    })
    if (result.submitted) message = `Movement submitted for approval (${result.request.request_number}).`
  } catch (err) {
    approvalError = err.message
  }
  return { message, approvalError }
}

export async function approveMovement(mv, userId) {
  const now = new Date().toISOString()
  const { error } = await supabase.from('hr_movements')
    .update({ status: 'approved', approved_by: userId, approved_at: now, updated_at: now })
    .eq('id', mv.id)
  if (error) throw error
}

export async function rejectMovement(mv, reason) {
  const { error } = await supabase.from('hr_movements')
    .update({ status: 'rejected', rejection_reason: reason || null, updated_at: new Date().toISOString() })
    .eq('id', mv.id)
  if (error) throw error
}

export async function cancelMovement(mv) {
  const { error } = await supabase.from('hr_movements')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', mv.id)
  if (error) throw error
}
