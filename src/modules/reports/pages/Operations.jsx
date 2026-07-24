import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Activity, Download, Save } from 'lucide-react'
import {
  PageHeader, Card, CardHeader, CardTitle, CardContent, Button, Input, Spinner, EmptyState,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import { useTenant } from '@core/tenant/TenantContext'
import toast from '@shared/lib/toast'
import { SALES_ORDER_STATUS, PURCHASE_ORDER_STATUS } from '@shared/lib/constants'
import { runOperationsReport, fetchInventorySnapshot } from '../api/operations'
import { fmt, dateRangeSchema, startOfMonth, todayStr, exportCSV } from '../api/reportHelpers'
import { useSavedFilters } from '../hooks/useSavedFilters'
import ReportTabBar from '../components/ReportTabBar'
import SavedFiltersBar from '../components/SavedFiltersBar'
import SaveFilterModal from '../components/SaveFilterModal'
import { SalesTab, PurchasesTab, InventoryTab } from '../components/OperationsTabs'

const TABS = [
  { id: 'sales',     label: 'Sales Orders'     },
  { id: 'purchases', label: 'Purchase Orders'  },
  { id: 'inventory', label: 'Inventory Stock'  },
]

export default function Operations() {
  const { tenantId } = useTenant()
  const [activeTab,     setActiveTab]     = useState('sales')
  const [loading,       setLoading]       = useState(false)
  const [invLoading,    setInvLoading]    = useState(true)
  const [hasRun,        setHasRun]        = useState(false)
  const [salesData,     setSalesData]     = useState([])
  const [purchaseData,  setPurchaseData]  = useState([])
  const [inventoryData, setInventoryData] = useState([])

  const form = useForm({
    resolver: zodResolver(dateRangeSchema),
    defaultValues: { date_from: startOfMonth(), date_to: todayStr() },
  })
  const { register, handleSubmit, formState: { errors } } = form

  const fetchInventory = useCallback(async () => {
    if (!tenantId) return
    setInvLoading(true)
    try {
      setInventoryData(await fetchInventorySnapshot(tenantId))
    } finally {
      setInvLoading(false)
    }
  }, [tenantId])

  useEffect(() => { fetchInventory() }, [fetchInventory])

  const runReport = async (values) => {
    if (!tenantId) return
    setLoading(true)
    setHasRun(true)
    try {
      const { salesData, purchaseData } = await runOperationsReport(tenantId, values)
      setSalesData(salesData)
      setPurchaseData(purchaseData)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const {
    savedFilters, saveForm, showSave, setShowSave, closeSave, handleSaveFilter, applyFilter, deleteFilter,
  } = useSavedFilters(tenantId, 'operations', form, runReport)

  const handleExport = () => {
    if (activeTab === 'sales') {
      exportCSV(salesData, [
        { label: 'Order #',     key: 'order_number' },
        { label: 'Customer',    key: r => r.customer?.name || '' },
        { label: 'Order Date',  key: 'order_date' },
        { label: 'Status',      key: r => SALES_ORDER_STATUS[r.status]?.label || r.status },
        { label: 'Total',       key: r => fmt(r.total_amount) },
      ], 'sales_orders.csv')
    } else if (activeTab === 'purchases') {
      exportCSV(purchaseData, [
        { label: 'Order #',    key: 'order_number' },
        { label: 'Vendor',     key: r => r.vendor?.name || '' },
        { label: 'Order Date', key: 'order_date' },
        { label: 'Status',     key: r => PURCHASE_ORDER_STATUS[r.status]?.label || r.status },
        { label: 'Total',      key: r => fmt(r.total_amount) },
      ], 'purchase_orders.csv')
    } else if (activeTab === 'inventory') {
      exportCSV(inventoryData, [
        { label: 'SKU',         key: 'sku' },
        { label: 'Product',     key: 'product_name' },
        { label: 'Warehouse',   key: 'warehouse_name' },
        { label: 'UOM',         key: 'unit_of_measure' },
        { label: 'Qty on Hand', key: r => r.qty_on_hand },
        { label: 'Reorder Qty', key: r => r.reorder_qty || 0 },
      ], 'inventory_stock.csv')
    }
  }

  const isReportTab = activeTab === 'sales' || activeTab === 'purchases'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations Reports"
        subtitle="Sales orders, purchase orders, and inventory stock levels"
        breadcrumb="Reports / Operations"
        actions={
          <PermissionGate action="export" moduleId="reports">
            <Button
              variant="secondary" size="sm" onClick={handleExport}
              disabled={isReportTab ? !hasRun : false}
              className="gap-1.5"
            >
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
                  <Activity className="w-4 h-4" />Run Report
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowSave(true)} className="gap-1.5">
                  <Save className="w-4 h-4" />Save Filter
                </Button>
              </div>
            </div>
            {activeTab === 'inventory' && (
              <p className="mt-2 text-xs text-slate-400">
                Inventory stock is a live snapshot — date range applies to Sales and Purchase tabs only.
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      <ReportTabBar tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'inventory' ? (
        <Card>
          <CardHeader><CardTitle>Inventory Stock Levels</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <InventoryTab data={inventoryData} loading={invLoading} />
          </CardContent>
        </Card>
      ) : !hasRun ? (
        <Card>
          <EmptyState
            icon={Activity}
            title="Configure and run your report"
            description="Set a date range above and click Run Report to see operations data."
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
            {activeTab === 'sales'     && <SalesTab     data={salesData}    />}
            {activeTab === 'purchases' && <PurchasesTab data={purchaseData} />}
          </CardContent>
        </Card>
      )}

      <SaveFilterModal
        open={showSave}
        onClose={closeSave}
        form={saveForm}
        onSubmit={handleSaveFilter}
        placeholder="e.g. June 2026 — Operations"
        description="Saves the current date range for quick re-use."
      />
    </div>
  )
}
