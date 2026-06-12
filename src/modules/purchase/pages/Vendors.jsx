import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Star, Phone, Mail, MapPin } from 'lucide-react'
import { Button, Badge, PageHeader, Card, Modal, Input, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'

const MOCK_VENDORS = [
  { id: 1, name: 'Acme Supplies', contact: 'John Smith', email: 'john@acme.com', phone: '+1-555-0101', country: 'USA', rating: 4.5, orders: 23, totalSpend: 128000, status: 'active', category: 'General' },
  { id: 2, name: 'TechParts Ltd', contact: 'Sarah Lee', email: 'sarah@techparts.com', phone: '+1-555-0102', country: 'Canada', rating: 4.2, orders: 15, totalSpend: 95000, status: 'active', category: 'Technology' },
  { id: 3, name: 'Global Materials', contact: 'Ahmed Hassan', email: 'ahmed@globmat.com', phone: '+971-555-0103', country: 'UAE', rating: 3.8, orders: 8, totalSpend: 62000, status: 'active', category: 'Raw Materials' },
  { id: 4, name: 'FastShip Co', contact: 'Maria Garcia', email: 'maria@fastship.com', phone: '+34-555-0104', country: 'Spain', rating: 4.7, orders: 31, totalSpend: 45000, status: 'active', category: 'Logistics' },
  { id: 5, name: 'Prime Vendors', contact: 'Wei Zhang', email: 'wei@primev.com', phone: '+86-555-0105', country: 'China', rating: 3.5, orders: 5, totalSpend: 28000, status: 'inactive', category: 'General' },
]

const vendorSchema = z.object({
  name:     z.string().trim().min(1, 'Company name is required'),
  contact:  z.string().trim().optional(),
  email:    z.string().email('Enter a valid email').or(z.literal('')),
  phone:    z.string().trim().optional(),
  country:  z.string().trim().optional(),
  category: z.string().min(1, 'Category is required'),
})

function Stars({ rating }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className="w-3 h-3"
          fill={i <= Math.round(rating) ? '#f59e0b' : 'none'}
          stroke={i <= Math.round(rating) ? '#f59e0b' : '#475569'}
        />
      ))}
      <span className="ml-1 text-xs text-slate-400">{rating}</span>
    </div>
  )
}

function VendorCard({ vendor }) {
  return (
    <Card className="p-5 hover:border-surface-700 transition-all cursor-pointer">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-slate-100">{vendor.name}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{vendor.category}</p>
        </div>
        <Badge color={vendor.status === 'active' ? 'green' : 'default'}>
          {vendor.status}
        </Badge>
      </div>

      <Stars rating={vendor.rating} />

      <div className="mt-3 space-y-1.5 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <Mail className="w-3 h-3" />
          <span>{vendor.email}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Phone className="w-3 h-3" />
          <span>{vendor.phone}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3 h-3" />
          <span>{vendor.country}</span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-surface-800 grid grid-cols-2 gap-2 text-center">
        <div>
          <p className="text-lg font-display font-bold text-slate-100">{vendor.orders}</p>
          <p className="text-xs text-slate-500">Orders</p>
        </div>
        <div>
          <p className="text-lg font-display font-bold text-slate-100">${(vendor.totalSpend / 1000).toFixed(0)}K</p>
          <p className="text-xs text-slate-500">Total Spend</p>
        </div>
      </div>
    </Card>
  )
}

function NewVendorModal({ open, onClose }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(vendorSchema),
    defaultValues: { name: '', contact: '', email: '', phone: '', country: '', category: '' },
  })

  const onSubmit = async () => {
    toast.success('Vendor added.')
    reset()
    onClose()
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title="New Vendor" size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input label="Company Name" placeholder="Vendor company name"
                error={errors.name?.message}
                {...register('name')} />
            </div>
            <Input label="Contact Person" placeholder="Full name"
              error={errors.contact?.message}
              {...register('contact')} />
            <Input label="Email" type="email" placeholder="vendor@company.com"
              error={errors.email?.message}
              {...register('email')} />
            <Input label="Phone" placeholder="+1-555-0000"
              {...register('phone')} />
            <Input label="Country" placeholder="Country"
              {...register('country')} />
            <div className="col-span-2">
              <Select label="Category" {...register('category')}>
                <option value="">Select category...</option>
                <option>General</option>
                <option>Technology</option>
                <option>Raw Materials</option>
                <option>Logistics</option>
                <option>Services</option>
              </Select>
              {errors.category && <p className="mt-1 text-xs text-red-400">{errors.category.message}</p>}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>Cancel</Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>Add Vendor</Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

export default function Vendors() {
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)

  const filtered = MOCK_VENDORS.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.contact.toLowerCase().includes(search.toLowerCase()) ||
    v.category.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendors"
        subtitle={`${filtered.length} vendors`}
        breadcrumb="Purchase / Vendors"
        actions={
          <Button size="sm" onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4" /> New Vendor
          </Button>
        }
      />

      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2 max-w-sm px-3 py-1.5 rounded-lg bg-surface-800 border border-surface-700">
          <Search className="w-3.5 h-3.5 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search vendors..."
            className="bg-transparent text-sm text-slate-300 placeholder:text-slate-600 flex-1 outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(vendor => (
          <VendorCard key={vendor.id} vendor={vendor} />
        ))}
      </div>

      <NewVendorModal open={showNew} onClose={() => setShowNew(false)} />
    </div>
  )
}
