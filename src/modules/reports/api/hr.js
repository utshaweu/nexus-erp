import { supabase } from '@shared/api/supabase'

export async function fetchReportDepartments(tenantId) {
  const { data } = await supabase
    .from('hr_departments')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name')
  return data || []
}

export async function runHRReport(tenantId, { date_from, date_to, department_id }) {
  let empQuery = supabase
    .from('hr_employees')
    .select('id, employee_number, first_name, last_name, employment_type, status, join_date, basic_salary, department:department_id(name)')
    .eq('tenant_id', tenantId)
    .order('first_name')
  if (department_id) empQuery = empQuery.eq('department_id', department_id)

  const payrollQuery = supabase
    .from('hr_payroll_runs')
    .select('id, run_number, period_month, period_year, status, total_gross, total_deductions, total_net')
    .eq('tenant_id', tenantId)
    .gte('created_at', date_from)
    .lte('created_at', date_to + 'T23:59:59')
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false })

  const leaveQuery = supabase
    .from('hr_leave_requests')
    .select('id, start_date, end_date, days_count, status, reason, employee:employee_id(first_name, last_name, employee_number, department_id), leave_type:leave_type_id(name)')
    .eq('tenant_id', tenantId)
    .gte('start_date', date_from)
    .lte('start_date', date_to)
    .order('start_date', { ascending: false })

  const attendanceQuery = supabase
    .from('hr_attendance')
    .select('id, date, status, check_in_time, check_out_time, employee:employee_id(first_name, last_name, employee_number)')
    .eq('tenant_id', tenantId)
    .gte('date', date_from)
    .lte('date', date_to)
    .order('date', { ascending: false })

  const [empRes, payrollRes, leaveRes, attRes] = await Promise.all([
    empQuery, payrollQuery, leaveQuery, attendanceQuery,
  ])

  if (empRes.error)     throw empRes.error
  if (payrollRes.error) throw payrollRes.error
  if (leaveRes.error)   throw leaveRes.error
  if (attRes.error)     throw attRes.error

  return {
    headcountData:  empRes.data     || [],
    payrollData:    payrollRes.data || [],
    leaveData:      leaveRes.data   || [],
    attendanceData: attRes.data     || [],
  }
}
