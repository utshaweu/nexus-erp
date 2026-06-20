import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Activity, Download, Save, Trash2, AlertTriangle } from 'lucide-react'
import {
  PageHeader, Card, CardHeader, CardTitle, CardContent,
  Table, Thead, Th, Tbody, Tr, Td, Badge, Button, Input, Modal, Spinner, EmptyState,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import toast from '@shared/lib/toast'
import {
  SALES_ORDER_STATUS,
  PURCHASE_ORDER_STATUS,
} from '@shared/lib/constants'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const startOfMonth = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
const todayStr = () => new Date().toISOString().slice(0, 10)

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
  { id: 'sales',     label: 'Sales Orders'     },
  { id: 'purchases', label: 'Purchase Orders'  },
  { id: 'inventory', label: 'Inventory Stock'  },
]

// ── Tab: Sales Orders ─────────────────────────────────────────────────────────

function SalesTab({ data }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-500 py-10 text-center">No sales orders found for the selected period.</p>
  }

  const totalAmount = data.reduce((s, r) => s + Number(r.total_amount || 0), 0)

  const byStatus = Object.entries(SALES_ORDER_STATUS).map(([key, cfg]) => ({
    status: key,
    label:  cfg.label,
    color:  cfg.color,
    count:  data.filter(r => r.status === key).length,
    amount: data.filter(r => r.status === key).reduce((s, r) => s + Number(r.total_amount || 0), 0),
  })).filter(s => s.count > 0)

  return (
    <>
      {/* Summary by status */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        {byStatus.map(s => (
          <div key={s.status} className="rounded-xl border border-surface-200 dark:border-surface-700 p-3">
            <div className="flex items-center justify-between mb-1">
              <Badge color={s.color}>{s.label}</Badge>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{s.count}</span>
            </div>
            <p className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">${fmt(s.amount)}</p>
          </div>
        ))}
      </div>

      {/* Detail table */}
      <Table>
        <Thead>
          <Th>Order #</Th>
          <Th>Customer</Th>
          <Th>Order Date</Th>
          <Th>Status</Th>
          <Th className="text-right">Total</Th>
        </Thead>
        <Tbody>
          {data.map(r => (
            <Tr key={r.order_number}>
              <Td>
                <span className="font-mono text-xs font-medium text-blue-600 dark:text-blue-400
                                 bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 rounded">
                  {r.order_number}
                </span>
              </Td>
              <Td className="font-medium text-slate-900 dark:text-slate-100">{r.customer?.name || '—'}</Td>
              <Td><span className="text-sm text-slate-500">{r.order_date}</span></Td>
              <Td>
                <Badge color={SALES_ORDER_STATUS[r.status]?.color || 'default'}>
                  {SALES_ORDER_STATUS[r.status]?.label || r.status}
                </Badge>
              </Td>
              <Td className="text-right">
                <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                  ${fmt(r.total_amount)}
                </span>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <div className="flex justify-end mt-4">
        <div className="w-60 rounded-xl bg-slate-50 dark:bg-surface-800 p-3 flex justify-between items-center">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Total ({data.length} orders)</span>
          <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">${fmt(totalAmount)}</span>
        </div>
      </div>
    </>
  )
}

// ── Tab: Purchase Orders ──────────────────────────────────────────────────────

function PurchasesTab({ data }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-500 py-10 text-center">No purchase orders found for the selected period.</p>
  }

  const totalAmount = data.reduce((s, r) => s + Number(r.total_amount || 0), 0)

  const byStatus = Object.entries(PURCHASE_ORDER_STATUS).map(([key, cfg]) => ({
    status: key,
    label:  cfg.label,
    color:  cfg.color,
    count:  data.filter(r => r.status === key).length,
    amount: data.filter(r => r.status === key).reduce((s, r) => s + Number(r.total_amount || 0), 0),
  })).filter(s => s.count > 0)

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        {byStatus.map(s => (
          <div key={s.status} className="rounded-xl border border-surface-200 dark:border-surface-700 p-3">
            <div className="flex items-center justify-between mb-1">
              <Badge color={s.color}>{s.label}</Badge>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{s.count}</span>
            </div>
            <p className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">${fmt(s.amount)}</p>
          </div>
        ))}
      </div>

      <Table>
        <Thead>
          <Th>Order #</Th>
          <Th>Vendor</Th>
          <Th>Order Date</Th>
          <Th>Status</Th>
          <Th className="text-right">Total</Th>
        </Thead>
        <Tbody>
          {data.map(r => (
            <Tr key={r.order_number}>
              <Td>
                <span className="font-mono text-xs font-medium text-indigo-600 dark:text-indigo-400
                                 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded">
                  {r.order_number}
                </span>
              </Td>
              <Td className="font-medium text-slate-900 dark:text-slate-100">{r.vendor?.name || '—'}</Td>
              <Td><span className="text-sm text-slate-500">{r.order_date}</span></Td>
              <Td>
                <Badge color={PURCHASE_ORDER_STATUS[r.status]?.color || 'default'}>
                  {PURCHASE_ORDER_STATUS[r.status]?.label || r.status}
                </Badge>
              </Td>
              <Td className="text-right">
                <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                  ${fmt(r.total_amount)}
                </span>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <div className="flex justify-end mt-4">
        <div className="w-60 rounded-xl bg-slate-50 dark:bg-surface-800 p-3 flex justify-between items-center">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Total ({data.length} orders)</span>
          <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">${fmt(totalAmount)}</span>
        </div>
      </div>
    </>
  )
}

// ── Tab: Inventory ────────────────────────────────────────────────────────────

function InventoryTab({ data, loading }) {
  if (loading) {
    return <div className="flex justify-center py-10"><Spinner className="w-6 h-6" /></div>
  }
  if (data.length === 0) {
    return <p className="text-sm text-slate-500 py-10 text-center">No stock movements recorded yet.</p>
  }

  return (
    <Table>
      <Thead>
        <Th>SKU</Th>
        <Th>Product</Th>
        <Th>Warehouse</Th>
        <Th>UOM</Th>
        <Th className="text-right">Qty on Hand</Th>
        <Th className="text-right">Reorder Qty</Th>
        <Th>Status</Th>
      </Thead>
      <Tbody>
        {data.map((r, i) => {
          const isLow = Number(r.reorder_qty || 0) > 0 && Number(r.qty_on_hand) <= Number(r.reorder_qty)
          return (
            <Tr key={i}>
              <Td><span className="font-mono text-xs text-slate-500">{r.sku}</span></Td>
              <Td className="font-medium text-slate-900 dark:text-slate-100">{r.product_name}</Td>
              <Td><span className="text-sm text-slate-500">{r.warehouse_name}</span></Td>
              <Td><span className="text-xs text-slate-500">{r.unit_of_measure}</span></Td>
              <Td className="text-right">
                <span className={`font-mono text-sm font-semibold ${isLow ? 'text-red-500' : 'text-slate-900 dark:text-slate-100'}`}>
                  {Number(r.qty_on_hand).toLocaleString()}
                </span>
              </Td>
              <Td className="text-right">
                <span className="font-mono text-sm text-slate-500">
                  {Number(r.reorder_qty || 0).toLocaleString()}
                </span>
              </Td>
              <Td>
                {isLow
                  ? <Badge color="red"><AlertTriangle className="w-3 h-3 inline mr-1" />Low Stock</Badge>
                  : <Badge color="green">OK</Badge>
                }
              </Td>
            </Tr>
          )
        })}
      </Tbody>
    </Table>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Operations() {
  const { tenantId } = useTenant()
  const [activeTab,     setActiveTab]     = useState('sales')
  const [loading,       setLoading]       = useState(false)
  const [invLoading,    setInvLoading]    = useState(true)
  const [hasRun,        setHasRun]        = useState(false)
  const [salesData,     setSalesData]     = useState([])
  const [purchaseData,  setPurchaseData]  = useState([])
  const [inventoryData, setInventoryData] = useState([])
  const [savedFilters,  setSavedFilters]  = useState([])
  const [showSave,      setShowSave]      = useState(false)

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
      .eq('report_page', 'operations')
      .order('created_at', { ascending: false })
    setSavedFilters(data || [])
  }, [tenantId])

  const fetchInventory = useCallback(async () => {
    if (!tenantId) return
    setInvLoading(true)
    const { data, error } = await supabase
      .from('inventory_levels')
      .select('product_id, product_name, sku, unit_of_measure, warehouse_name, qty_on_hand, reorder_qty')
      .eq('tenant_id', tenantId)
      .order('product_name')
    if (!error) setInventoryData(data || [])
    setInvLoading(false)
  }, [tenantId])

  useEffect(() => { fetchSavedFilters() }, [fetchSavedFilters])
  useEffect(() => { fetchInventory() }, [fetchInventory])

  const runReport = async (values) => {
    if (!tenantId) return
    setLoading(true)
    setHasRun(true)
    try {
      const { date_from, date_to } = values

      const [soRes, poRes] = await Promise.all([
        supabase.from('sales_orders')
          .select('order_number, order_date, status, total_amount, customer:customer_id(name)')
          .eq('tenant_id', tenantId)
          .gte('order_date', date_from)
          .lte('order_date', date_to)
          .order('order_date', { ascending: false }),
        supabase.from('purchase_orders')
          .select('order_number, order_date, status, total_amount, vendor:vendor_id(name)')
          .eq('tenant_id', tenantId)
          .gte('order_date', date_from)
          .lte('order_date', date_to)
          .order('order_date', { ascending: false }),
      ])

      if (soRes.error) throw soRes.error
      if (poRes.error) throw poRes.error

      setSalesData(soRes.data    || [])
      setPurchaseData(poRes.data || [])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveFilter = async (data) => {
    const { error } = await supabase.from('report_saved_filters').insert({
      tenant_id:   tenantId,
      report_page: 'operations',
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

      {/* Filter Form (used for sales and purchases tabs) */}
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

      {/* Save Filter Modal */}
      <Modal open={showSave} onClose={() => { setShowSave(false); saveForm.reset() }} title="Save Filter" size="sm">
        <form onSubmit={saveForm.handleSubmit(handleSaveFilter)} noValidate className="space-y-4">
          <Input
            label="Filter Name"
            placeholder="e.g. June 2026 — Operations"
            error={saveForm.formState.errors.name?.message}
            {...saveForm.register('name')}
          />
          <p className="text-xs text-slate-500">
            Saves the current date range for quick re-use.
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
