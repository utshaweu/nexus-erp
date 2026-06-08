import { useParams, Link } from 'react-router-dom'
import { PageHeader, Badge, Card, Button, Table, Thead, Th, Tbody, Tr, Td } from '@shared/components/ui'
import { ArrowLeft, CheckCircle, Printer, FileText } from 'lucide-react'

export default function SalesOrderDetail() {
  const { id } = useParams()
  const order = { id: id || 'SO-2024-001', customer: 'Bright Corp', status: 'confirmed', date: '2024-01-15', salesperson: 'Alice Wang', items: [
    { product: 'Enterprise License', qty: 5, unitPrice: 2000, tax: 15 },
    { product: 'Support Package', qty: 1, unitPrice: 5000, tax: 15 },
    { product: 'Training Sessions', qty: 3, unitPrice: 1500, tax: 15 },
  ]}
  const subtotal = order.items.reduce((s, i) => s + i.qty * i.unitPrice, 0)
  const tax = subtotal * 0.15
  return (
    <div className="space-y-6">
      <PageHeader title={order.id} subtitle={`Customer: ${order.customer}`} breadcrumb="Sales / Orders"
        actions={<div className="flex gap-2">
          <Link to="/sales/orders"><Button variant="secondary" size="sm"><ArrowLeft className="w-4 h-4"/>Back</Button></Link>
          <Button variant="success" size="sm"><CheckCircle className="w-4 h-4"/>Confirm</Button>
          <Button variant="outline" size="sm"><FileText className="w-4 h-4"/>Invoice</Button>
          <Button variant="outline" size="sm"><Printer className="w-4 h-4"/>Print</Button>
        </div>}
      />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">Order Lines</h3>
            <Table>
              <Thead><Th>Product</Th><Th>Qty</Th><Th>Unit Price</Th><Th>Tax</Th><Th>Total</Th></Thead>
              <Tbody>
                {order.items.map((item, i) => (
                  <Tr key={i}>
                    <Td><span className="font-medium">{item.product}</span></Td>
                    <Td>{item.qty}</Td>
                    <Td>${item.unitPrice.toLocaleString()}</Td>
                    <Td>{item.tax}%</Td>
                    <Td className="font-semibold">${(item.qty * item.unitPrice).toLocaleString()}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
            <div className="mt-4 pt-4 border-t border-surface-800 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-400"><span>Subtotal</span><span>${subtotal.toLocaleString()}</span></div>
              <div className="flex justify-between text-slate-400"><span>Tax (15%)</span><span>${tax.toLocaleString()}</span></div>
              <div className="flex justify-between font-bold text-slate-100 text-base pt-2 border-t border-surface-800 mt-2">
                <span>Total</span><span>${(subtotal + tax).toLocaleString()}</span>
              </div>
            </div>
          </Card>
        </div>
        <Card className="p-5 h-fit">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Order Info</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Status</span><Badge color="blue">Confirmed</Badge></div>
            <div className="flex justify-between"><span className="text-slate-500">Date</span><span className="text-slate-300">{order.date}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Salesperson</span><span className="text-slate-300">{order.salesperson}</span></div>
          </div>
        </Card>
      </div>
    </div>
  )
}
