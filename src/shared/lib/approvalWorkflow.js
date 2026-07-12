/**
 * Bridges other modules to the Approval module.
 *
 * Other modules never touch `approval_requests` directly — they call
 * `submitForApproval()` to hand a record off to whatever active workflow
 * exists for their module, and the Approval module calls
 * `applyApprovalOutcome()` when a request reaches a terminal state so the
 * originating record's own status stays in sync.
 *
 * A module with no active workflow configured is untouched: callers should
 * treat `submitted: false` as "fall back to your existing behaviour."
 */
import { supabase } from '@shared/api/supabase'
import EventBus, { ERP_EVENTS } from '@core/eventbus/EventBus'
import { deductLeaveBalance } from './leaveBalances'

// record_type -> where to write back the approval outcome, using each
// table's own existing status vocabulary (no schema changes required).
// leave_request and movement are handled separately below — they track
// approved_by/approved_at/rejection_reason, and leave_request also has to
// deduct the leave balance and flip the employee to on_leave.
const RECORD_STATUS_TARGETS = {
  purchase_order: { table: 'purchase_orders', approved: 'approved',   rejected: 'cancelled' },
  sales_order:    { table: 'sales_orders',    approved: 'confirmed',  rejected: 'cancelled' },
  bill:           { table: 'bills',           approved: 'posted',     rejected: 'cancelled' },
}

async function applyAssetDisposalOutcome({ recordId, outcome }) {
  const now = new Date().toISOString()
  if (outcome === 'approved') {
    await supabase.from('assets').update({ status: 'disposed', updated_at: now }).eq('id', recordId)
    await supabase.from('asset_depreciation_schedules')
      .update({ status: 'cancelled' }).eq('asset_id', recordId).eq('status', 'scheduled')
  } else {
    // Disposal was rejected — clear the proposed disposal fields the submitter staged, asset stays active.
    await supabase.from('assets')
      .update({ disposal_date: null, disposal_amount: null, updated_at: now })
      .eq('id', recordId)
  }
}

async function applyMovementOutcome({ recordId, outcome, actorId, comment }) {
  const now = new Date().toISOString()
  if (outcome === 'approved') {
    await supabase.from('hr_movements')
      .update({ status: 'approved', approved_by: actorId || null, approved_at: now, updated_at: now })
      .eq('id', recordId)
  } else {
    await supabase.from('hr_movements')
      .update({ status: 'rejected', rejection_reason: comment?.trim() || null, updated_at: now })
      .eq('id', recordId)
  }
}

async function applyLeaveRequestOutcome({ recordId, outcome, actorId, comment }) {
  const { data: req } = await supabase
    .from('hr_leave_requests')
    .select('id, tenant_id, employee_id, leave_type_id, days_count, start_date')
    .eq('id', recordId).maybeSingle()
  if (!req) return

  const now = new Date().toISOString()
  if (outcome === 'approved') {
    await supabase.from('hr_leave_requests')
      .update({ status: 'approved', approved_by: actorId || null, approved_at: now, updated_at: now })
      .eq('id', recordId)
    await deductLeaveBalance(req.tenant_id, req.employee_id, req.leave_type_id, req.days_count)
    if (req.start_date <= now.slice(0, 10)) {
      await supabase.from('hr_employees').update({ status: 'on_leave', updated_at: now }).eq('id', req.employee_id)
    }
  } else {
    await supabase.from('hr_leave_requests')
      .update({ status: 'rejected', rejection_reason: comment?.trim() || null, updated_at: now })
      .eq('id', recordId)
  }
}

export async function findActiveWorkflow(tenantId, module) {
  if (!tenantId || !module) return null
  const { data } = await supabase
    .from('approval_workflows')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('module', module)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data || null
}

/**
 * Creates an approval_requests row for a record if — and only if — the
 * module has an active workflow. Returns { submitted: false } otherwise so
 * the caller can keep its own simpler status transition.
 */
export async function submitForApproval({
  tenantId, module, recordId, recordType, title, description,
  amount, priority = 'normal', requestedBy,
}) {
  const workflow = await findActiveWorkflow(tenantId, module)
  if (!workflow) return { submitted: false, reason: 'no_active_workflow' }

  const { data: requestNumber, error: numErr } = await supabase.rpc('generate_apr_number')
  if (numErr) throw numErr

  const { data: request, error } = await supabase
    .from('approval_requests')
    .insert({
      tenant_id: tenantId, request_number: requestNumber, workflow_id: workflow.id,
      title, description: description || null, module,
      record_id: recordId || null, record_type: recordType || null,
      amount: amount ?? null, priority, status: 'pending', current_step: 1,
      requested_by: requestedBy,
    })
    .select('*')
    .single()
  if (error) throw error

  EventBus.emit(ERP_EVENTS.APPROVAL_REQUESTED, { request })
  return { submitted: true, request }
}

/** Writes an approve/reject outcome back onto the record that triggered the request, if one is linked. */
export async function applyApprovalOutcome({ tenantId, module, recordType, recordId, outcome, actorId, comment }) {
  if (!recordId || !recordType) return

  if (recordType === 'leave_request') {
    await applyLeaveRequestOutcome({ recordId, outcome, actorId, comment })
  } else if (recordType === 'movement') {
    await applyMovementOutcome({ recordId, outcome, actorId, comment })
  } else if (recordType === 'asset_disposal') {
    await applyAssetDisposalOutcome({ recordId, outcome })
  } else {
    const target = RECORD_STATUS_TARGETS[recordType]
    const status = target?.[outcome]
    if (!status) return
    await supabase.from(target.table).update({ status }).eq('id', recordId).eq('tenant_id', tenantId)
  }

  EventBus.emit(
    outcome === 'approved' ? ERP_EVENTS.APPROVAL_APPROVED : ERP_EVENTS.APPROVAL_REJECTED,
    { module, recordType, recordId, tenantId }
  )
}

/**
 * Records one approve/reject decision on a request: logs the action, advances
 * the workflow (or finalizes it), and — on a terminal outcome — syncs the
 * originating record via applyApprovalOutcome(). Shared by PendingApprovals
 * and ApprovalDetail so both pages resolve a decision identically.
 */
export async function actOnApprovalRequest({ tenantId, request, totalSteps = 1, action, actorId, comment }) {
  const { error: actErr } = await supabase.from('approval_actions').insert({
    tenant_id: tenantId, request_id: request.id, step_number: request.current_step,
    action: action === 'approve' ? 'approved' : 'rejected', actor_id: actorId,
    comment: comment?.trim() || null,
  })
  if (actErr) throw actErr

  let patch = { updated_at: new Date().toISOString() }
  let outcome = null
  if (action === 'approve') {
    if (request.current_step >= totalSteps) {
      patch.status = 'approved'
      outcome = 'approved'
    } else {
      patch.current_step = request.current_step + 1
    }
  } else {
    patch.status = 'rejected'
    outcome = 'rejected'
  }

  const { error: updErr } = await supabase.from('approval_requests').update(patch).eq('id', request.id)
  if (updErr) throw updErr

  if (outcome) {
    await applyApprovalOutcome({
      tenantId, module: request.module, recordType: request.record_type,
      recordId: request.record_id, outcome, actorId, comment,
    })
  }

  return { ...request, ...patch }
}
