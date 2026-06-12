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
  { id:'SO-2024-001', customer:'Bright Corp', amount:18500, status:'confirmed', date:'2024-01-15', salesperson:'Alice Wang' },
  { id:'SO-2024-002', customer:'Nova Retail',  amount: 9200, status:'draft',     date:'2024-01-16', salesperson:'Bob Chen'   },
  { id:'SO-2024-003', customer:'Summit Tech',  amount:42000, status:'invoiced',  date:'2024-01-17', salesperson:'Alice Wang' },
  { id:'SO-2024-004', customer:'Orbit Ltd',    amount: 7100, status:'confirmed', date:'2024-01-18', salesperson:'Carlos M.'  },
  { id:'SO-2024-005', customer:'Zenith Group', amount:31500, status:'done',      date:'2024-01-19', salesperson:'Bob Chen'   },
]

const STATUS = {
  draft:     { label:'Draft',     color:'default'  },
  confirmed: { label:'Confirmed', color:'blue'     },
  invoiced:  { label:'Invoiced',  color:'purple'   },
  done:      { label:'Done',      color:'green'    },
  cancelled: { label:'Cancelled', color:'red'      },
}

const orderSchema = z.object({
  customer:   z.string().min(1, 'Customer is required'),
  date:       z.string().min(1, 'Order date is required'),
  salesperson: z.string().trim().optional(),
})

function NewSalesOrderModal({ open, onClose }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(orderSchema),
    defaultValues: { customer: '', date: '', salesperson: '' },
  })

  const onSubmit = async () => {
    toast.success('Sales order created.')
    reset()
    onClose()
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title="New Sales Order" size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          <div>
            <Select label="Customer" {...register('customer')}>
              <option value="">Select customer…</option>
              <option>Bright Corp</option>
              <option>Nova Retail</option>
              <option>Summit Tech</option>
            </Select>
            {errors.customer && <p className="mt-1 text-xs text-red-400">{errors.customer.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Order Date" type="date"
              error={errors.date?.message}
              {...register('date')} />
            <Input label="Salesperson" placeholder="Name"
              {...register('salesperson')} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>Cancel</Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>Create</Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

export default function SalesOrders() {
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState('all')
  const [showNew, setShowNew]     = useState(false)

  const filtered = MOCK_ORDERS.filter(o => {
    const matchSearch = o.id.toLowerCase().includes(search.toLowerCase()) ||
                        o.customer.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || o.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Orders"
        subtitle={`${filtered.length} orders`}
        breadcrumb="Sales / Orders"
        actions={
          <PermissionGate action="create" moduleId="sales">
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
              placeholder="Search orders…"
              className="bg-transparent text-sm text-slate-300 placeholder:text-slate-600 flex-1 outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {['all','draft','confirmed','invoiced','done'].map(s => (
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

          <PermissionGate action="export" moduleId="sales">
            <Button variant="secondary" size="sm" className="ml-auto">
              <Download className="w-3.5 h-3.5" />Export
            </Button>
          </PermissionGate>
        </div>

        <Table>
          <Thead>
            <Th>Order #</Th><Th>Customer</Th><Th>Date</Th>
            <Th>Salesperson</Th><Th>Amount</Th><Th>Status</Th><Th></Th>
          </Thead>
          <Tbody>
            {filtered.map(order => {
              const s = STATUS[order.status]
              return (
                <Tr key={order.id}>
                  <Td><span className="font-mono text-xs text-emerald-400">{order.id}</span></Td>
                  <Td><span className="font-medium text-slate-200">{order.customer}</span></Td>
                  <Td><span className="text-slate-500">{order.date}</span></Td>
                  <Td><span className="text-slate-400 text-xs">{order.salesperson}</span></Td>
                  <Td><span className="font-semibold">${order.amount.toLocaleString()}</span></Td>
                  <Td><Badge color={s.color}>{s.label}</Badge></Td>
                  <Td>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="xs"><Eye className="w-3.5 h-3.5" /></Button>
                      <PermissionGate action="edit" moduleId="sales">
                        <Button variant="ghost" size="xs">Edit</Button>
                      </PermissionGate>
                      <PermissionGate action="approve" moduleId="sales">
                        {order.status === 'draft' && (
                          <Button variant="ghost" size="xs">Confirm</Button>
                        )}
                      </PermissionGate>
                      <PermissionGate action="delete" moduleId="sales">
                        <Button variant="danger" size="xs">Del</Button>
                      </PermissionGate>
                    </div>
                  </Td>
                </Tr>
              )
            })}
          </Tbody>
        </Table>
      </Card>

      <NewSalesOrderModal open={showNew} onClose={() => setShowNew(false)} />
    </div>
  )
}
