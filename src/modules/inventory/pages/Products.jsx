import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search } from 'lucide-react'
import { Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card, Modal, Input, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'

const PRODUCTS = [
  { id:'P-001', name:'USB-C Cable', sku:'SKU-001', category:'Electronics', stock:12, price:15.99, status:'low_stock' },
  { id:'P-002', name:'Ergonomic Mouse', sku:'SKU-002', category:'Electronics', stock:5, price:49.99, status:'low_stock' },
  { id:'P-003', name:'Office Chair', sku:'SKU-003', category:'Furniture', stock:45, price:349.99, status:'in_stock' },
  { id:'P-004', name:'Standing Desk', sku:'SKU-004', category:'Furniture', stock:18, price:849.99, status:'in_stock' },
  { id:'P-005', name:'Printer Paper (500)', sku:'SKU-005', category:'Supplies', stock:220, price:8.99, status:'in_stock' },
  { id:'P-006', name:'HDMI Adapter', sku:'SKU-006', category:'Electronics', stock:8, price:24.99, status:'low_stock' },
]
const STATUS = { in_stock:{ label:'In Stock', color:'green' }, low_stock:{ label:'Low Stock', color:'yellow' }, out_of_stock:{ label:'Out of Stock', color:'red' }}

const productSchema = z.object({
  name:     z.string().trim().min(1, 'Product name is required'),
  sku:      z.string().trim().min(1, 'SKU is required'),
  price:    z.coerce.number({ invalid_type_error: 'Enter a valid price' }).positive('Price must be greater than 0'),
  category: z.string().min(1, 'Category is required'),
})

function NewProductModal({ open, onClose }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: { name: '', sku: '', price: '', category: '' },
  })

  const onSubmit = async () => {
    toast.success('Product created.')
    reset()
    onClose()
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title="New Product" size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input label="Product Name" placeholder="Name"
                error={errors.name?.message}
                {...register('name')} />
            </div>
            <Input label="SKU" placeholder="SKU-000"
              error={errors.sku?.message}
              {...register('sku')} />
            <Input label="Unit Price" type="number" placeholder="0.00" step="0.01"
              error={errors.price?.message}
              {...register('price')} />
            <div className="col-span-2">
              <Select label="Category" {...register('category')}>
                <option value="">Select category...</option>
                <option>Electronics</option>
                <option>Furniture</option>
                <option>Supplies</option>
                <option>Parts</option>
              </Select>
              {errors.category && <p className="mt-1 text-xs text-red-400">{errors.category.message}</p>}
            </div>
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
      <NewProductModal open={showNew} onClose={() => setShowNew(false)} />
    </div>
  )
}
