import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Users, Building, Calendar, DollarSign, Plus } from 'lucide-react'
import { StatCard, Button, PageHeader } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { fetchHRDashboard } from '../api/dashboard'
import DeptPieChart from '../components/DeptPieChart'
import RecentHiresCard from '../components/RecentHiresCard'
import PendingLeavesCard from '../components/PendingLeavesCard'
import PendingMovementsCard from '../components/PendingMovementsCard'

const fmt = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

export default function HRDashboard() {
  const { tenantId } = useTenant()

  const [stats,            setStats]            = useState({ total: 0, departments: 0, onLeave: 0, payroll: 0 })
  const [deptData,         setDeptData]         = useState([])
  const [recentHires,      setRecentHires]      = useState([])
  const [pendingLeaves,    setPendingLeaves]     = useState([])
  const [pendingMovements, setPendingMovements] = useState([])
  const [loading,          setLoading]          = useState(true)

  const fetchDashboard = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const data = await fetchHRDashboard(tenantId)
      setStats(data.stats)
      setDeptData(data.deptData)
      setRecentHires(data.recentHires)
      setPendingLeaves(data.pendingLeaves)
      setPendingMovements(data.pendingMovements)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Human Resources"
        subtitle="Workforce overview"
        breadcrumb="HR"
        actions={
          <Link to="/hr/employees">
            <Button size="sm"><Plus className="w-4 h-4" />Add Employee</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Employees"
          value={loading ? '—' : fmt(stats.total)}
          loading={loading}
          icon={Users}
          color="#ec4899"
        />
        <StatCard
          label="Departments"
          value={loading ? '—' : fmt(stats.departments)}
          loading={loading}
          icon={Building}
          color="#6366f1"
        />
        <StatCard
          label="On Leave Today"
          value={loading ? '—' : fmt(stats.onLeave)}
          loading={loading}
          icon={Calendar}
          color="#f59e0b"
        />
        <StatCard
          label="Last Payroll Net"
          value={loading ? '—' : `$${Number(stats.payroll).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
          loading={loading}
          icon={DollarSign}
          color="#10b981"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <DeptPieChart deptData={deptData} />
        <RecentHiresCard recentHires={recentHires} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <PendingLeavesCard pendingLeaves={pendingLeaves} />
        <PendingMovementsCard pendingMovements={pendingMovements} />
      </div>
    </div>
  )
}
