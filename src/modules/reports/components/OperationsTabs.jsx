import { Table, Thead, Th, Tbody, Tr, Td, Badge, Spinner } from '@shared/components/ui'
import { AlertTriangle } from 'lucide-react'
import { SALES_ORDER_STATUS, PURCHASE_ORDER_STATUS } from '@shared/lib/constants'
import { fmt } from '../api/reportHelpers'

export function SalesTab({ data }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-500 py-10 text-center">No sales orders found for the selected period.</p>
  }

  const totalAmount = data.reduce((s, r) => s + Number(r.total_amount || 0), 0)

  const byStatus = Object.entries(SALES_ORDER_STATUS).map(([key, cfg]) => ({
    status: key,
    label:  cfg.label,
    color:  cfg.color,
    count:  data.filter(r => r.status === key).length,
    amount: data.filter(r => r.status === key).reduce((s, r) => s + Number(r.total_amount || 0), 0),
  })).filter(s => s.count > 0)

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        {byStatus.map(s => (
          <div key={s.status} className="rounded-xl border border-surface-200 dark:border-surface-700 p-3">
            <div className="flex items-center justify-between mb-1">
              <Badge color={s.color}>{s.label}</Badge>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{s.count}</span>
            </div>
            <p className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">${fmt(s.amount)}</p>
          </div>
        ))}
      </div>

      <Table>
        <Thead>
          <Th>Order #</Th>
          <Th>Customer</Th>
          <Th>Order Date</Th>
          <Th>Status</Th>
          <Th className="text-right">Total</Th>
        </Thead>
        <Tbody>
          {data.map(r => (
            <Tr key={r.order_number}>
              <Td>
                <span className="font-mono text-xs font-medium text-blue-600 dark:text-blue-400
                                 bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 rounded">
                  {r.order_number}
                </span>
              </Td>
              <Td className="font-medium text-slate-900 dark:text-slate-100">{r.customer?.name || '—'}</Td>
              <Td><span className="text-sm text-slate-500">{r.order_date}</span></Td>
              <Td>
                <Badge color={SALES_ORDER_STATUS[r.status]?.color || 'default'}>
                  {SALES_ORDER_STATUS[r.status]?.label || r.status}
                </Badge>
              </Td>
              <Td className="text-right">
                <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                  ${fmt(r.total_amount)}
                </span>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <div className="flex justify-end mt-4">
        <div className="w-60 rounded-xl bg-slate-50 dark:bg-surface-800 p-3 flex justify-between items-center">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Total ({data.length} orders)</span>
          <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">${fmt(totalAmount)}</span>
        </div>
      </div>
    </>
  )
}

export function PurchasesTab({ data }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-500 py-10 text-center">No purchase orders found for the selected period.</p>
  }

  const totalAmount = data.reduce((s, r) => s + Number(r.total_amount || 0), 0)

  const byStatus = Object.entries(PURCHASE_ORDER_STATUS).map(([key, cfg]) => ({
    status: key,
    label:  cfg.label,
    color:  cfg.color,
    count:  data.filter(r => r.status === key).length,
    amount: data.filter(r => r.status === key).reduce((s, r) => s + Number(r.total_amount || 0), 0),
  })).filter(s => s.count > 0)

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        {byStatus.map(s => (
          <div key={s.status} className="rounded-xl border border-surface-200 dark:border-surface-700 p-3">
            <div className="flex items-center justify-between mb-1">
              <Badge color={s.color}>{s.label}</Badge>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{s.count}</span>
            </div>
            <p className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">${fmt(s.amount)}</p>
          </div>
        ))}
      </div>

      <Table>
        <Thead>
          <Th>Order #</Th>
          <Th>Vendor</Th>
          <Th>Order Date</Th>
          <Th>Status</Th>
          <Th className="text-right">Total</Th>
        </Thead>
        <Tbody>
          {data.map(r => (
            <Tr key={r.order_number}>
              <Td>
                <span className="font-mono text-xs font-medium text-indigo-600 dark:text-indigo-400
                                 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded">
                  {r.order_number}
                </span>
              </Td>
              <Td className="font-medium text-slate-900 dark:text-slate-100">{r.vendor?.name || '—'}</Td>
              <Td><span className="text-sm text-slate-500">{r.order_date}</span></Td>
              <Td>
                <Badge color={PURCHASE_ORDER_STATUS[r.status]?.color || 'default'}>
                  {PURCHASE_ORDER_STATUS[r.status]?.label || r.status}
                </Badge>
              </Td>
              <Td className="text-right">
                <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                  ${fmt(r.total_amount)}
                </span>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <div className="flex justify-end mt-4">
        <div className="w-60 rounded-xl bg-slate-50 dark:bg-surface-800 p-3 flex justify-between items-center">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Total ({data.length} orders)</span>
          <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">${fmt(totalAmount)}</span>
        </div>
      </div>
    </>
  )
}

export function InventoryTab({ data, loading }) {
  if (loading) {
    return <div className="flex justify-center py-10"><Spinner className="w-6 h-6" /></div>
  }
  if (data.length === 0) {
    return <p className="text-sm text-slate-500 py-10 text-center">No stock movements recorded yet.</p>
  }

  return (
    <Table>
      <Thead>
        <Th>SKU</Th>
        <Th>Product</Th>
        <Th>Warehouse</Th>
        <Th>UOM</Th>
        <Th className="text-right">Qty on Hand</Th>
        <Th className="text-right">Reorder Qty</Th>
        <Th>Status</Th>
      </Thead>
      <Tbody>
        {data.map((r, i) => {
          const isLow = Number(r.reorder_qty || 0) > 0 && Number(r.qty_on_hand) <= Number(r.reorder_qty)
          return (
            <Tr key={i}>
              <Td><span className="font-mono text-xs text-slate-500">{r.sku}</span></Td>
              <Td className="font-medium text-slate-900 dark:text-slate-100">{r.product_name}</Td>
              <Td><span className="text-sm text-slate-500">{r.warehouse_name}</span></Td>
              <Td><span className="text-xs text-slate-500">{r.unit_of_measure}</span></Td>
              <Td className="text-right">
                <span className={`font-mono text-sm font-semibold ${isLow ? 'text-red-500' : 'text-slate-900 dark:text-slate-100'}`}>
                  {Number(r.qty_on_hand).toLocaleString()}
                </span>
              </Td>
              <Td className="text-right">
                <span className="font-mono text-sm text-slate-500">
                  {Number(r.reorder_qty || 0).toLocaleString()}
                </span>
              </Td>
              <Td>
                {isLow
                  ? <Badge color="red"><AlertTriangle className="w-3 h-3 inline mr-1" />Low Stock</Badge>
                  : <Badge color="green">OK</Badge>
                }
              </Td>
            </Tr>
          )
        })}
      </Tbody>
    </Table>
  )
}
