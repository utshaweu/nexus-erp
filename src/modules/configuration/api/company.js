import { supabase } from '@shared/api/supabase'

export async function updateCompany(tenantId, data, currentSettings) {
  const { error } = await supabase
    .from('tenants')
    .update({
      name:     data.name.trim(),
      logo_url: data.logo_url.trim() || null,
      plan:     data.plan,
      status:   data.status,
      settings: {
        ...(currentSettings ?? {}),
        address:  data.address.trim(),
        phone:    data.phone.trim(),
        email:    data.email.trim(),
        website:  data.website.trim(),
        currency: data.currency.trim().toUpperCase() || 'USD',
        tax_id:   data.tax_id.trim(),
        timezone: data.timezone.trim() || 'UTC',
      },
    })
    .eq('id', tenantId)
  if (error) throw error
}
