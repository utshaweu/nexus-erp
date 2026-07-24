import { Table, Thead, Th, Tbody, Tr, Td, Badge } from '@shared/components/ui'
import { ACCOUNT_TYPES } from '@shared/lib/constants'
import { fmt } from '../api/reportHelpers'
import { AGING_BUCKETS, BUCKET_COLORS, BUCKET_LABELS } from '../api/financial'

export function IncomeTab({ data }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-500 py-10 text-center">No revenue or expenses found for the selected period.</p>
  }

  const totals = data.reduce((acc, r) => ({
    revenue:    acc.revenue    + Number(r.revenue    || 0),
    expenses:   acc.expenses   + Number(r.expenses   || 0),
    net_profit: acc.net_profit + Number(r.net_profit || 0),
  }), { revenue: 0, expenses: 0, net_profit: 0 })

  return (
    <>
      <Table>
        <Thead>
          <Th>Period</Th>
          <Th className="text-right">Revenue</Th>
          <Th className="text-right">Expenses</Th>
          <Th className="text-right">Net Profit</Th>
          <Th className="text-right">Margin</Th>
        </Thead>
        <Tbody>
          {data.map(row => {
            const margin = Number(row.revenue) > 0
              ? ((Number(row.net_profit) / Number(row.revenue)) * 100).toFixed(1)
              : '0.0'
            const isProfit = Number(row.net_profit) >= 0
            return (
              <Tr key={row.period}>
                <Td><span className="font-medium text-slate-900 dark:text-slate-100">{row.period}</span></Td>
                <Td className="text-right">
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">${fmt(row.revenue)}</span>
                </Td>
                <Td className="text-right">
                  <span className="font-mono text-red-500 dark:text-red-400">${fmt(row.expenses)}</span>
                </Td>
                <Td className="text-right">
                  <span className={`font-mono font-semibold ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                    {isProfit ? '' : '-'}${fmt(Math.abs(Number(row.net_profit)))}
                  </span>
                </Td>
                <Td className="text-right">
                  <Badge color={Number(margin) >= 0 ? 'green' : 'red'}>{margin}%</Badge>
                </Td>
              </Tr>
            )
          })}
        </Tbody>
      </Table>

      <div className="flex justify-end mt-5">
        <div className="w-72 rounded-xl bg-slate-50 dark:bg-surface-800 p-4 space-y-2">
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Total Revenue</span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400">${fmt(totals.revenue)}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Total Expenses</span>
            <span className="font-mono text-red-500 dark:text-red-400">${fmt(totals.expenses)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-slate-100
                          pt-2 border-t border-surface-200 dark:border-surface-700">
            <span>Net Profit</span>
            <span className={`font-mono ${totals.net_profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
              {totals.net_profit < 0 ? '-' : ''}${fmt(Math.abs(totals.net_profit))}
            </span>
          </div>
        </div>
      </div>
    </>
  )
}

export function AgingTab({ data, type }) {
  const bucketTotals = AGING_BUCKETS.reduce((acc, b) => {
    acc[b] = data
      .filter(r => r.bucket === b)
      .reduce((s, r) => s + Math.max(0, Number(r.total_amount || 0) - Number(r.paid_amount || 0)), 0)
    return acc
  }, {})

  const isAR = type === 'ar'

  if (data.length === 0) {
    return <p className="text-sm text-slate-500 py-10 text-center">No open {isAR ? 'receivables' : 'payables'} found.</p>
  }

  return (
    <>
      <div className="grid grid-cols-5 gap-3 mb-5">
        {AGING_BUCKETS.map(b => (
          <div key={b} className="rounded-xl border border-surface-200 dark:border-surface-700 p-3 text-center">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">{BUCKET_LABELS[b]}</p>
            <p className={`text-sm font-bold tabular-nums ${
              b === 'current' ? 'text-emerald-600 dark:text-emerald-400' :
              b === '90+'     ? 'text-red-500 dark:text-red-400' :
              'text-slate-800 dark:text-slate-100'
            }`}>
              ${fmt(bucketTotals[b])}
            </p>
          </div>
        ))}
      </div>

      <Table>
        <Thead>
          <Th>{isAR ? 'Invoice #' : 'Bill #'}</Th>
          <Th>{isAR ? 'Customer' : 'Vendor'}</Th>
          <Th>{isAR ? 'Invoice Date' : 'Bill Date'}</Th>
          <Th>Due Date</Th>
          <Th className="text-right">Amount</Th>
          <Th className="text-right">Balance</Th>
          <Th>Age</Th>
        </Thead>
        <Tbody>
          {data.map((r, i) => {
            const balance = Math.max(0, Number(r.total_amount || 0) - Number(r.paid_amount || 0))
            return (
              <Tr key={i}>
                <Td>
                  <span className={`font-mono text-xs font-medium px-1.5 py-0.5 rounded
                    ${isAR
                      ? 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10'
                      : 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10'
                    }`}>
                    {isAR ? r.invoice_number : r.bill_number}
                  </span>
                </Td>
                <Td>{(isAR ? r.customer?.name : r.vendor?.name) || '—'}</Td>
                <Td><span className="text-sm text-slate-500">{isAR ? r.invoice_date : r.bill_date}</span></Td>
                <Td><span className="text-sm text-slate-500">{r.due_date || '—'}</span></Td>
                <Td className="text-right">
                  <span className="font-mono text-sm">${fmt(r.total_amount)}</span>
                </Td>
                <Td className="text-right">
                  <span className="font-mono text-sm font-semibold text-red-500 dark:text-red-400">${fmt(balance)}</span>
                </Td>
                <Td>
                  <Badge color={BUCKET_COLORS[r.bucket]}>{BUCKET_LABELS[r.bucket]}</Badge>
                </Td>
              </Tr>
            )
          })}
        </Tbody>
      </Table>
    </>
  )
}

export function TrialTab({ data }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-500 py-10 text-center">No chart of accounts configured for this tenant.</p>
  }

  const totalDebit  = data.reduce((s, r) => s + Number(r.total_debit  || 0), 0)
  const totalCredit = data.reduce((s, r) => s + Number(r.total_credit || 0), 0)
  const diff        = Math.abs(totalDebit - totalCredit)
  const balanced    = diff < 0.01

  return (
    <>
      <Table>
        <Thead>
          <Th>Code</Th>
          <Th>Account Name</Th>
          <Th>Type</Th>
          <Th className="text-right">Debit</Th>
          <Th className="text-right">Credit</Th>
          <Th className="text-right">Balance</Th>
        </Thead>
        <Tbody>
          {data.map(r => (
            <Tr key={r.account_code}>
              <Td><span className="font-mono text-xs text-slate-500">{r.account_code}</span></Td>
              <Td><span className="font-medium text-slate-900 dark:text-slate-100">{r.account_name}</span></Td>
              <Td>
                <Badge color={ACCOUNT_TYPES[r.account_type]?.color || 'default'}>
                  {ACCOUNT_TYPES[r.account_type]?.label || r.account_type}
                </Badge>
              </Td>
              <Td className="text-right"><span className="font-mono text-sm">${fmt(r.total_debit)}</span></Td>
              <Td className="text-right"><span className="font-mono text-sm">${fmt(r.total_credit)}</span></Td>
              <Td className="text-right">
                <span className={`font-mono text-sm font-semibold ${Number(r.balance) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                  {Number(r.balance) < 0 ? '-' : ''}${fmt(Math.abs(Number(r.balance)))}
                </span>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <div className="flex justify-end mt-5">
        <div className="w-72 rounded-xl bg-slate-50 dark:bg-surface-800 p-4 space-y-2">
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Total Debits</span><span className="font-mono">${fmt(totalDebit)}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Total Credits</span><span className="font-mono">${fmt(totalCredit)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold pt-2 border-t border-surface-200 dark:border-surface-700
                          text-slate-900 dark:text-slate-100">
            <span>Difference</span>
            <Badge color={balanced ? 'green' : 'red'}>{balanced ? 'Balanced' : `$${fmt(diff)}`}</Badge>
          </div>
        </div>
      </div>
    </>
  )
}
