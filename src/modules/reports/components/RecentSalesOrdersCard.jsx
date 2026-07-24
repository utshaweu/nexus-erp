import {
  Card, CardHeader, CardTitle, CardContent, Table, Thead, Th, Tbody, Tr, Td, Badge, Spinner,
} from '@shared/components/ui'
import { SALES_ORDER_STATUS } from '@shared/lib/constants'
import { fmt } from '../api/reportHelpers'

export default function RecentSalesOrdersCard({ orders, loading }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Sales Orders</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 pb-2">
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner className="w-6 h-6" />
          </div>
        ) : orders.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">No sales orders found.</p>
        ) : (
          <Table>
            <Thead>
              <Th>Order #</Th>
              <Th>Customer</Th>
              <Th>Amount</Th>
              <Th>Status</Th>
            </Thead>
            <Tbody>
              {orders.map(ord => (
                <Tr key={ord.order_number}>
                  <Td>
                    <span className="font-mono text-xs font-medium text-blue-600 dark:text-blue-400
                                     bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 rounded">
                      {ord.order_number}
                    </span>
                  </Td>
                  <Td className="text-slate-700 dark:text-slate-300">{ord.customer?.name || '—'}</Td>
                  <Td>
                    <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                      ${fmt(ord.total_amount)}
                    </span>
                  </Td>
                  <Td>
                    <Badge color={SALES_ORDER_STATUS[ord.status]?.color || 'default'}>
                      {SALES_ORDER_STATUS[ord.status]?.label || ord.status}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
