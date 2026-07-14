import { supabase } from '@shared/api/supabase'

export async function fetchDashboardData(tenantId) {
  const { data: pendingData } = await supabase
    .from('approval_requests')
    .select('*, workflow:approval_workflows(id, name, steps:approval_workflow_steps(id))')
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(6)

  const pending = (pendingData || []).map(r => ({ ...r, totalSteps: r.workflow?.steps?.length || 0 }))

  const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const [pendingCnt, approvedCnt, rejectedCnt] = await Promise.all([
    supabase.from('approval_requests').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'pending'),
    supabase.from('approval_requests').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'approved').gte('updated_at', thisMonth),
    supabase.from('approval_requests').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'rejected').gte('updated_at', thisMonth),
  ])
  const stats = { pending: pendingCnt.count || 0, approved: approvedCnt.count || 0, rejected: rejectedCnt.count || 0 }

  const { data: recentActivity } = await supabase
    .from('approval_requests')
    .select('id, request_number, title, status, updated_at, module')
    .eq('tenant_id', tenantId)
    .in('status', ['approved', 'rejected'])
    .order('updated_at', { ascending: false })
    .limit(5)

  return { pending, stats, recentActivity: recentActivity || [] }
}

export async function fetchPendingRequests(tenantId, { search, priority, module, page, pageSize }) {
  let q = supabase
    .from('approval_requests')
    .select('*, workflow:approval_workflows(id, name)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (search?.trim()) q = q.or(`title.ilike.%${search.trim()}%,request_number.ilike.%${search.trim()}%`)
  if (priority && priority !== 'all') q = q.eq('priority', priority)
  if (module && module !== 'all') q = q.eq('module', module)
  q = q.range((page - 1) * pageSize, page * pageSize - 1)

  const { data, error, count } = await q
  if (error) throw error
  return { requests: data || [], total: count || 0 }
}

export async function fetchWorkflowStepCount(workflowId) {
  const { count } = await supabase
    .from('approval_workflow_steps')
    .select('id', { count: 'exact', head: true })
    .eq('workflow_id', workflowId)
  return count || 1
}

export async function fetchMyRequests(tenantId, userId, { tab, search, page, pageSize }) {
  let q = supabase
    .from('approval_requests')
    .select('*, workflow:approval_workflows(id, name)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('requested_by', userId)
    .order('created_at', { ascending: false })

  if (tab !== 'all') q = q.eq('status', tab)
  if (search?.trim()) q = q.or(`title.ilike.%${search.trim()}%,request_number.ilike.%${search.trim()}%`)
  q = q.range((page - 1) * pageSize, page * pageSize - 1)

  const { data, error, count } = await q
  if (error) throw error
  return { requests: data || [], total: count || 0 }
}

export async function fetchActiveWorkflowsForModule(tenantId, module) {
  const { data } = await supabase
    .from('approval_workflows')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('module', module)
    .eq('is_active', true)
  return data || []
}

export async function createRequest(tenantId, userId, data) {
  const { data: num, error: numErr } = await supabase.rpc('generate_apr_number')
  if (numErr) throw numErr

  const { error } = await supabase.from('approval_requests').insert({
    tenant_id: tenantId, request_number: num,
    title: data.title, description: data.description || null,
    module: data.module, feature: data.feature || null, workflow_id: data.workflow_id || null,
    amount: data.amount !== '' ? parseFloat(data.amount) : null,
    priority: data.priority, record_type: data.record_type || null,
    status: 'pending', current_step: 1,
    requested_by: userId, updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function cancelRequest(id, userId) {
  const { error } = await supabase
    .from('approval_requests')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id).eq('requested_by', userId)
  if (error) throw error
}

export async function fetchHistory(tenantId, { tab, search, module, dateFrom, dateTo, page, pageSize }) {
  let q = supabase
    .from('approval_requests')
    .select('*, workflow:approval_workflows(id, name)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })

  if (tab === 'all') q = q.neq('status', 'pending')
  else q = q.eq('status', tab)

  if (search?.trim()) q = q.or(`title.ilike.%${search.trim()}%,request_number.ilike.%${search.trim()}%`)
  if (module && module !== 'all') q = q.eq('module', module)
  if (dateFrom) q = q.gte('created_at', dateFrom)
  if (dateTo) q = q.lte('created_at', `${dateTo}T23:59:59`)

  q = q.range((page - 1) * pageSize, page * pageSize - 1)

  const { data, error, count } = await q
  if (error) throw error
  return { requests: data || [], total: count || 0 }
}

export async function fetchRequestDetail(id, tenantId) {
  const { data: request, error: reqErr } = await supabase
    .from('approval_requests')
    .select('*, workflow:approval_workflows(id, name)')
    .eq('id', id).eq('tenant_id', tenantId).single()
  if (reqErr) throw reqErr

  let steps = []
  if (request.workflow_id) {
    const { data: wfSteps } = await supabase
      .from('approval_workflow_steps').select('*')
      .eq('workflow_id', request.workflow_id).order('step_order', { ascending: true })
    steps = wfSteps || []
  }

  const { data: actions } = await supabase
    .from('approval_actions')
    .select('*, actor:actor_id(id, email, raw_user_meta_data)')
    .eq('request_id', id).order('acted_at', { ascending: true })

  return { request, steps, actions: actions || [] }
}
