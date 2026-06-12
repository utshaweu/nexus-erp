import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Download, Eye } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td,
  PageHeader, Card, Modal, Input, Select,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import toast from '@shared/lib/toast'

const MOCK_ORDERS = [
  { id:'PO-2024-001', vendor:'Acme Supplies',    amount:12500, status:'approved', date:'2024-01-15', reference:'REF-001' },
  { id:'PO-2024-002', vendor:'TechParts Ltd',    amount: 8900, status:'pending',  date:'2024-01-16', reference:'REF-002' },
  { id:'PO-2024-003', vendor:'Global Materials', amount:34200, status:'draft',    date:'2024-01-17', reference:'REF-003' },
  { id:'PO-2024-004', vendor:'FastShip Co',      amount: 6750, status:'received', date:'2024-01-18', reference:'REF-004' },
  { id:'PO-2024-005', vendor:'Acme Supplies',    amount:15000, status:'approved', date:'2024-01-19', reference:'REF-005' },
]

const STATUS = {
  draft:     { label:'Draft',     color:'default' },
  pending:   { label:'Pending',   color:'yellow'  },
  approved:  { label:'Approved',  color:'green'   },
  received:  { label:'Received',  color:'blue'    },
  cancelled: { label:'Cancelled', color:'red'     },
}

const orderSchema = z.object({
  vendor:    z.string().min(1, 'Vendor is required'),
  reference: z.string().trim().min(1, 'Reference is required'),
  date:      z.string().min(1, 'Order date is required'),
})

function NewOrderModal({ open, onClose }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(orderSchema),
    defaultValues: { vendor: '', reference: '', date: '' },
  })

  const onSubmit = async () => {
    toast.success('Purchase order created.')
    reset()
    onClose()
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title="New Purchase Order" size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          <div>
            <Select label="Vendor" {...register('vendor')}>
              <option value="">Select vendor…</option>
              <option>Acme Supplies</option>
              <option>TechParts Ltd</option>
              <option>Global Materials</option>
            </Select>
            {errors.vendor && <p className="mt-1 text-xs text-red-400">{errors.vendor.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Reference" placeholder="REF-000"
              error={errors.reference?.message}
              {...register('reference')} />
            <Input label="Order Date" type="date"
              error={errors.date?.message}
              {...register('date')} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>Cancel</Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>Create Order</Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

export default function PurchaseOrders() {
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState('all')
  const [showNew, setShowNew]     = useState(false)

  const filtered = MOCK_ORDERS.filter(o => {
    const matchSearch = o.id.toLowerCase().includes(search.toLowerCase()) ||
                        o.vendor.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || o.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        subtitle={`${filtered.length} orders`}
        breadcrumb="Purchase / Orders"
        actions={
          <PermissionGate action="create" moduleId="purchase">
            <Button size="sm" onClick={() => setShowNew(true)}>
              <Plus className="w-4 h-4" />New Order
            </Button>
          </PermissionGate>
        }
      />

      <Card>
        <div className="flex items-center gap-3 p-4 border-b border-surface-800 flex-wrap">
          <div className="flex items-center gap-2 max-w-xs px-3 py-1.5 rounded-lg
                          bg-surface-800 border border-surface-700">
            <Search className="w-3.5 h-3.5 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search orders, vendors…"
              className="bg-transparent text-sm text-slate-300 placeholder:text-slate-600 flex-1 outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {['all','draft','pending','approved','received'].map(s => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  statusFilter === s
                    ? 'bg-brand-600/20 text-brand-300 border border-brand-600/30'
                    : 'text-slate-500 hover:text-slate-200'
                }`}
              >
                {s === 'all' ? 'All' : STATUS[s]?.label}
              </button>
            ))}
          </div>

          <PermissionGate action="export" moduleId="purchase">
            <Button variant="secondary" size="sm" className="ml-auto">
              <Download className="w-3.5 h-3.5" />Export
            </Button>
          </PermissionGate>
        </div>

        <Table>
          <Thead>
            <Th>Order #</Th><Th>Vendor</Th><Th>Reference</Th>
            <Th>Date</Th><Th>Amount</Th><Th>Status</Th>
            <Th></Th>
          </Thead>
          <Tbody>
            {filtered.map(order => {
              const s = STATUS[order.status]
              return (
                <Tr key={order.id}>
                  <Td><span className="font-mono text-xs text-brand-400">{order.id}</span></Td>
                  <Td><span className="font-medium text-slate-200">{order.vendor}</span></Td>
                  <Td><span className="font-mono text-xs text-slate-500">{order.reference}</span></Td>
                  <Td><span className="text-slate-500">{order.date}</span></Td>
                  <Td><span className="font-semibold">${order.amount.toLocaleString()}</span></Td>
                  <Td><Badge color={s.color}>{s.label}</Badge></Td>
                  <Td>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="xs"><Eye className="w-3.5 h-3.5" /></Button>
                      <PermissionGate action="edit" moduleId="purchase">
                        <Button variant="ghost" size="xs">Edit</Button>
                      </PermissionGate>
                      <PermissionGate action="approve" moduleId="purchase">
                        {order.status === 'pending' && (
                          <Button variant="ghost" size="xs">Approve</Button>
                        )}
                      </PermissionGate>
                      <PermissionGate action="delete" moduleId="purchase">
                        <Button variant="danger" size="xs">Del</Button>
                      </PermissionGate>
                    </div>
                  </Td>
                </Tr>
              )
            })}
          </Tbody>
        </Table>

        {filtered.length === 0 && (
          <div className="py-12 text-center text-slate-500 text-sm">No orders found.</div>
        )}
      </Card>

      <NewOrderModal open={showNew} onClose={() => setShowNew(false)} />
    </div>
  )
}
