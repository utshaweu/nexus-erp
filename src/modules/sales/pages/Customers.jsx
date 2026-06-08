import { useState } from 'react'
import { Plus, Search, Mail, Phone, MapPin, TrendingUp } from 'lucide-react'
import { Button, Badge, PageHeader, Card, Modal, Input } from '@shared/components/ui'

const MOCK_CUSTOMERS = [
  { id: 1, name: 'Bright Corp', contact: 'Emma Johnson', email: 'emma@brightcorp.com', phone: '+1-555-0201', country: 'USA', industry: 'Technology', orders: 12, totalRevenue: 128000, status: 'active' },
  { id: 2, name: 'Nova Retail', contact: 'Liam Patel', email: 'liam@novaretail.com', phone: '+44-555-0202', country: 'UK', industry: 'Retail', orders: 8, totalRevenue: 74000, status: 'active' },
  { id: 3, name: 'Summit Tech', contact: 'Olivia Chen', email: 'olivia@summittech.com', phone: '+1-555-0203', country: 'Canada', industry: 'Technology', orders: 19, totalRevenue: 215000, status: 'active' },
  { id: 4, name: 'Orbit Ltd', contact: 'Noah Williams', email: 'noah@orbitltd.com', phone: '+61-555-0204', country: 'Australia', industry: 'Finance', orders: 6, totalRevenue: 51000, status: 'active' },
  { id: 5, name: 'Zenith Group', contact: 'Ava Martinez', email: 'ava@zenithgroup.com', phone: '+34-555-0205', country: 'Spain', industry: 'Manufacturing', orders: 14, totalRevenue: 163000, status: 'inactive' },
  { id: 6, name: 'Apex Solutions', contact: 'Ethan Kim', email: 'ethan@apex.com', phone: '+82-555-0206', country: 'South Korea', industry: 'Consulting', orders: 5, totalRevenue: 38000, status: 'active' },
]

function CustomerCard({ customer }) {
  return (
    <Card className="p-5 hover:border-surface-700 transition-all cursor-pointer">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-slate-100">{customer.name}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{customer.industry}</p>
        </div>
        <Badge color={customer.status === 'active' ? 'green' : 'default'}>{customer.status}</Badge>
      </div>
      <div className="space-y-1.5 text-xs text-slate-500 mb-4">
        <div className="flex items-center gap-1.5"><Mail className="w-3 h-3"/><span>{customer.email}</span></div>
        <div className="flex items-center gap-1.5"><Phone className="w-3 h-3"/><span>{customer.phone}</span></div>
        <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3"/><span>{customer.country}</span></div>
      </div>
      <div className="pt-3 border-t border-surface-800 grid grid-cols-2 gap-2 text-center">
        <div><p className="text-lg font-display font-bold text-slate-100">{customer.orders}</p><p className="text-xs text-slate-500">Orders</p></div>
        <div><p className="text-lg font-display font-bold text-emerald-400">${(customer.totalRevenue / 1000).toFixed(0)}K</p><p className="text-xs text-slate-500">Revenue</p></div>
      </div>
    </Card>
  )
}

export default function Customers() {
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const filtered = MOCK_CUSTOMERS.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.contact.toLowerCase().includes(search.toLowerCase()) ||
    c.industry.toLowerCase().includes(search.toLowerCase())
  )
  return (
    <div className="space-y-6">
      <PageHeader title="Customers" subtitle={`${filtered.length} customers`} breadcrumb="Sales / Customers"
        actions={<Button size="sm" onClick={() => setShowNew(true)}><Plus className="w-4 h-4"/>New Customer</Button>}
      />
      <div className="flex items-center gap-2 max-w-sm">
        <div className="flex items-center gap-2 flex-1 px-3 py-1.5 rounded-lg bg-surface-800 border border-surface-700">
          <Search className="w-3.5 h-3.5 text-slate-500"/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers..." className="bg-transparent text-sm text-slate-300 placeholder:text-slate-600 flex-1 outline-none"/>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(c => <CustomerCard key={c.id} customer={c}/>)}
      </div>
      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Customer" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><Input label="Company Name" placeholder="Company name"/></div>
            <Input label="Contact Person" placeholder="Full name"/>
            <Input label="Email" type="email" placeholder="email@company.com"/>
            <Input label="Phone" placeholder="+1-555-0000"/>
            <Input label="Country" placeholder="Country"/>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button className="flex-1" onClick={() => { alert('Customer created (demo)'); setShowNew(false) }}>Add Customer</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
