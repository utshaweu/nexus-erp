import { Link } from 'react-router-dom'
import {
  Card, CardHeader, CardTitle, CardContent, Badge, Table, Thead, Th, Tbody, Tr, Td,
} from '@shared/components/ui'
import { EMPLOYEE_STATUS } from '@shared/lib/constants'

export default function RecentHiresCard({ recentHires }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Recent Hires</CardTitle>
          <Link to="/hr/employees" className="text-xs text-brand-400 hover:underline">View all →</Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {recentHires.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">No employees yet.</p>
        ) : (
          <Table>
            <Thead>
              <Th>Employee</Th>
              <Th>Department</Th>
              <Th>Position</Th>
              <Th>Joined</Th>
              <Th>Status</Th>
            </Thead>
            <Tbody>
              {recentHires.map(e => {
                const s = EMPLOYEE_STATUS[e.status]
                return (
                  <Tr key={e.id}>
                    <Td>
                      <div>
                        <Link
                          to={`/hr/employees/${e.id}`}
                          className="font-medium text-slate-900 dark:text-slate-100 hover:text-brand-400"
                        >
                          {e.first_name} {e.last_name}
                        </Link>
                        <p className="text-xs font-mono text-slate-500">{e.employee_number}</p>
                      </div>
                    </Td>
                    <Td><span className="text-slate-500">{e.hr_departments?.name || '—'}</span></Td>
                    <Td><span className="text-slate-500 text-xs">{e.hr_positions?.title || '—'}</span></Td>
                    <Td><span className="text-slate-500">{e.join_date}</span></Td>
                    <Td><Badge color={s?.color || 'default'}>{s?.label || e.status}</Badge></Td>
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
