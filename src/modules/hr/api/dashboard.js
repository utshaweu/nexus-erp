import { supabase } from '@shared/api/supabase'

const DEPT_COLORS = [
  '#ec4899','#6366f1','#10b981','#f59e0b','#8b5cf6','#06b6d4','#ef4444','#84cc16',
]

export async function fetchHRDashboard(tenantId) {
  const today = new Date().toISOString().slice(0, 10)

  const [
    { count: totalEmployees },
    { count: deptCount },
    { count: onLeaveCount },
    { data: employees },
    { data: depts },
    { data: pendingLeaveData },
    { data: pendingMovementData },
    { data: payrollData },
  ] = await Promise.all([
    supabase.from('hr_employees').select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('status', 'active'),

    supabase.from('hr_departments').select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('is_active', true),

    supabase.from('hr_leave_requests').select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'approved')
      .lte('start_date', today)
      .gte('end_date', today),

    supabase.from('hr_employees')
      .select('*, hr_departments(name), hr_positions(title)')
      .eq('tenant_id', tenantId)
      .order('join_date', { ascending: false })
      .limit(5),

    supabase.from('hr_departments')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .eq('is_active', true),

    supabase.from('hr_leave_requests')
      .select('*, hr_employees(first_name, last_name, employee_number), hr_leave_types(name)')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5),

    supabase.from('hr_movements')
      .select('*, hr_employees(first_name, last_name, employee_number)')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5),

    supabase.from('hr_payroll_runs')
      .select('total_net')
      .eq('tenant_id', tenantId)
      .in('status', ['approved', 'paid'])
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })
      .limit(1),
  ])

  let deptData = []
  if (depts && employees) {
    const deptCounts = {}
    employees.forEach(e => {
      if (e.department_id) deptCounts[e.department_id] = (deptCounts[e.department_id] || 0) + 1
    })
    deptData = depts
      .map((d, i) => ({ name: d.name, value: deptCounts[d.id] || 0, color: DEPT_COLORS[i % DEPT_COLORS.length] }))
      .filter(d => d.value > 0)
  }

  return {
    stats: {
      total:       totalEmployees || 0,
      departments: deptCount      || 0,
      onLeave:     onLeaveCount   || 0,
      payroll:     payrollData?.[0]?.total_net || 0,
    },
    deptData,
    recentHires:      employees            || [],
    pendingLeaves:    pendingLeaveData      || [],
    pendingMovements: pendingMovementData   || [],
  }
}
