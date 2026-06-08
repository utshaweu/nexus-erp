import { useState } from 'react'
import { Plus, Search, Send, Eye } from 'lucide-react'
import { Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card, Modal, Input } from '@shared/components/ui'

const MOCK_RFQS = [
  { id: 'RFQ-2024-001', vendor: 'Acme Supplies', amount: 0, status: 'draft', date: '2024-01-14', deadline: '2024-01-21' },
  { id: 'RFQ-2024-002', vendor: 'TechParts Ltd', amount: 8900, status: 'sent', date: '2024-01-15', deadline: '2024-01-22' },
  { id: 'RFQ-2024-003', vendor: 'Global Materials', amount: 34200, status: 'received', date: '2024-01-12', deadline: '2024-01-19' },
  { id: 'RFQ-2024-004', vendor: 'Prime Vendors', amount: 0, status: 'expired', date: '2024-01-05', deadline: '2024-01-12' },
  { id: 'RFQ-2024-005', vendor: 'FastShip Co', amount: 6750, status: 'converted', date: '2024-01-10', deadline: '2024-01-17' },
]

const STATUS = {
  draft: { label: 'Draft', color: 'default' },
  sent: { label: 'Sent', color: 'blue' },
  received: { label: 'Received', color: 'green' },
  expired: { label: 'Expired', color: 'red' },
  converted: { label: 'Converted to PO', color: 'purple' },
}

function NewRFQModal({ open, onClose }) {
  const [form, setForm] = useState({ vendor: '', deadline: '', notes: '' })
  return (
    <Modal open={open} onClose={onClose} title="New Request for Quotation" size="md">
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wide block mb-1.5">Vendor</label>
          <select
            className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 bg-surface-900 border border-surface-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
            value={form.vendor}
            onChange={e => setForm({ ...form, vendor: e.target.value })}
          >
            <option value="">Select vendor...</option>
            <option>Acme Supplies</option>
            <option>TechParts Ltd</option>
            <option>Global Materials</option>
            <option>FastShip Co</option>
          </select>
        </div>
        <Input label="Quotation Deadline" type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} />
        <div>
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wide block mb-1.5">Notes</label>
          <textarea
            rows={3}
            className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 bg-surface-900 border border-surface-700 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
            placeholder="Requirements, specs..."
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={() => { alert('RFQ created (demo)'); onClose() }}>Create RFQ</Button>
        </div>
      </div>
    </Modal>
  )
}

export default function RFQ() {
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)

  const filtered = MOCK_RFQS.filter(r =>
    r.id.toLowerCase().includes(search.toLowerCase()) ||
    r.vendor.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Request for Quotations"
        subtitle="Send RFQs to vendors and convert to purchase orders"
        breadcrumb="Purchase / RFQ"
        actions={
          <Button size="sm" onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4" /> New RFQ
          </Button>
        }
      />

      <Card>
        <div className="flex items-center gap-3 p-4 border-b border-surface-800">
          <div className="flex items-center gap-2 max-w-xs px-3 py-1.5 rounded-lg bg-surface-800 border border-surface-700">
            <Search className="w-3.5 h-3.5 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search RFQs..."
              className="bg-transparent text-sm text-slate-300 placeholder:text-slate-600 flex-1 outline-none"
            />
          </div>
        </div>

        <Table>
          <Thead>
            <Th>RFQ #</Th>
            <Th>Vendor</Th>
            <Th>Date</Th>
            <Th>Deadline</Th>
            <Th>Amount</Th>
            <Th>Status</Th>
            <Th></Th>
          </Thead>
          <Tbody>
            {filtered.map(rfq => {
              const s = STATUS[rfq.status]
              return (
                <Tr key={rfq.id}>
                  <Td><span className="font-mono text-xs text-brand-400">{rfq.id}</span></Td>
                  <Td><span className="font-medium text-slate-200">{rfq.vendor}</span></Td>
                  <Td><span className="text-slate-500">{rfq.date}</span></Td>
                  <Td><span className="text-slate-500">{rfq.deadline}</span></Td>
                  <Td>
                    {rfq.amount > 0
                      ? <span className="font-semibold">${rfq.amount.toLocaleString()}</span>
                      : <span className="text-slate-600">—</span>
                    }
                  </Td>
                  <Td><Badge color={s.color}>{s.label}</Badge></Td>
                  <Td>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="xs"><Eye className="w-3.5 h-3.5" /></Button>
                      {rfq.status === 'draft' && (
                        <Button variant="ghost" size="xs"><Send className="w-3.5 h-3.5" /></Button>
                      )}
                    </div>
                  </Td>
                </Tr>
              )
            })}
          </Tbody>
        </Table>
      </Card>

      <NewRFQModal open={showNew} onClose={() => setShowNew(false)} />
    </div>
  )
}
