import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal, Button, Input, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { COUNTRIES, CUSTOMER_INDUSTRIES as INDUSTRIES } from '@shared/lib/constants'
import { saveCustomer } from '../api/customers'

const customerSchema = z.object({
  name:         z.string().trim().min(1, 'Company name is required'),
  contact_name: z.string().trim().optional(),
  email:        z.string().email('Enter a valid email').or(z.literal('')).optional(),
  phone:        z.string().trim().optional(),
  country:      z.string().trim().optional(),
  address:      z.string().trim().optional(),
  industry:     z.string().trim().optional(),
  status:       z.enum(['active', 'inactive']),
  credit_limit: z.coerce.number().min(0).optional(),
})

const EMPTY_VALS = {
  name: '', contact_name: '', email: '', phone: '',
  country: '', address: '', industry: '', status: 'active', credit_limit: 0,
}

export default function CustomerModal({ open, onClose, onSaved, customer }) {
  const { tenantId } = useTenant()
  const isEdit = Boolean(customer)

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(customerSchema), defaultValues: EMPTY_VALS })

  useEffect(() => {
    if (!open) return
    reset(customer
      ? {
          name:         customer.name         || '',
          contact_name: customer.contact_name || '',
          email:        customer.email        || '',
          phone:        customer.phone        || '',
          country:      customer.country      || '',
          address:      customer.address      || '',
          industry:     customer.industry     || '',
          status:       customer.status       || 'active',
          credit_limit: Number(customer.credit_limit) || 0,
        }
      : EMPTY_VALS)
  }, [open, customer, reset])

  const onSubmit = async (data) => {
    try {
      await saveCustomer(tenantId, customer, data)
      toast.success(isEdit ? 'Customer updated.' : 'Customer added.')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? 'Edit Customer' : 'New Customer'} size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input
                label="Company Name"
                placeholder="Customer company name"
                error={errors.name?.message}
                {...register('name')}
              />
            </div>
            <Input
              label="Contact Person"
              placeholder="Full name"
              {...register('contact_name')}
            />
            <Input
              label="Email"
              type="email"
              placeholder="contact@company.com"
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
            <Select label="Industry" {...register('industry')}>
              <option value="">Select industry…</option>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </Select>
            <Select label="Status" {...register('status')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
            <div className="col-span-2">
              <Input
                label="Credit Limit ($)"
                type="number"
                placeholder="0"
                min="0"
                step="100"
                {...register('credit_limit')}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              {isEdit ? 'Save Changes' : 'Add Customer'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
