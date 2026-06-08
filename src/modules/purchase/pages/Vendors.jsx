import { useState } from 'react'
import { Plus, Search, Star, Phone, Mail, MapPin } from 'lucide-react'
import { Button, Badge, PageHeader, Card, Modal, Input } from '@shared/components/ui'

const MOCK_VENDORS = [
  { id: 1, name: 'Acme Supplies', contact: 'John Smith', email: 'john@acme.com', phone: '+1-555-0101', country: 'USA', rating: 4.5, orders: 23, totalSpend: 128000, status: 'active', category: 'General' },
  { id: 2, name: 'TechParts Ltd', contact: 'Sarah Lee', email: 'sarah@techparts.com', phone: '+1-555-0102', country: 'Canada', rating: 4.2, orders: 15, totalSpend: 95000, status: 'active', category: 'Technology' },
  { id: 3, name: 'Global Materials', contact: 'Ahmed Hassan', email: 'ahmed@globmat.com', phone: '+971-555-0103', country: 'UAE', rating: 3.8, orders: 8, totalSpend: 62000, status: 'active', category: 'Raw Materials' },
  { id: 4, name: 'FastShip Co', contact: 'Maria Garcia', email: 'maria@fastship.com', phone: '+34-555-0104', country: 'Spain', rating: 4.7, orders: 31, totalSpend: 45000, status: 'active', category: 'Logistics' },
  { id: 5, name: 'Prime Vendors', contact: 'Wei Zhang', email: 'wei@primev.com', phone: '+86-555-0105', country: 'China', rating: 3.5, orders: 5, totalSpend: 28000, status: 'inactive', category: 'General' },
]

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
  const [form, setForm] = useState({ name: '', contact: '', email: '', phone: '', country: '', category: '' })

  return (
    <Modal open={open} onClose={onClose} title="New Vendor" size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input label="Company Name" placeholder="Vendor company name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <Input label="Contact Person" placeholder="Full name" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} />
          <Input label="Email" type="email" placeholder="vendor@company.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <Input label="Phone" placeholder="+1-555-0000" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <Input label="Country" placeholder="Country" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
          <div className="col-span-2">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide block mb-1.5">Category</label>
            <select
              className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 bg-surface-900 border border-surface-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
            >
              <option value="">Select category...</option>
              <option>General</option>
              <option>Technology</option>
              <option>Raw Materials</option>
              <option>Logistics</option>
              <option>Services</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={() => { alert('Vendor created (demo)'); onClose() }}>Add Vendor</Button>
        </div>
      </div>
    </Modal>
  )
}

export default function Vendors() {
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [view, setView] = useState('grid') // 'grid' | 'list'

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
