import { Link } from 'react-router-dom'
import { Package, ArrowLeftRight, AlertTriangle, Warehouse, TrendingDown, Plus } from 'lucide-react'
import { StatCard, Card, CardHeader, CardTitle, CardContent, Badge, Table, Thead, Th, Tbody, Tr, Td, Button, PageHeader } from '@shared/components/ui'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const STOCK_DATA = [
  { cat: 'Electronics', qty: 450 }, { cat: 'Furniture', qty: 230 }, { cat: 'Supplies', qty: 680 },
  { cat: 'Parts', qty: 1200 }, { cat: 'Tools', qty: 320 },
]

const LOW_STOCK = [
  { id: 'P-001', name: 'USB-C Cable', stock: 12, reorder: 50, location: 'WH-Main' },
  { id: 'P-002', name: 'Ergonomic Mouse', stock: 5, reorder: 20, location: 'WH-Main' },
  { id: 'P-003', name: 'HDMI Adapter', stock: 8, reorder: 30, location: 'WH-East' },
]

export default function InventoryDashboard() {
  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" subtitle="Track stock levels and movements" breadcrumb="Operations / Inventory"
        actions={<Link to="/inventory/products"><Button size="sm"><Plus className="w-4 h-4"/>Add Product</Button></Link>}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Products" value="1,247" icon={Package} color="#3b82f6"/>
        <StatCard label="Stock Moves" value="89" icon={ArrowLeftRight} color="#6366f1"/>
        <StatCard label="Low Stock" value={LOW_STOCK.length} icon={AlertTriangle} color="#f59e0b"/>
        <StatCard label="Warehouses" value="3" icon={Warehouse} color="#10b981"/>
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Stock by Category</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={STOCK_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
                <XAxis dataKey="cat" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}/>
                <Bar dataKey="qty" fill="#3b82f6" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>⚠ Low Stock Alert</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {LOW_STOCK.map(item => (
                <div key={item.id} className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-200">{item.name}</span>
                    <Badge color="yellow">{item.stock} left</Badge>
                  </div>
                  <div className="text-xs text-slate-500">Reorder at: {item.reorder} · {item.location}</div>
                  <div className="mt-2 h-1.5 rounded-full bg-surface-800">
                    <div className="h-full rounded-full bg-amber-500" style={{ width: `${(item.stock / item.reorder) * 100}%` }}/>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
