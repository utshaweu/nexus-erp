import { Warehouse, MapPin, Package, ArrowLeftRight } from 'lucide-react'
import { Badge, PageHeader, Card } from '@shared/components/ui'

const WAREHOUSES = [
  { id:'WH-Main', name:'Main Warehouse', location:'New York, USA', manager:'Alex Thompson', products:856, capacity:80, status:'active' },
  { id:'WH-East', name:'East Warehouse', location:'Boston, USA', manager:'Sarah Lee', products:312, capacity:45, status:'active' },
  { id:'WH-West', name:'West Warehouse', location:'Los Angeles, USA', manager:'Carlos Rivera', products:79, capacity:20, status:'active' },
]
export default function Warehouses() {
  return (
    <div className="space-y-6">
      <PageHeader title="Warehouses" subtitle="Manage warehouse locations and capacity" breadcrumb="Inventory / Warehouses"/>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {WAREHOUSES.map(wh => (
          <Card key={wh.id} className="p-5 hover:border-surface-700 transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2.5 rounded-xl bg-blue-500/15 border border-blue-500/20"><Warehouse className="w-5 h-5 text-blue-400"/></div>
              <Badge color="green">{wh.status}</Badge>
            </div>
            <h3 className="font-display font-bold text-slate-100">{wh.name}</h3>
            <p className="text-xs font-mono text-slate-500 mt-0.5">{wh.id}</p>
            <div className="mt-3 space-y-1.5 text-xs text-slate-500">
              <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3"/>{wh.location}</div>
              <div className="flex items-center gap-1.5"><Package className="w-3 h-3"/>Manager: {wh.manager}</div>
            </div>
            <div className="mt-4 pt-4 border-t border-surface-800">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-500">Capacity Used</span>
                <span className="text-slate-300">{wh.capacity}%</span>
              </div>
              <div className="h-2 rounded-full bg-surface-800">
                <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${wh.capacity}%` }}/>
              </div>
              <div className="mt-3 text-sm font-semibold text-slate-200">{wh.products.toLocaleString()} products stored</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
