import { supabase } from '@shared/api/supabase'
import { PAGE_SIZE_TABLE as PAGE_SIZE } from '@shared/lib/constants'

export async function fetchEmployees(tenantId, { page, search, filter }) {
  if (!tenantId) return { items: [], total: 0 }

  let query = supabase
    .from('hr_employees')
    .select('*, hr_departments(name), hr_positions(title)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (filter !== 'all') query = query.eq('status', filter)
  if (search.trim()) {
    query = query.or(
      `first_name.ilike.%${search.trim()}%,last_name.ilike.%${search.trim()}%,employee_number.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`
    )
  }

  const { data, count, error } = await query
  if (error) throw error
  return { items: data || [], total: count || 0 }
}

/** id/name/number only — feeds manager pickers on the Employee form and is reused by Movement's employee picker. */
export async function fetchActiveEmployeeOptions(tenantId) {
  if (!tenantId) return []
  const { data } = await supabase
    .from('hr_employees')
    .select('id, first_name, last_name, employee_number')
    .eq('tenant_id', tenantId)
    .in('status', ['active', 'on_leave'])
    .order('first_name')
  return data || []
}

export async function fetchTenantUsersForLink(tenantId) {
  if (!tenantId) return []
  const { data } = await supabase
    .from('tenant_users')
    .select('user_id, full_name, role')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('full_name')
  return data || []
}

export async function fetchEmployeeDetail(id) {
  const { data, error } = await supabase
    .from('hr_employees')
    .select('*, hr_departments(name), hr_positions(title)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function fetchEmployeeLeaves(employeeId) {
  const { data } = await supabase
    .from('hr_leave_requests')
    .select('*, hr_leave_types(name)')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })
    .limit(50)
  return data || []
}

export async function fetchEmployeePayrolls(employeeId) {
  const { data } = await supabase
    .from('hr_payroll_entries')
    .select('*, hr_payroll_runs(run_number, period_month, period_year, status)')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })
    .limit(50)
  return data || []
}

export async function saveEmployee(tenantId, employee, data) {
  const payload = {
    first_name:          data.first_name,
    last_name:           data.last_name,
    email:               data.email               || null,
    phone:               data.phone               || null,
    gender:              data.gender              || null,
    date_of_birth:       data.date_of_birth       || null,
    address:             data.address             || null,
    nationality:         data.nationality         || null,
    join_date:           data.join_date,
    employment_type:     data.employment_type,
    status:              data.status,
    department_id:       data.department_id       || null,
    position_id:         data.position_id         || null,
    manager_id:          data.manager_id          || null,
    user_id:             data.user_id             || null,
    basic_salary:        parseFloat(data.basic_salary) || 0,
    bank_account_name:   data.bank_account_name   || null,
    bank_account_number: data.bank_account_number || null,
    bank_name:           data.bank_name           || null,
    notes:               data.notes               || null,
    updated_at:          new Date().toISOString(),
  }

  if (employee) {
    const { error } = await supabase.from('hr_employees').update(payload).eq('id', employee.id)
    if (error) throw error
  } else {
    const { data: num, error: numErr } = await supabase.rpc('generate_employee_number')
    if (numErr) throw numErr
    const { error } = await supabase
      .from('hr_employees')
      .insert({ ...payload, tenant_id: tenantId, employee_number: num })
    if (error) throw error
  }
}

export async function deleteEmployee(employee) {
  const { error } = await supabase.from('hr_employees').delete().eq('id', employee.id)
  if (error) throw error
}
