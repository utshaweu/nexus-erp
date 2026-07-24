import { supabase } from '@shared/api/supabase'

export const ROLE_OPTIONS = ['owner', 'admin', 'manager', 'user', 'viewer']
export const ROLE_COLOR   = { owner: 'purple', admin: 'blue', manager: 'cyan', user: 'green', viewer: 'default' }
export const PERM_ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'export']

export async function fetchTenantUsers(tenantId) {
  if (!tenantId) return []
  const { data: rpcData, error: rpcErr } = await supabase.rpc('get_tenant_users_with_email')
  if (!rpcErr && rpcData) return rpcData

  const { data } = await supabase
    .from('tenant_users')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('joined_at', { ascending: true })
  return data ?? []
}

export async function updateUserRole(tenantId, user, newRole) {
  const { error } = await supabase
    .from('tenant_users')
    .update({ role: newRole })
    .eq('tenant_id', tenantId)
    .eq('user_id', user.user_id)
  if (error) throw error
}

export async function toggleUserActive(user) {
  const { error } = await supabase
    .from('tenant_users')
    .update({ is_active: !user.is_active })
    .eq('id', user.id)
  if (error) throw error
}

export async function addTenantUser(data) {
  const { data: result, error: rpcError } = await supabase.rpc('add_tenant_user_by_email', {
    p_email:     data.email.toLowerCase(),
    p_role:      data.role,
    p_full_name: data.full_name || null,
  })
  if (rpcError || !result?.success) {
    throw new Error(result?.error ?? rpcError?.message ?? 'Failed to add user.')
  }
}

export async function fetchPermissionOverrides(tenantId, userId) {
  const { data } = await supabase
    .from('tenant_user_permissions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
  return data ?? []
}

async function upsertOrClearPermissionRow(tenantId, userId, moduleId, featureId, perms) {
  const hasOverride = PERM_ACTIONS.some(a => perms[a] !== null)
  if (hasOverride) {
    const { error } = await supabase.from('tenant_user_permissions').upsert(
      {
        tenant_id:   tenantId,
        user_id:     userId,
        module_id:   moduleId,
        feature_id:  featureId,
        can_view:    perms.view,
        can_create:  perms.create,
        can_edit:    perms.edit,
        can_delete:  perms.delete,
        can_approve: perms.approve,
        can_export:  perms.export,
        updated_at:  new Date().toISOString(),
      },
      { onConflict: 'tenant_id,user_id,module_id,feature_id' }
    )
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('tenant_user_permissions')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('module_id', moduleId)
      .eq('feature_id', featureId)
    if (error) throw error
  }
}

export async function savePermissionOverrides(tenantId, userId, overrides) {
  for (const [moduleId, perms] of Object.entries(overrides)) {
    await upsertOrClearPermissionRow(tenantId, userId, moduleId, '', perms)
    for (const [featureId, fperms] of Object.entries(perms.features ?? {})) {
      await upsertOrClearPermissionRow(tenantId, userId, moduleId, featureId, fperms)
    }
  }
}
