import { supabase } from '@shared/api/supabase'

export async function fetchActiveEmployeesForAttendance(tenantId) {
  if (!tenantId) return []
  const { data } = await supabase
    .from('hr_employees')
    .select('id, first_name, last_name, employee_number, hr_departments(name)')
    .eq('tenant_id', tenantId)
    .in('status', ['active', 'on_leave'])
    .order('first_name')
  return data || []
}

export async function fetchAttendanceForDate(tenantId, date) {
  if (!tenantId || !date) return []
  const { data, error } = await supabase
    .from('hr_attendance')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('date', date)
  if (error) throw error
  return data || []
}

export async function saveAttendanceEntry(tenantId, record, employee, date, data, userId) {
  const showTimes = ['present', 'late', 'half_day'].includes(data.status)
  const payload = {
    status:         data.status,
    check_in_time:  showTimes && data.check_in_time  ? data.check_in_time  : null,
    check_out_time: showTimes && data.check_out_time ? data.check_out_time : null,
    notes:          data.notes || null,
    updated_at:     new Date().toISOString(),
  }

  if (record) {
    const { error } = await supabase.from('hr_attendance').update(payload).eq('id', record.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('hr_attendance').insert({
      ...payload,
      tenant_id:   tenantId,
      employee_id: employee.id,
      date,
      created_by:  userId || null,
    })
    if (error) throw error
  }
}

export async function bulkMarkAttendance(tenantId, employees, date, status, userId) {
  const records = employees.map(e => ({
    tenant_id:   tenantId,
    employee_id: e.id,
    date,
    status,
    created_by:  userId || null,
    updated_at:  new Date().toISOString(),
  }))
  const { error } = await supabase.from('hr_attendance').insert(records)
  if (error) throw error
  return records.length
}
