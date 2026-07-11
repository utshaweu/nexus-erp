/**
 * hr_leave_balances bookkeeping shared by the Leave page's direct approve/cancel
 * actions and the Approval module's outcome handler, so both paths keep the
 * same balance regardless of which one resolved the request.
 */
import { supabase } from '@shared/api/supabase'

const currentYear = new Date().getFullYear()

export async function deductLeaveBalance(tenantId, employeeId, leaveTypeId, days) {
  const { data: existing } = await supabase
    .from('hr_leave_balances').select('*')
    .eq('employee_id', employeeId).eq('leave_type_id', leaveTypeId).eq('year', currentYear)
    .maybeSingle()
  if (existing) {
    await supabase.from('hr_leave_balances')
      .update({ used_days: parseFloat(existing.used_days) + days, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
  } else {
    const { data: type } = await supabase
      .from('hr_leave_types').select('days_allowed').eq('id', leaveTypeId).maybeSingle()
    await supabase.from('hr_leave_balances').insert({
      tenant_id: tenantId, employee_id: employeeId, leave_type_id: leaveTypeId,
      year: currentYear, total_days: type?.days_allowed || 0, used_days: days,
    })
  }
}

export async function refundLeaveBalance(employeeId, leaveTypeId, days) {
  const { data: existing } = await supabase
    .from('hr_leave_balances').select('*')
    .eq('employee_id', employeeId).eq('leave_type_id', leaveTypeId).eq('year', currentYear)
    .maybeSingle()
  if (existing) {
    await supabase.from('hr_leave_balances')
      .update({ used_days: Math.max(0, parseFloat(existing.used_days) - days), updated_at: new Date().toISOString() })
      .eq('id', existing.id)
  }
}
