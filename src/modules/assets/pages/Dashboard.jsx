import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Cpu, TrendingDown, Wrench, DollarSign, Plus } from 'lucide-react'
import { StatCard, Button, PageHeader } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { fetchDashboardData } from '../api/dashboard'
import ProjectedValueChart from '../components/ProjectedValueChart'
import CategoryBreakdown from '../components/CategoryBreakdown'
import RecentAssetsTable from '../components/RecentAssetsTable'

const fmtVal = (n) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
  return `$${Number(n).toFixed(0)}`
}

export default function AssetDashboard() {
  const { tenantId } = useTenant()

  const [loading, setLoading]           = useState(true)
  const [stats, setStats]               = useState({ total: 0, totalValue: 0, fullyDepreciated: 0, underMaintenance: 0 })
  const [recentAssets, setRecentAssets] = useState([])
  const [categories, setCategories]     = useState([])
  const [chartData, setChartData]       = useState([])

  const fetchData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const { stats, recentAssets, categories, chartData } = await fetchDashboardData(tenantId)
      setStats(stats)
      setRecentAssets(recentAssets)
      setCategories(categories)
      setChartData(chartData)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assets"
        subtitle="Fixed asset management and depreciation tracking"
        breadcrumb="Finance / Assets"
        actions={
          <Link to="/assets/list">
            <Button size="sm"><Plus className="w-4 h-4" />Add Asset</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Assets"    value={stats.total.toString()}            icon={Cpu}          color="#f97316" loading={loading} />
        <StatCard label="Total Value"     value={fmtVal(stats.totalValue)}           icon={DollarSign}   color="#8b5cf6" loading={loading} />
        <StatCard label="Fully Depr."     value={stats.fullyDepreciated.toString()}  icon={TrendingDown} color="#64748b" loading={loading} />
        <StatCard label="In Maintenance"  value={stats.underMaintenance.toString()}  icon={Wrench}       color="#f59e0b" loading={loading} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <ProjectedValueChart loading={loading} data={chartData} />
        <CategoryBreakdown loading={loading} categories={categories} />
      </div>

      <RecentAssetsTable loading={loading} assets={recentAssets} />
    </div>
  )
}
