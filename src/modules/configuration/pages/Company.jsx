import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Save } from 'lucide-react'
import {
  Button, Input, Select, PageHeader, Card, CardHeader, CardTitle, CardContent, Spinner,
} from '@shared/components/ui'
import { useTenant } from '@core/tenant/TenantContext'
import { supabase } from '@/shared/api/supabase'
import PermissionGate from '@shared/components/PermissionGate'
import toast from '@shared/lib/toast'

const PLAN_OPTIONS   = ['starter', 'growth', 'enterprise']
const STATUS_OPTIONS = ['active', 'suspended', 'trial']

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1) }

export default function Company() {
  const { tenant, refreshTenant, tenantId } = useTenant()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    defaultValues: {
      name:     '',
      logo_url: '',
      plan:     'starter',
      status:   'active',
      address:  '',
      phone:    '',
      email:    '',
      website:  '',
      currency: 'USD',
      tax_id:   '',
      timezone: 'UTC',
    },
  })

  // Sync form values whenever the tenant context loads or refreshes
  useEffect(() => {
    if (!tenant) return
    reset({
      name:     tenant.name             ?? '',
      logo_url: tenant.logo_url         ?? '',
      plan:     tenant.plan             ?? 'starter',
      status:   tenant.status           ?? 'active',
      address:  tenant.settings?.address  ?? '',
      phone:    tenant.settings?.phone    ?? '',
      email:    tenant.settings?.email    ?? '',
      website:  tenant.settings?.website  ?? '',
      currency: tenant.settings?.currency ?? 'USD',
      tax_id:   tenant.settings?.tax_id   ?? '',
      timezone: tenant.settings?.timezone ?? 'UTC',
    })
  }, [tenant, reset])

  const onSubmit = async (data) => {
    const { error } = await supabase
      .from('tenants')
      .update({
        name:     data.name.trim(),
        logo_url: data.logo_url.trim() || null,
        plan:     data.plan,
        status:   data.status,
        settings: {
          ...(tenant?.settings ?? {}),
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

    if (error) {
      toast.error(error.message)
    } else {
      await refreshTenant()
      reset(data)         // mark form as pristine so isDirty resets
      toast.success('Company settings saved.')
    }
  }

  const logoUrl = watch('logo_url')

  if (!tenant) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="w-6 h-6" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-6">
        <PageHeader
          title="Company Settings"
          breadcrumb="Configuration / Company"
          actions={
            <PermissionGate action="edit" moduleId="configuration">
              <Button
                type="submit"
                size="sm"
                loading={isSubmitting}
                disabled={!isDirty}
              >
                <Save className="w-4 h-4" />
                Save Changes
              </Button>
            </PermissionGate>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Basic Info ──────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Company Name"
                placeholder="Acme Corp"
                error={errors.name?.message}
                {...register('name', { required: 'Company name is required' })}
              />

              <Input
                label="Slug (auto-generated, read-only)"
                value={tenant.slug}
                readOnly
                className="opacity-60 cursor-not-allowed bg-surface-100 dark:bg-surface-800"
              />

              <Input
                label="Logo URL"
                placeholder="https://cdn.example.com/logo.png"
                {...register('logo_url')}
              />

              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Plan"
                  {...register('plan')}
                >
                  {PLAN_OPTIONS.map(p => (
                    <option key={p} value={p}>{capitalize(p)}</option>
                  ))}
                </Select>

                <Select
                  label="Status"
                  {...register('status')}
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s} value={s}>{capitalize(s)}</option>
                  ))}
                </Select>
              </div>

              {/* Logo preview */}
              {logoUrl && (
                <div className="flex items-center gap-3 pt-1">
                  <img
                    src={logoUrl}
                    alt="Logo preview"
                    className="h-10 w-10 rounded border border-surface-200 dark:border-surface-700 object-contain bg-white"
                    onError={e => { e.target.style.display = 'none' }}
                  />
                  <span className="text-xs text-slate-500">Logo preview</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Contact & Settings ──────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Contact & Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Business Email"
                type="email"
                placeholder="info@company.com"
                error={errors.email?.message}
                {...register('email', {
                  pattern: {
                    value:   /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Enter a valid email address',
                  },
                })}
              />

              <Input
                label="Phone"
                placeholder="+1 234 567 8900"
                {...register('phone')}
              />

              <Input
                label="Address"
                placeholder="123 Business St, City, Country"
                {...register('address')}
              />

              <Input
                label="Website"
                placeholder="https://company.com"
                {...register('website')}
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Currency Code"
                  placeholder="USD"
                  maxLength={3}
                  error={errors.currency?.message}
                  {...register('currency', {
                    maxLength: { value: 3, message: 'Max 3 characters' },
                  })}
                />

                <Input
                  label="Tax / VAT ID"
                  placeholder="XX-XXXXXXX"
                  {...register('tax_id')}
                />
              </div>

              <Input
                label="Timezone"
                placeholder="Asia/Dhaka"
                {...register('timezone')}
              />
            </CardContent>
          </Card>
        </div>

        <PermissionGate action="edit" moduleId="configuration">
          <div className="flex justify-end">
            <Button
              type="submit"
              loading={isSubmitting}
              disabled={!isDirty}
            >
              <Save className="w-4 h-4" />
              Save Changes
            </Button>
          </div>
        </PermissionGate>
      </div>
    </form>
  )
}
