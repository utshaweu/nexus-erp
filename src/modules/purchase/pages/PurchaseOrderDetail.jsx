import { useParams } from 'react-router-dom'
import { PageHeader, Badge, Card, CardContent, Button, Table, Thead, Th, Tbody, Tr, Td } from '@shared/components/ui'
import { CheckCircle, XCircle, Printer, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function PurchaseOrderDetail() {
  const { id } = useParams()

  const order = {
    id: id || 'PO-2024-001',
    vendor: 'Acme Supplies',
    status: 'pending',
    date: '2024-01-15',
    expectedDate: '2024-01-25',
    reference: 'REF-001',
    notes: 'Urgent delivery required.',
    items: [
      { name: 'Office Chair', qty: 10, unitPrice: 350, tax: 10 },
      { name: 'Standing Desk', qty: 5, unitPrice: 850, tax: 10 },
      { name: 'Monitor Stand', qty: 8, unitPrice: 120, tax: 10 },
    ]
  }

  const subtotal = order.items.reduce((s, i) => s + i.qty * i.unitPrice, 0)
  const tax = order.items.reduce((s, i) => s + i.qty * i.unitPrice * i.tax / 100, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title={order.id}
        subtitle={`Vendor: ${order.vendor}`}
        breadcrumb="Purchase / Orders"
        actions={
          <div className="flex items-center gap-2">
            <Link to="/purchase/orders">
              <Button variant="secondary" size="sm"><ArrowLeft className="w-4 h-4" />Back</Button>
            </Link>
            <Button variant="success" size="sm"><CheckCircle className="w-4 h-4" />Approve</Button>
            <Button variant="danger" size="sm"><XCircle className="w-4 h-4" />Reject</Button>
            <Button variant="outline" size="sm"><Printer className="w-4 h-4" />Print</Button>
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-4">Order Lines</h3>
              <Table>
                <Thead>
                  <Th>Product</Th>
                  <Th>Qty</Th>
                  <Th>Unit Price</Th>
                  <Th>Tax %</Th>
                  <Th>Total</Th>
                </Thead>
                <Tbody>
                  {order.items.map((item, i) => (
                    <Tr key={i}>
                      <Td><span className="font-medium">{item.name}</span></Td>
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
                <div className="flex justify-between text-slate-400"><span>Tax (10%)</span><span>${tax.toLocaleString()}</span></div>
                <div className="flex justify-between font-bold text-slate-100 text-base pt-2 border-t border-surface-800 mt-2">
                  <span>Total</span><span>${(subtotal + tax).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">Order Info</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <Badge color="yellow">Pending</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Order Date</span>
                <span className="text-slate-300">{order.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Expected</span>
                <span className="text-slate-300">{order.expectedDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Reference</span>
                <span className="font-mono text-xs text-slate-300">{order.reference}</span>
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Notes</h3>
            <p className="text-sm text-slate-400">{order.notes}</p>
          </Card>
        </div>
      </div>
    </div>
  )
}
