import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Modal, Input, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { COUNTRIES, VENDOR_CATEGORIES as CATEGORIES } from '@shared/lib/constants'
import { saveVendor } from '../api/vendors'

const vendorSchema = z.object({
  name:         z.string().trim().min(1, 'Company name is required'),
  contact_name: z.string().trim().optional(),
  email:        z.string().email('Enter a valid email').or(z.literal('')).optional(),
  phone:        z.string().trim().optional(),
  country:      z.string().trim().optional(),
  address:      z.string().trim().optional(),
  category:     z.string().min(1, 'Category is required'),
  status:       z.enum(['active', 'inactive', 'blacklisted']),
})

const DEFAULT_VALUES = { name: '', contact_name: '', email: '', phone: '', country: '', address: '', category: '', status: 'active' }

export default function VendorModal({ open, onClose, onSaved, vendor }) {
  const { tenantId } = useTenant()
  const isEdit = Boolean(vendor)

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(vendorSchema), defaultValues: DEFAULT_VALUES })

  useEffect(() => {
    if (open) {
      reset(vendor
        ? {
            name:         vendor.name         || '',
            contact_name: vendor.contact_name || '',
            email:        vendor.email        || '',
            phone:        vendor.phone        || '',
            country:      vendor.country      || '',
            address:      vendor.address      || '',
            category:     vendor.category     || '',
            status:       vendor.status       || 'active',
          }
        : DEFAULT_VALUES)
    }
  }, [open, vendor, reset])

  const onSubmit = async (data) => {
    try {
      await saveVendor(tenantId, vendor, data)
      toast.success(isEdit ? 'Vendor updated.' : 'Vendor added.')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? 'Edit Vendor' : 'New Vendor'} size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input
                label="Company Name"
                placeholder="Vendor company name"
                error={errors.name?.message}
                {...register('name')}
              />
            </div>
            <Input
              label="Contact Person"
              placeholder="Full name"
              error={errors.contact_name?.message}
              {...register('contact_name')}
            />
            <Input
              label="Email"
              type="email"
              placeholder="vendor@company.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input label="Phone" placeholder="+1-555-0000" {...register('phone')} />
            <Select label="Country" {...register('country')}>
              <option value="">Select country…</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
            <div className="col-span-2">
              <Input label="Address" placeholder="Street, city, zip" {...register('address')} />
            </div>
            <div>
              <Select label="Category" error={errors.category?.message} {...register('category')}>
                <option value="">Select category…</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div>
              <Select label="Status" {...register('status')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="blacklisted">Blacklisted</option>
              </Select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              {isEdit ? 'Save Changes' : 'Add Vendor'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
