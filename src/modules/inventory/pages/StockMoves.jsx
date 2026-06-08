import { useState } from 'react'
import { ArrowLeftRight, ArrowUp, ArrowDown } from 'lucide-react'
import { Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card } from '@shared/components/ui'

const MOVES = [
  { id:'SM-001', type:'incoming', product:'USB-C Cable', qty:100, from:'Vendor', to:'WH-Main', date:'2024-01-15', ref:'PO-2024-001' },
  { id:'SM-002', type:'outgoing', product:'Office Chair', qty:5, from:'WH-Main', to:'Customer', date:'2024-01-16', ref:'SO-2024-001' },
  { id:'SM-003', type:'internal', product:'Standing Desk', qty:10, from:'WH-Main', to:'WH-East', date:'2024-01-17', ref:'INT-001' },
  { id:'SM-004', type:'incoming', product:'Ergonomic Mouse', qty:50, from:'Vendor', to:'WH-Main', date:'2024-01-18', ref:'PO-2024-002' },
  { id:'SM-005', type:'outgoing', product:'Printer Paper', qty:20, from:'WH-Main', to:'Customer', date:'2024-01-19', ref:'SO-2024-003' },
]
const TYPE_CONFIG = { incoming:{ label:'Incoming', color:'green', Icon:ArrowDown }, outgoing:{ label:'Outgoing', color:'red', Icon:ArrowUp }, internal:{ label:'Internal', color:'blue', Icon:ArrowLeftRight }}
export default function StockMoves() {
  return (
    <div className="space-y-6">
      <PageHeader title="Stock Movements" subtitle="Track all inventory in/out/internal moves" breadcrumb="Inventory / Stock Moves"/>
      <Card>
        <Table>
          <Thead><Th>Move #</Th><Th>Type</Th><Th>Product</Th><Th>Qty</Th><Th>From</Th><Th>To</Th><Th>Date</Th><Th>Reference</Th></Thead>
          <Tbody>
            {MOVES.map(m => { const cfg = TYPE_CONFIG[m.type]; const Icon = cfg.Icon; return (
              <Tr key={m.id}>
                <Td><span className="font-mono text-xs text-blue-400">{m.id}</span></Td>
                <Td><Badge color={cfg.color}><Icon className="w-3 h-3 inline mr-1"/>{cfg.label}</Badge></Td>
                <Td><span className="font-medium text-slate-200">{m.product}</span></Td>
                <Td><span className="font-semibold">{m.qty}</span></Td>
                <Td><span className="text-slate-400">{m.from}</span></Td>
                <Td><span className="text-slate-400">{m.to}</span></Td>
                <Td><span className="text-slate-500">{m.date}</span></Td>
                <Td><span className="font-mono text-xs text-slate-500">{m.ref}</span></Td>
              </Tr>
            )})}
          </Tbody>
        </Table>
      </Card>
    </div>
  )
}
