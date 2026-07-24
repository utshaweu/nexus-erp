import { supabase } from '@shared/api/supabase'

export async function fetchFiscalPeriods(tenantId) {
  if (!tenantId) return []
  const { data } = await supabase
    .from('fiscal_periods')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('start_date', { ascending: false })
  return data ?? []
}

export async function createFiscalPeriod(tenantId, data) {
  const { error } = await supabase.from('fiscal_periods').insert({
    tenant_id:  tenantId,
    name:       data.name.trim(),
    start_date: data.start_date,
    end_date:   data.end_date,
    status:     'open',
  })
  if (error) throw error
}

export async function setFiscalPeriodStatus(period, status) {
  const { error } = await supabase.from('fiscal_periods').update({ status }).eq('id', period.id)
  if (error) throw error
}

export async function deleteFiscalPeriod(period) {
  const { error } = await supabase.from('fiscal_periods').delete().eq('id', period.id)
  if (error) throw error
}
