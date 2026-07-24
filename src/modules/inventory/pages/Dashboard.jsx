import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Package, ArrowLeftRight, AlertTriangle, Warehouse, Plus } from 'lucide-react'
import { Button, PageHeader } from '@shared/components/ui'
import { useTenant } from '@core/tenant/TenantContext'
import toast from '@shared/lib/toast'
import { fetchInventoryDashboard } from '../api/dashboard'
import DashStatCard from '../components/DashStatCard'
import CategoryBarChart from '../components/CategoryBarChart'
import LowStockPanel from '../components/LowStockPanel'

export default function InventoryDashboard() {
  const { tenantId } = useTenant()
  const [loading,  setLoading]  = useState(true)
  const [stats,    setStats]    = useState({ products: 0, warehouses: 0, moves: 0 })
  const [lowStock, setLowStock] = useState([])
  const [catData,  setCatData]  = useState([])

  useEffect(() => {
    if (!tenantId) return
    setLoading(true)
    fetchInventoryDashboard(tenantId)
      .then(data => {
        setStats(data.stats)
        setCatData(data.catData)
        setLowStock(data.lowStock)
      })
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false))
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

      <div className="grid lg:grid-cols-3 gap-6">
        <CategoryBarChart loading={loading} catData={catData} totalProducts={stats.products} />
        <LowStockPanel loading={loading} lowStock={lowStock} />
      </div>
    </div>
  )
}
