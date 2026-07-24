import { Wrench } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Table, Thead, Th, Tbody, Tr, Td, Badge } from '@shared/components/ui'
import { MAINTENANCE_TYPE, MAINTENANCE_STATUS } from '@shared/lib/constants'

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function MaintenanceTab({ assetId, maintenance }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Maintenance History</CardTitle>
          <a
            href={`/assets/maintenance?asset=${assetId}`}
            className="text-xs text-orange-500 hover:text-orange-400 transition-colors"
          >
            View all →
          </a>
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-0">
        {maintenance.length === 0 ? (
          <div className="py-12 text-center">
            <Wrench className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No maintenance records found.</p>
          </div>
        ) : (
          <Table>
            <Thead>
              <Th>Log #</Th>
              <Th>Type</Th>
              <Th>Scheduled</Th>
              <Th>Cost</Th>
              <Th>Performed By</Th>
              <Th>Status</Th>
            </Thead>
            <Tbody>
              {maintenance.map(m => {
                const mt = MAINTENANCE_TYPE[m.maintenance_type]
                const ms = MAINTENANCE_STATUS[m.status]
                return (
                  <Tr key={m.id}>
                    <Td>
                      <span className="font-mono text-xs font-medium text-orange-600 dark:text-orange-400
                                       bg-orange-50 dark:bg-orange-500/10 px-2 py-0.5 rounded-md">
                        {m.log_number}
                      </span>
                    </Td>
                    <Td><Badge color={mt?.color || 'default'}>{mt?.label || m.maintenance_type}</Badge></Td>
                    <Td><span className="text-sm text-slate-500">{m.scheduled_date}</span></Td>
                    <Td><span className="font-mono text-sm">${fmt(m.cost)}</span></Td>
                    <Td><span className="text-sm text-slate-500">{m.performed_by || '—'}</span></Td>
                    <Td><Badge color={ms?.color || 'default'}>{ms?.label || m.status}</Badge></Td>
                  </Tr>
                )
              })}
            </Tbody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
