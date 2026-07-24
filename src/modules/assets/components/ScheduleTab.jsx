import { Card, CardHeader, CardTitle, CardContent, Table, Thead, Th, Tbody, Tr, Td, Badge } from '@shared/components/ui'
import { ASSET_DEPR_STATUS } from '@shared/lib/constants'

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function ScheduleTab({ schedules }) {
  return (
    <Card>
      <CardHeader><CardTitle>Depreciation Schedule</CardTitle></CardHeader>
      <CardContent className="pt-0 px-0">
        {schedules.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">No depreciation schedule found.</div>
        ) : (
          <Table>
            <Thead>
              <Th>Period</Th>
              <Th>Date</Th>
              <Th>Depreciation</Th>
              <Th>Accumulated</Th>
              <Th>Book Value After</Th>
              <Th>Status</Th>
            </Thead>
            <Tbody>
              {schedules.map((s) => {
                const st = ASSET_DEPR_STATUS[s.status]
                return (
                  <Tr key={s.id}>
                    <Td><span className="font-medium text-slate-700 dark:text-slate-300">{s.period_label}</span></Td>
                    <Td><span className="text-sm text-slate-500">{s.period_date}</span></Td>
                    <Td><span className="font-mono text-sm">${fmt(s.depreciation_amount)}</span></Td>
                    <Td><span className="font-mono text-sm">${fmt(s.accumulated_depreciation)}</span></Td>
                    <Td>
                      <span className="font-mono text-sm font-semibold text-orange-600 dark:text-orange-400">
                        ${fmt(s.book_value_after)}
                      </span>
                    </Td>
                    <Td><Badge color={st?.color || 'default'}>{st?.label || s.status}</Badge></Td>
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
