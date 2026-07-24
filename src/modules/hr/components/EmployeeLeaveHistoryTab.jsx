import { Calendar } from 'lucide-react'
import { Card, CardContent, Badge, Table, Thead, Th, Tbody, Tr, Td } from '@shared/components/ui'
import { LEAVE_REQUEST_STATUS } from '@shared/lib/constants'

export default function EmployeeLeaveHistoryTab({ leaves }) {
  return (
    <Card>
      <CardContent className="pt-0">
        {leaves.length === 0 ? (
          <div className="py-16 text-center">
            <Calendar className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No leave requests found.</p>
          </div>
        ) : (
          <Table>
            <Thead>
              <Th>Leave Type</Th>
              <Th>From</Th>
              <Th>To</Th>
              <Th>Days</Th>
              <Th>Reason</Th>
              <Th>Status</Th>
            </Thead>
            <Tbody>
              {leaves.map(l => {
                const s = LEAVE_REQUEST_STATUS[l.status]
                return (
                  <Tr key={l.id}>
                    <Td><span className="font-medium text-slate-800 dark:text-slate-200">{l.hr_leave_types?.name || '—'}</span></Td>
                    <Td><span className="text-slate-600 dark:text-slate-400">{l.start_date}</span></Td>
                    <Td><span className="text-slate-600 dark:text-slate-400">{l.end_date}</span></Td>
                    <Td><span className="font-medium">{l.days_count}</span></Td>
                    <Td><span className="text-slate-500 text-sm truncate max-w-[180px] block">{l.reason || '—'}</span></Td>
                    <Td><Badge color={s?.color || 'default'}>{s?.label || l.status}</Badge></Td>
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
