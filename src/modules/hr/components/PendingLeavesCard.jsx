import { Link } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Table, Thead, Th, Tbody, Tr, Td } from '@shared/components/ui'

export default function PendingLeavesCard({ pendingLeaves }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            Pending Leaves
            {pendingLeaves.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-500">
                {pendingLeaves.length}
              </span>
            )}
          </CardTitle>
          <Link to="/hr/leave" className="text-xs text-brand-400 hover:underline">Manage →</Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {pendingLeaves.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">No pending leave requests.</p>
        ) : (
          <Table>
            <Thead>
              <Th>Employee</Th>
              <Th>Type</Th>
              <Th>From</Th>
              <Th>To</Th>
              <Th>Days</Th>
            </Thead>
            <Tbody>
              {pendingLeaves.map(l => {
                const emp = l.hr_employees
                return (
                  <Tr key={l.id}>
                    <Td>
                      <div>
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {emp ? `${emp.first_name} ${emp.last_name}` : '—'}
                        </span>
                        {emp?.employee_number && (
                          <p className="text-xs font-mono text-slate-500">{emp.employee_number}</p>
                        )}
                      </div>
                    </Td>
                    <Td><span className="text-slate-500 text-sm">{l.hr_leave_types?.name || '—'}</span></Td>
                    <Td><span className="text-slate-500 text-sm">{l.start_date}</span></Td>
                    <Td><span className="text-slate-500 text-sm">{l.end_date}</span></Td>
                    <Td><span className="font-medium">{l.days_count}</span></Td>
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
