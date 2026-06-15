import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Package, ArrowLeftRight, AlertTriangle, Warehouse, Plus, TrendingUp, ArrowRight } from 'lucide-react'
import {
  Card, CardHeader, CardTitle, CardContent,
  Badge, Button, PageHeader, Spinner,
} from '@shared/components/ui'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import toast from '@shared/lib/toast'

// ── Stat Card ─────────────────────────────────────────────────────────────────

function DashStatCard({ label, value, icon: Icon, color, loading, to }) {
  const inner = (
    <Card className={`p-5 group transition-all duration-200 ${to ? 'hover:-translate-y-0.5 hover:shadow-md cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest truncate">
            {label}
          </p>
          {loading ? (
            <div className="mt-2 h-8 w-20 bg-surface-200 dark:bg-surface-800 rounded animate-pulse" />
          ) : (
            <p className="mt-1.5 text-2xl font-display font-bold text-slate-900 dark:text-slate-100">
              {value}
            </p>
          )}
        </div>
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0
                     transition-transform duration-200 group-hover:scale-110"
          style={{ backgroundColor: `${color}18`, border: `1px solid ${color}35` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
      {to && (
        <div className="mt-3 flex items-center gap-1 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity"
             style={{ color }}>
          View details <ArrowRight className="w-3 h-3" />
        </div>
      )}
    </Card>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

// ── Custom bar tooltip ────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700
                    rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">{label}</p>
      <p className="text-blue-600 dark:text-blue-400">{payload[0].value} products</p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InventoryDashboard() {
  const { tenantId } = useTenant()
  const [loading,  setLoading]  = useState(true)
  const [stats,    setStats]    = useState({ products: 0, warehouses: 0, moves: 0 })
  const [lowStock, setLowStock] = useState([])
  const [catData,  setCatData]  = useState([])

  useEffect(() => {
    if (!tenantId) return

    const load = async () => {
      setLoading(true)
      try {
        const [prodRes, whRes, moveRes, lvlRes] = await Promise.all([
          supabase
            .from('products')
            .select('id, category', { count: 'exact' })
            .eq('tenant_id', tenantId)
            .eq('status', 'active'),
          supabase
            .from('warehouses')
            .select('id', { count: 'exact' })
            .eq('tenant_id', tenantId)
            .eq('status', 'active'),
          supabase
            .from('stock_moves')
            .select('id', { count: 'exact' })
            .eq('tenant_id', tenantId),
          supabase
            .from('inventory_levels')
            .select('product_id, product_name, sku, warehouse_name, qty_on_hand')
            .eq('tenant_id', tenantId),
        ])

        setStats({
          products:   prodRes.count || 0,
          warehouses: whRes.count   || 0,
          moves:      moveRes.count || 0,
        })

        // Category distribution
        if (!prodRes.error && prodRes.data) {
          const catMap = {}
          prodRes.data.forEach(p => { catMap[p.category || 'Other'] = (catMap[p.category || 'Other'] || 0) + 1 })
          setCatData(
            Object.entries(catMap)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, qty]) => ({ cat, qty }))
          )
        }

        // Low stock
        if (!lvlRes.error && lvlRes.data) {
          const { data: reorderData } = await supabase
            .from('products')
            .select('id, reorder_qty')
            .eq('tenant_id', tenantId)
            .gt('reorder_qty', 0)

          const reorderMap = {}
          ;(reorderData || []).forEach(p => { reorderMap[p.id] = Number(p.reorder_qty) })

          const low = lvlRes.data
            .filter(l => {
              const threshold = reorderMap[l.product_id]
              return threshold !== undefined && Number(l.qty_on_hand) <= threshold
            })
            .slice(0, 6)
          setLowStock(low)
        }
      } catch (err) {
        toast.error(err.message)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [tenantId])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        subtitle="Track stock levels and movements across all warehouses"
        breadcrumb="Operations / Inventory"
        actions={
          <Link to="/inventory/products">
            <Button size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" />Add Product
            </Button>
          </Link>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <DashStatCard
          label="Active Products"
          value={loading ? '—' : stats.products.toLocaleString()}
          icon={Package}
          color="#3b82f6"
          loading={loading}
          to="/inventory/products"
        />
        <DashStatCard
          label="Stock Moves"
          value={loading ? '—' : stats.moves.toLocaleString()}
          icon={ArrowLeftRight}
          color="#6366f1"
          loading={loading}
          to="/inventory/stock"
        />
        <DashStatCard
          label="Low Stock Items"
          value={loading ? '—' : lowStock.length}
          icon={AlertTriangle}
          color="#f59e0b"
          loading={loading}
        />
        <DashStatCard
          label="Warehouses"
          value={loading ? '—' : stats.warehouses}
          icon={Warehouse}
          color="#10b981"
          loading={loading}
          to="/inventory/warehouses"
        />
      </div>

      {/* Chart + Low stock */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Category bar chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Products by Category</CardTitle>
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400
                              bg-emerald-50 dark:bg-emerald-500/10
                              px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/20">
                <TrendingUp className="w-3 h-3" />
                <span>{stats.products} total</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-[220px]">
                <Spinner className="w-6 h-6" />
              </div>
            ) : catData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[220px] gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-surface-800
                                flex items-center justify-center">
                  <Package className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-sm text-slate-400">No products yet — add products to see chart.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={catData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:[&>line]:stroke-surface-800" />
                  <XAxis
                    dataKey="cat"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="qty" name="Products" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Low stock panel */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Low Stock</CardTitle>
              {lowStock.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-xs
                                 font-bold flex items-center justify-center">
                  {lowStock.length}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Spinner className="w-5 h-5" />
              </div>
            ) : lowStock.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20
                                flex items-center justify-center">
                  <Package className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">All stocked up</p>
                  <p className="text-xs text-slate-400 mt-0.5">No items below reorder level</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {lowStock.map((item, i) => {
                  const qty = Number(item.qty_on_hand)
                  const isOut = qty <= 0
                  return (
                    <div
                      key={i}
                      className={`p-3 rounded-xl border transition-colors ${
                        isOut
                          ? 'bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20'
                          : 'bg-amber-50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {item.product_name}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            {item.sku} · {item.warehouse_name}
                          </p>
                        </div>
                        <Badge color={isOut ? 'red' : 'yellow'} className="flex-shrink-0">
                          {isOut ? 'Out' : `${qty} left`}
                        </Badge>
                      </div>
                    </div>
                  )
                })}

                <Link
                  to="/inventory/stock"
                  className="flex items-center justify-center gap-1.5 py-2 text-xs font-medium
                             text-brand-600 dark:text-brand-400
                             hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                >
                  View all stock moves <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
