import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FileText, Download, Save, BarChart2 } from 'lucide-react'
import {
  PageHeader, Card, CardHeader, CardTitle, CardContent, Button, Input, Spinner, EmptyState,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import { useTenant } from '@core/tenant/TenantContext'
import toast from '@shared/lib/toast'
import { runFinancialReport } from '../api/financial'
import { fmt, dateRangeSchema, startOfMonth, todayStr, exportCSV } from '../api/reportHelpers'
import { useSavedFilters } from '../hooks/useSavedFilters'
import ReportTabBar from '../components/ReportTabBar'
import SavedFiltersBar from '../components/SavedFiltersBar'
import SaveFilterModal from '../components/SaveFilterModal'
import { IncomeTab, AgingTab, TrialTab } from '../components/FinancialTabs'

const TABS = [
  { id: 'income',   label: 'Income Statement' },
  { id: 'ar_aging', label: 'AR Aging'         },
  { id: 'ap_aging', label: 'AP Aging'         },
  { id: 'trial',    label: 'Trial Balance'    },
]

export default function Financial() {
  const { tenantId } = useTenant()
  const [activeTab,  setActiveTab]  = useState('income')
  const [loading,    setLoading]    = useState(false)
  const [hasRun,     setHasRun]     = useState(false)
  const [incomeData, setIncomeData] = useState([])
  const [arData,     setArData]     = useState([])
  const [apData,     setApData]     = useState([])
  const [trialData,  setTrialData]  = useState([])

  const form = useForm({
    resolver: zodResolver(dateRangeSchema),
    defaultValues: { date_from: startOfMonth(), date_to: todayStr() },
  })
  const { register, handleSubmit, formState: { errors } } = form

  const runReport = async (values) => {
    if (!tenantId) return
    setLoading(true)
    setHasRun(true)
    try {
      const { incomeData, arData, apData, trialData } = await runFinancialReport(tenantId, values)
      setIncomeData(incomeData)
      setArData(arData)
      setApData(apData)
      setTrialData(trialData)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const {
    savedFilters, saveForm, showSave, setShowSave, closeSave, handleSaveFilter, applyFilter, deleteFilter,
  } = useSavedFilters(tenantId, 'financial', form, runReport)

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

      <SavedFiltersBar savedFilters={savedFilters} onApply={applyFilter} onDelete={deleteFilter} />

      <Card>
        <CardContent className="pt-5">
          <form onSubmit={handleSubmit(runReport)} noValidate>
            <div className="flex flex-wrap items-end gap-4">
              <Input label="From Date" type="date" error={errors.date_from?.message} {...register('date_from')} />
              <Input label="To Date"   type="date" error={errors.date_to?.message}   {...register('date_to')} />
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

      <ReportTabBar tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

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

      <SaveFilterModal
        open={showSave}
        onClose={closeSave}
        form={saveForm}
        onSubmit={handleSaveFilter}
        placeholder="e.g. Q1 2026 — Financial"
        description="Saves the current date range so you can quickly re-run this report."
      />
    </div>
  )
}
