import { supabase } from '@shared/api/supabase'

export async function fetchWorkflows(tenantId) {
  const { data, error } = await supabase
    .from('approval_workflows')
    .select('*, steps:approval_workflow_steps(*)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(wf => ({
    ...wf,
    steps: [...(wf.steps || [])].sort((a, b) => a.step_order - b.step_order),
  }))
}

export async function fetchTenantUsers(tenantId) {
  const { data } = await supabase
    .from('tenant_users')
    .select('user_id, role, full_name')
    .eq('tenant_id', tenantId).eq('is_active', true).order('full_name')
  return data || []
}

/** Creates a new workflow or updates an existing one, replacing its steps wholesale. */
export async function saveWorkflow(tenantId, workflow, data) {
  let workflowId = workflow?.id
  if (workflow) {
    const { error } = await supabase.from('approval_workflows').update({
      name: data.name, module: data.module, feature: data.feature,
      trigger_condition: data.trigger_condition,
      updated_at: new Date().toISOString(),
    }).eq('id', workflowId)
    if (error) throw error
    await supabase.from('approval_workflow_steps').delete().eq('workflow_id', workflowId)
  } else {
    const { data: wf, error } = await supabase.from('approval_workflows').insert({
      tenant_id: tenantId, name: data.name, module: data.module, feature: data.feature,
      trigger_condition: data.trigger_condition, is_active: true,
    }).select('id').single()
    if (error) throw error
    workflowId = wf.id
  }

  const { error: sErr } = await supabase.from('approval_workflow_steps').insert(
    data.steps.map((s, i) => ({
      tenant_id: tenantId, workflow_id: workflowId,
      step_order: i + 1, step_name: s.step_name,
      approver_role: s.approver_role, approval_type: s.approval_type,
    }))
  )
  if (sErr) throw sErr
}

export async function toggleWorkflowActive(workflow) {
  const { error } = await supabase.from('approval_workflows')
    .update({ is_active: !workflow.is_active, updated_at: new Date().toISOString() })
    .eq('id', workflow.id)
  if (error) throw error
}

export async function deleteWorkflow(id) {
  const { error } = await supabase.from('approval_workflows').delete().eq('id', id)
  if (error) throw error
}
