import { DollarSign } from 'lucide-react'
import { Card, CardContent, Badge, Table, Thead, Th, Tbody, Tr, Td } from '@shared/components/ui'
import { PAYROLL_RUN_STATUS } from '@shared/lib/constants'

const fmt = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function EmployeePayrollHistoryTab({ payrolls }) {
  return (
    <Card>
      <CardContent className="pt-0">
        {payrolls.length === 0 ? (
          <div className="py-16 text-center">
            <DollarSign className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No payroll entries found.</p>
          </div>
        ) : (
          <Table>
            <Thead>
              <Th>Payroll Run</Th>
              <Th>Period</Th>
              <Th>Basic Salary</Th>
              <Th>Allowances</Th>
              <Th>Deductions</Th>
              <Th>Net Salary</Th>
              <Th>Status</Th>
            </Thead>
            <Tbody>
              {payrolls.map(p => {
                const run = p.hr_payroll_runs
                const s   = PAYROLL_RUN_STATUS[run?.status]
                return (
                  <Tr key={p.id}>
                    <Td>
                      <span className="font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
                        {run?.run_number || '—'}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-slate-600 dark:text-slate-400">
                        {run ? `${MONTHS[(run.period_month || 1) - 1]} ${run.period_year}` : '—'}
                      </span>
                    </Td>
                    <Td><span className="font-mono text-sm">${fmt(p.basic_salary)}</span></Td>
                    <Td><span className="font-mono text-sm text-green-600 dark:text-green-400">+${fmt(p.allowances)}</span></Td>
                    <Td><span className="font-mono text-sm text-red-600 dark:text-red-400">-${fmt(p.deductions)}</span></Td>
                    <Td><span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">${fmt(p.net_salary)}</span></Td>
                    <Td><Badge color={s?.color || 'default'}>{s?.label || run?.status}</Badge></Td>
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
