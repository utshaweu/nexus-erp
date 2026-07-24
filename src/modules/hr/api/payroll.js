import { supabase } from '@shared/api/supabase'
import { PAGE_SIZE_TABLE as PAGE_SIZE } from '@shared/lib/constants'

export async function fetchPayrollRuns(tenantId, { page, search, filter }) {
  if (!tenantId) return { items: [], total: 0 }

  let query = supabase
    .from('hr_payroll_runs')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (filter !== 'all') query = query.eq('status', filter)
  if (search.trim()) query = query.ilike('run_number', `%${search.trim()}%`)

  const { data, count, error } = await query
  if (error) throw error
  return { items: data || [], total: count || 0 }
}

export async function createPayrollRun(tenantId, data, userId) {
  const { data: num, error: numErr } = await supabase.rpc('generate_payroll_run_number')
  if (numErr) throw numErr

  const { error } = await supabase.from('hr_payroll_runs').insert({
    tenant_id:    tenantId,
    run_number:   num,
    period_month: parseInt(data.period_month),
    period_year:  parseInt(data.period_year),
    notes:        data.notes || null,
    status:       'draft',
    created_by:   userId || null,
  })
  if (error) throw error
}

export async function deletePayrollRun(run) {
  if (run.status !== 'draft') throw new Error('Only draft payroll runs can be deleted.')
  const { error } = await supabase.from('hr_payroll_runs').delete().eq('id', run.id)
  if (error) throw error
}

export async function fetchRunEntries(runId) {
  const { data } = await supabase
    .from('hr_payroll_entries')
    .select('*, hr_employees(first_name, last_name, employee_number, hr_departments(name))')
    .eq('payroll_run_id', runId)
    .order('created_at')
  return data || []
}

/** id/name/number/basic_salary only — feeds the "add employee to run" picker. */
export async function fetchEmployeeOptionsForPayroll(tenantId) {
  if (!tenantId) return []
  const { data } = await supabase
    .from('hr_employees')
    .select('id, first_name, last_name, employee_number, basic_salary')
    .eq('tenant_id', tenantId)
    .in('status', ['active', 'on_leave'])
    .order('first_name')
  return data || []
}

async function recalcRunTotals(runId) {
  const { data: entries } = await supabase
    .from('hr_payroll_entries')
    .select('gross_salary, deductions, net_salary')
    .eq('payroll_run_id', runId)

  const totalGross      = (entries || []).reduce((s, e) => s + (e.gross_salary || 0), 0)
  const totalDeductions = (entries || []).reduce((s, e) => s + (e.deductions   || 0), 0)
  const totalNet        = (entries || []).reduce((s, e) => s + (e.net_salary   || 0), 0)

  await supabase.from('hr_payroll_runs')
    .update({ total_gross: totalGross, total_deductions: totalDeductions, total_net: totalNet, updated_at: new Date().toISOString() })
    .eq('id', runId)
}

export async function savePayrollEntry(runId, tenantId, entry, data) {
  const basic      = parseFloat(data.basic_salary) || 0
  const allowances = parseFloat(data.allowances)   || 0
  const deductions = parseFloat(data.deductions)   || 0
  const gross      = basic + allowances
  const net        = Math.max(0, gross - deductions)

  const payload = {
    basic_salary: basic, allowances, deductions,
    gross_salary: gross, net_salary: net,
    notes: data.notes || null,
  }

  if (entry) {
    const { error } = await supabase.from('hr_payroll_entries').update(payload).eq('id', entry.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('hr_payroll_entries').insert({
      ...payload, tenant_id: tenantId, payroll_run_id: runId, employee_id: data.employee_id,
    })
    if (error) throw error
  }

  await recalcRunTotals(runId)
}

export async function deletePayrollEntry(entry, runId) {
  const { error } = await supabase.from('hr_payroll_entries').delete().eq('id', entry.id)
  if (error) throw error
  await recalcRunTotals(runId)
}

export async function approvePayrollRun(run, userId) {
  const { error } = await supabase.from('hr_payroll_runs').update({
    status: 'approved', approved_by: userId || null,
    approved_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', run.id)
  if (error) throw error
}

export async function markPayrollRunPaid(run) {
  const { error } = await supabase.from('hr_payroll_runs')
    .update({ status: 'paid', updated_at: new Date().toISOString() })
    .eq('id', run.id)
  if (error) throw error
}
