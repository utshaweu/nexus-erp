import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card, Modal, Input } from '@shared/components/ui'

const PRODUCTS = [
  { id:'P-001', name:'USB-C Cable', sku:'SKU-001', category:'Electronics', stock:12, price:15.99, status:'low_stock' },
  { id:'P-002', name:'Ergonomic Mouse', sku:'SKU-002', category:'Electronics', stock:5, price:49.99, status:'low_stock' },
  { id:'P-003', name:'Office Chair', sku:'SKU-003', category:'Furniture', stock:45, price:349.99, status:'in_stock' },
  { id:'P-004', name:'Standing Desk', sku:'SKU-004', category:'Furniture', stock:18, price:849.99, status:'in_stock' },
  { id:'P-005', name:'Printer Paper (500)', sku:'SKU-005', category:'Supplies', stock:220, price:8.99, status:'in_stock' },
  { id:'P-006', name:'HDMI Adapter', sku:'SKU-006', category:'Electronics', stock:8, price:24.99, status:'low_stock' },
]
const STATUS = { in_stock:{ label:'In Stock', color:'green' }, low_stock:{ label:'Low Stock', color:'yellow' }, out_of_stock:{ label:'Out of Stock', color:'red' }}
export default function Products() {
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const filtered = PRODUCTS.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()))
  return (
    <div className="space-y-6">
      <PageHeader title="Products" subtitle={`${filtered.length} products`} breadcrumb="Inventory / Products"
        actions={<Button size="sm" onClick={() => setShowNew(true)}><Plus className="w-4 h-4"/>Add Product</Button>}/>
      <Card>
        <div className="flex items-center gap-3 p-4 border-b border-surface-800">
          <div className="flex items-center gap-2 max-w-xs px-3 py-1.5 rounded-lg bg-surface-800 border border-surface-700">
            <Search className="w-3.5 h-3.5 text-slate-500"/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." className="bg-transparent text-sm text-slate-300 placeholder:text-slate-600 flex-1 outline-none"/>
          </div>
        </div>
        <Table>
          <Thead><Th>SKU</Th><Th>Product Name</Th><Th>Category</Th><Th>Stock</Th><Th>Unit Price</Th><Th>Status</Th></Thead>
          <Tbody>
            {filtered.map(p => (<Tr key={p.id}>
              <Td><span className="font-mono text-xs text-blue-400">{p.sku}</span></Td>
              <Td><span className="font-medium text-slate-200">{p.name}</span></Td>
              <Td><span className="text-slate-400">{p.category}</span></Td>
              <Td><span className={p.stock < 20 ? 'text-amber-400 font-semibold' : 'text-slate-300'}>{p.stock}</span></Td>
              <Td><span className="font-semibold">${p.price}</span></Td>
              <Td><Badge color={STATUS[p.status].color}>{STATUS[p.status].label}</Badge></Td>
            </Tr>))}
          </Tbody>
        </Table>
      </Card>
      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Product" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><Input label="Product Name" placeholder="Name"/></div>
            <Input label="SKU" placeholder="SKU-000"/>
            <Input label="Unit Price" type="number" placeholder="0.00"/>
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide block mb-1.5">Category</label>
              <select className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 bg-surface-900 border border-surface-700 focus:outline-none focus:ring-1 focus:ring-brand-500">
                <option>Electronics</option><option>Furniture</option><option>Supplies</option><option>Parts</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button className="flex-1" onClick={() => { alert('Product created (demo)'); setShowNew(false) }}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
