import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FileText, Download, Save, Trash2, BarChart2 } from 'lucide-react'
import {
  PageHeader, Card, CardHeader, CardTitle, CardContent,
  Table, Thead, Th, Tbody, Tr, Td, Badge, Button, Input, Modal, Spinner, EmptyState,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import toast from '@shared/lib/toast'
import { ACCOUNT_TYPES } from '@shared/lib/constants'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const startOfMonth = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
const todayStr = () => new Date().toISOString().slice(0, 10)

function ageBucket(dueDateStr) {
  if (!dueDateStr) return 'current'
  const days = Math.floor((Date.now() - new Date(dueDateStr).getTime()) / 86400000)
  if (days <= 0)  return 'current'
  if (days <= 30) return '1–30'
  if (days <= 60) return '31–60'
  if (days <= 90) return '61–90'
  return '90+'
}

const AGING_BUCKETS   = ['current', '1–30', '31–60', '61–90', '90+']
const BUCKET_COLORS   = { current: 'green', '1–30': 'blue', '31–60': 'yellow', '61–90': 'orange', '90+': 'red' }
const BUCKET_LABELS   = { current: 'Current', '1–30': '1–30 days', '31–60': '31–60 days', '61–90': '61–90 days', '90+': '90+ days' }

function exportCSV(rows, columns, filename) {
  const header = columns.map(c => c.label).join(',')
  const body   = rows.map(row =>
    columns.map(c => {
      const val = typeof c.key === 'function' ? c.key(row) : (row[c.key] ?? '')
      return `"${String(val).replace(/"/g, '""')}"`
    }).join(',')
  )
  const blob = new Blob([[header, ...body].join('\n')], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  Object.assign(document.createElement('a'), { href: url, download: filename }).click()
  URL.revokeObjectURL(url)
}

// ── Validation ────────────────────────────────────────────────────────────────

const filterSchema = z.object({
  date_from: z.string().min(1, 'From date is required'),
  date_to:   z.string().min(1, 'To date is required'),
}).refine(d => new Date(d.date_to) >= new Date(d.date_from), {
  message: 'To date must be on or after From date',
  path: ['date_to'],
})

const saveSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60, 'Max 60 characters'),
})

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'income',   label: 'Income Statement' },
  { id: 'ar_aging', label: 'AR Aging'         },
  { id: 'ap_aging', label: 'AP Aging'         },
  { id: 'trial',    label: 'Trial Balance'    },
]

// ── Tab content components ────────────────────────────────────────────────────

function IncomeTab({ data }) {
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

function AgingTab({ data, type }) {
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

function TrialTab({ data }) {
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Financial() {
  const { tenantId } = useTenant()
  const [activeTab,    setActiveTab]    = useState('income')
  const [loading,      setLoading]      = useState(false)
  const [hasRun,       setHasRun]       = useState(false)
  const [incomeData,   setIncomeData]   = useState([])
  const [arData,       setArData]       = useState([])
  const [apData,       setApData]       = useState([])
  const [trialData,    setTrialData]    = useState([])
  const [savedFilters, setSavedFilters] = useState([])
  const [showSave,     setShowSave]     = useState(false)

  const { register, handleSubmit, getValues, reset, formState: { errors } } = useForm({
    resolver: zodResolver(filterSchema),
    defaultValues: { date_from: startOfMonth(), date_to: todayStr() },
  })

  const saveForm = useForm({ resolver: zodResolver(saveSchema), defaultValues: { name: '' } })

  const fetchSavedFilters = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase
      .from('report_saved_filters')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('report_page', 'financial')
      .order('created_at', { ascending: false })
    setSavedFilters(data || [])
  }, [tenantId])

  useEffect(() => { fetchSavedFilters() }, [fetchSavedFilters])

  const runReport = async (values) => {
    if (!tenantId) return
    setLoading(true)
    setHasRun(true)
    try {
      const { date_from, date_to } = values

      const [incomeRes, arRes, apRes, trialRes] = await Promise.all([
        supabase.rpc('get_income_summary', { p_tenant_id: tenantId, p_date_from: date_from, p_date_to: date_to }),
        supabase.from('invoices')
          .select('invoice_number, invoice_date, due_date, total_amount, paid_amount, status, customer:customer_id(name)')
          .eq('tenant_id', tenantId)
          .in('status', ['draft', 'sent', 'overdue']),
        supabase.from('bills')
          .select('bill_number, bill_date, due_date, total_amount, paid_amount, status, vendor:vendor_id(name)')
          .eq('tenant_id', tenantId)
          .in('status', ['draft', 'posted']),
        supabase.rpc('get_trial_balance', { p_tenant_id: tenantId, p_date_from: date_from, p_date_to: date_to }),
      ])

      if (incomeRes.error) throw incomeRes.error
      if (arRes.error)     throw arRes.error
      if (apRes.error)     throw apRes.error
      if (trialRes.error)  throw trialRes.error

      setIncomeData(incomeRes.data || [])
      setArData((arRes.data || []).map(r => ({ ...r, bucket: ageBucket(r.due_date) })))
      setApData((apRes.data || []).map(r => ({ ...r, bucket: ageBucket(r.due_date) })))
      setTrialData(trialRes.data  || [])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveFilter = async (data) => {
    const { error } = await supabase.from('report_saved_filters').insert({
      tenant_id:   tenantId,
      report_page: 'financial',
      name:        data.name,
      filters:     getValues(),
    })
    if (error) { toast.error(error.message); return }
    toast.success('Filter saved.')
    saveForm.reset()
    setShowSave(false)
    fetchSavedFilters()
  }

  const applyFilter = (sf) => {
    reset(sf.filters)
    handleSubmit(runReport)()
  }

  const deleteFilter = async (id) => {
    const { error } = await supabase.from('report_saved_filters').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Filter deleted.')
    fetchSavedFilters()
  }

  const handleExport = () => {
    if (activeTab === 'income') {
      exportCSV(incomeData, [
        { label: 'Period',     key: 'period'     },
        { label: 'Revenue',    key: r => fmt(r.revenue)    },
        { label: 'Expenses',   key: r => fmt(r.expenses)   },
        { label: 'Net Profit', key: r => fmt(r.net_profit) },
      ], 'income_statement.csv')
    } else if (activeTab === 'ar_aging') {
      exportCSV(arData, [
        { label: 'Invoice #',    key: 'invoice_number' },
        { label: 'Customer',     key: r => r.customer?.name || '' },
        { label: 'Invoice Date', key: 'invoice_date' },
        { label: 'Due Date',     key: 'due_date' },
        { label: 'Balance',      key: r => fmt(Math.max(0, Number(r.total_amount) - Number(r.paid_amount || 0))) },
        { label: 'Age Bucket',   key: 'bucket' },
      ], 'ar_aging.csv')
    } else if (activeTab === 'ap_aging') {
      exportCSV(apData, [
        { label: 'Bill #',    key: 'bill_number' },
        { label: 'Vendor',    key: r => r.vendor?.name || '' },
        { label: 'Bill Date', key: 'bill_date' },
        { label: 'Due Date',  key: 'due_date' },
        { label: 'Balance',   key: r => fmt(Math.max(0, Number(r.total_amount) - Number(r.paid_amount || 0))) },
        { label: 'Age Bucket',key: 'bucket' },
      ], 'ap_aging.csv')
    } else if (activeTab === 'trial') {
      exportCSV(trialData, [
        { label: 'Account Code', key: 'account_code' },
        { label: 'Account Name', key: 'account_name' },
        { label: 'Type',         key: 'account_type' },
        { label: 'Debit',        key: r => fmt(r.total_debit)  },
        { label: 'Credit',       key: r => fmt(r.total_credit) },
        { label: 'Balance',      key: r => fmt(r.balance)      },
      ], 'trial_balance.csv')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Reports"
        subtitle="Income statement, aging analysis, and trial balance"
        breadcrumb="Reports / Financial"
        actions={
          <PermissionGate action="export" moduleId="reports">
            <Button variant="secondary" size="sm" onClick={handleExport} disabled={!hasRun} className="gap-1.5">
              <Download className="w-4 h-4" />Export CSV
            </Button>
          </PermissionGate>
        }
      />

      {/* Saved Filters */}
      {savedFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Saved:</span>
          {savedFilters.map(sf => (
            <span key={sf.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full
                                          text-xs font-medium
                                          bg-purple-50 dark:bg-purple-500/10
                                          border border-purple-200 dark:border-purple-500/30
                                          text-purple-700 dark:text-purple-300">
              <button onClick={() => applyFilter(sf)} className="hover:underline">{sf.name}</button>
              <button onClick={() => deleteFilter(sf.id)} className="ml-0.5 hover:text-red-500 transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Filter Form */}
      <Card>
        <CardContent className="pt-5">
          <form onSubmit={handleSubmit(runReport)} noValidate>
            <div className="flex flex-wrap items-end gap-4">
              <Input
                label="From Date"
                type="date"
                error={errors.date_from?.message}
                {...register('date_from')}
              />
              <Input
                label="To Date"
                type="date"
                error={errors.date_to?.message}
                {...register('date_to')}
              />
              <div className="flex gap-2 pb-px">
                <Button type="submit" loading={loading} className="gap-1.5">
                  <FileText className="w-4 h-4" />Run Report
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowSave(true)} className="gap-1.5">
                  <Save className="w-4 h-4" />Save Filter
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-surface-800 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === t.id
                ? 'bg-white dark:bg-surface-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Report Output */}
      {!hasRun ? (
        <Card>
          <EmptyState
            icon={BarChart2}
            title="Configure and run your report"
            description="Set a date range above and click Run Report to see financial data."
          />
        </Card>
      ) : loading ? (
        <Card className="flex items-center justify-center py-20">
          <Spinner className="w-8 h-8" />
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{TABS.find(t => t.id === activeTab)?.label}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {activeTab === 'income'   && <IncomeTab data={incomeData} />}
            {activeTab === 'ar_aging' && <AgingTab data={arData} type="ar" />}
            {activeTab === 'ap_aging' && <AgingTab data={apData} type="ap" />}
            {activeTab === 'trial'    && <TrialTab data={trialData} />}
          </CardContent>
        </Card>
      )}

      {/* Save Filter Modal */}
      <Modal open={showSave} onClose={() => { setShowSave(false); saveForm.reset() }} title="Save Filter" size="sm">
        <form onSubmit={saveForm.handleSubmit(handleSaveFilter)} noValidate className="space-y-4">
          <Input
            label="Filter Name"
            placeholder="e.g. Q1 2026 — Financial"
            error={saveForm.formState.errors.name?.message}
            {...saveForm.register('name')}
          />
          <p className="text-xs text-slate-500">
            Saves the current date range so you can quickly re-run this report.
          </p>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" className="flex-1"
              onClick={() => { setShowSave(false); saveForm.reset() }}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={saveForm.formState.isSubmitting}>Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
