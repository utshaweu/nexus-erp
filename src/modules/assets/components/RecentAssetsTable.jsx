import { Link } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardContent, Table, Thead, Th, Tbody, Tr, Td, Badge, Spinner } from '@shared/components/ui'
import { ASSET_STATUS } from '@shared/lib/constants'

export default function RecentAssetsTable({ loading, assets }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Recent Assets</CardTitle>
          <Link to="/assets/list" className="text-xs text-brand-400 hover:text-brand-300">
            View all →
          </Link>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner className="w-6 h-6" />
          </div>
        ) : assets.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            No assets yet.{' '}
            <Link to="/assets/list" className="text-orange-400 hover:underline">Add your first asset →</Link>
          </div>
        ) : (
          <Table>
            <Thead>
              <Th>Asset ID</Th>
              <Th>Name</Th>
              <Th>Category</Th>
              <Th>Purchase Date</Th>
              <Th>Cost</Th>
              <Th>Book Value</Th>
              <Th>Status</Th>
            </Thead>
            <Tbody>
              {assets.map(a => {
                const s = ASSET_STATUS[a.status] || { label: a.status, color: 'default' }
                const deprPct = Number(a.purchase_cost) > 0
                  ? Math.round(((Number(a.purchase_cost) - Number(a.book_value)) / Number(a.purchase_cost)) * 100)
                  : 0
                return (
                  <Tr key={a.id}>
                    <Td><span className="font-mono text-xs text-orange-400">{a.asset_number}</span></Td>
                    <Td>
                      <Link
                        to={`/assets/list/${a.id}`}
                        className="font-medium text-slate-900 dark:text-slate-100
                                   hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
                      >
                        {a.name}
                      </Link>
                    </Td>
                    <Td><span className="text-slate-400 text-sm">{a.asset_categories?.name || '—'}</span></Td>
                    <Td><span className="text-slate-500 text-sm">{a.purchase_date}</span></Td>
                    <Td><span className="font-semibold">${Number(a.purchase_cost).toLocaleString()}</span></Td>
                    <Td>
                      <div>
                        <span className="font-semibold text-orange-600 dark:text-orange-400">
                          ${Number(a.book_value).toLocaleString()}
                        </span>
                        <span className="text-xs text-slate-500 ml-1">(-{deprPct}%)</span>
                      </div>
                    </Td>
                    <Td><Badge color={s.color}>{s.label}</Badge></Td>
                  </Tr>
                )
              })}
            </Tbody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
