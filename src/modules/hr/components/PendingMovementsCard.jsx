import { Link } from 'react-router-dom'
import { ArrowLeftRight } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Badge, Table, Thead, Th, Tbody, Tr, Td } from '@shared/components/ui'
import { MOVEMENT_STATUS } from '@shared/lib/constants'

export default function PendingMovementsCard({ pendingMovements }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-pink-400" />
            Pending Movements
            {pendingMovements.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs font-semibold rounded-full bg-pink-500/20 text-pink-500">
                {pendingMovements.length}
              </span>
            )}
          </CardTitle>
          <Link to="/hr/movement" className="text-xs text-brand-400 hover:underline">Manage →</Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {pendingMovements.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">No pending movement requests.</p>
        ) : (
          <Table>
            <Thead>
              <Th>Employee</Th>
              <Th>Type</Th>
              <Th>From</Th>
              <Th>To</Th>
              <Th>Status</Th>
            </Thead>
            <Tbody>
              {pendingMovements.map(mv => {
                const emp = mv.hr_employees
                const s   = MOVEMENT_STATUS[mv.status]
                return (
                  <Tr key={mv.id}>
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
                    <Td><span className="text-slate-500 text-sm">{mv.movement_type}</span></Td>
                    <Td><span className="text-slate-500 text-sm">{mv.from_date}</span></Td>
                    <Td><span className="text-slate-500 text-sm">{mv.to_date}</span></Td>
                    <Td><Badge color={s?.color || 'yellow'}>{s?.label || mv.status}</Badge></Td>
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
