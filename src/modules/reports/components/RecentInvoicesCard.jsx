import {
  Card, CardHeader, CardTitle, CardContent, Table, Thead, Th, Tbody, Tr, Td, Badge, Spinner,
} from '@shared/components/ui'
import { INVOICE_STATUS } from '@shared/lib/constants'
import { fmt } from '../api/reportHelpers'

export default function RecentInvoicesCard({ invoices, loading }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Invoices</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 pb-2">
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner className="w-6 h-6" />
          </div>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">No invoices found.</p>
        ) : (
          <Table>
            <Thead>
              <Th>Invoice #</Th>
              <Th>Customer</Th>
              <Th>Amount</Th>
              <Th>Status</Th>
            </Thead>
            <Tbody>
              {invoices.map(inv => (
                <Tr key={inv.invoice_number}>
                  <Td>
                    <span className="font-mono text-xs font-medium text-purple-600 dark:text-purple-400
                                     bg-purple-50 dark:bg-purple-500/10 px-1.5 py-0.5 rounded">
                      {inv.invoice_number}
                    </span>
                  </Td>
                  <Td className="text-slate-700 dark:text-slate-300">{inv.customer?.name || '—'}</Td>
                  <Td>
                    <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                      ${fmt(inv.total_amount)}
                    </span>
                  </Td>
                  <Td>
                    <Badge color={INVOICE_STATUS[inv.status]?.color || 'default'}>
                      {INVOICE_STATUS[inv.status]?.label || inv.status}
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
