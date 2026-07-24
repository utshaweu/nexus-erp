import { supabase } from '@shared/api/supabase'
import registry from '@core/registry/ModuleRegistry'

export async function fetchConfigStats(tenantId) {
  if (!tenantId) return { users: 0, modules: 0, periods: 0, openPeriods: 0 }

  const [usersRes, periodsRes] = await Promise.all([
    supabase
      .from('tenant_users')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_active', true),
    supabase
      .from('fiscal_periods')
      .select('id, status')
      .eq('tenant_id', tenantId),
  ])

  const all = periodsRes.data ?? []
  return {
    users:       usersRes.count ?? 0,
    modules:     registry.getInstalled().length,
    periods:     all.length,
    openPeriods: all.filter(p => p.status === 'open').length,
  }
}
