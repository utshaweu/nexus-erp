import { useState } from 'react'
import { Plus, Search, Send } from 'lucide-react'
import { Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card, Modal, Input } from '@shared/components/ui'

const MOCK_QUOTATIONS = [
  { id: 'Q-2024-001', customer: 'Bright Corp', amount: 18500, status: 'sent', date: '2024-01-14', expiry: '2024-01-28', salesperson: 'Alice Wang' },
  { id: 'Q-2024-002', customer: 'Nova Retail', amount: 9200, status: 'draft', date: '2024-01-15', expiry: '2024-01-29', salesperson: 'Bob Chen' },
  { id: 'Q-2024-003', customer: 'Summit Tech', amount: 42000, status: 'accepted', date: '2024-01-12', expiry: '2024-01-26', salesperson: 'Alice Wang' },
  { id: 'Q-2024-004', customer: 'Orbit Ltd', amount: 7100, status: 'expired', date: '2024-01-05', expiry: '2024-01-12', salesperson: 'Carlos M.' },
  { id: 'Q-2024-005', customer: 'Zenith Group', amount: 31500, status: 'sent', date: '2024-01-18', expiry: '2024-02-01', salesperson: 'Bob Chen' },
]

const STATUS = {
  draft: { label: 'Draft', color: 'default' },
  sent: { label: 'Sent', color: 'blue' },
  accepted: { label: 'Accepted', color: 'green' },
  expired: { label: 'Expired', color: 'red' },
  cancelled: { label: 'Cancelled', color: 'red' },
}

export default function Quotations() {
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)

  const filtered = MOCK_QUOTATIONS.filter(q =>
    q.id.toLowerCase().includes(search.toLowerCase()) ||
    q.customer.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Quotations" subtitle={`${filtered.length} quotations`} breadcrumb="Sales / Quotations"
        actions={<Button size="sm" onClick={() => setShowNew(true)}><Plus className="w-4 h-4"/>New Quotation</Button>}
      />
      <Card>
        <div className="flex items-center gap-3 p-4 border-b border-surface-800">
          <div className="flex items-center gap-2 max-w-xs px-3 py-1.5 rounded-lg bg-surface-800 border border-surface-700">
            <Search className="w-3.5 h-3.5 text-slate-500"/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search quotations..." className="bg-transparent text-sm text-slate-300 placeholder:text-slate-600 flex-1 outline-none"/>
          </div>
        </div>
        <Table>
          <Thead><Th>Quotation #</Th><Th>Customer</Th><Th>Date</Th><Th>Expiry</Th><Th>Salesperson</Th><Th>Amount</Th><Th>Status</Th><Th></Th></Thead>
          <Tbody>
            {filtered.map(q => {
              const s = STATUS[q.status]
              return (
                <Tr key={q.id}>
                  <Td><span className="font-mono text-xs text-emerald-400">{q.id}</span></Td>
                  <Td><span className="font-medium text-slate-200">{q.customer}</span></Td>
                  <Td><span className="text-slate-500">{q.date}</span></Td>
                  <Td><span className="text-slate-500">{q.expiry}</span></Td>
                  <Td><span className="text-slate-400 text-sm">{q.salesperson}</span></Td>
                  <Td><span className="font-semibold">${q.amount.toLocaleString()}</span></Td>
                  <Td><Badge color={s.color}>{s.label}</Badge></Td>
                  <Td>{q.status === 'draft' && <Button variant="ghost" size="xs"><Send className="w-3.5 h-3.5"/></Button>}</Td>
                </Tr>
              )
            })}
          </Tbody>
        </Table>
      </Card>
      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Quotation" size="md">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide block mb-1.5">Customer</label>
            <select className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 bg-surface-900 border border-surface-700 focus:outline-none focus:ring-1 focus:ring-brand-500">
              <option value="">Select customer...</option>
              <option>Bright Corp</option><option>Nova Retail</option><option>Summit Tech</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Expiry Date" type="date"/>
            <Input label="Salesperson" placeholder="Name"/>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button className="flex-1" onClick={() => { alert('Quotation created (demo)'); setShowNew(false) }}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
