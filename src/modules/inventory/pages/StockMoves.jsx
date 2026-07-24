import { useCallback } from 'react'
import { Plus, ArrowLeftRight, Calendar, MoveRight } from 'lucide-react'
import {
  Button, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import { useTenant } from '@core/tenant/TenantContext'
import {
  PAGE_SIZE_TABLE as PAGE_SIZE, STOCK_MOVE_TYPES, STOCK_MOVE_TYPE_TABS,
} from '@shared/lib/constants'
import { fetchStockMoves } from '../api/stockMoves'
import { useResourceList } from '@shared/hooks/useResourceList'
import StatChip from '../components/StatChip'
import StockMoveModal, { MOVE_ICONS, MOVE_BG } from '../components/StockMoveModal'

export default function StockMoves() {
  const { tenantId } = useTenant()

  const fetchFn = useCallback(
    ({ page, filter }) => fetchStockMoves(tenantId, { page, filter }),
    [tenantId]
  )
  const {
    items: moves, total, page, setPage, filter: typeFilter, setFilter: setTypeFilter,
    loading, refetch, showModal, openNew, closeModal,
  } = useResourceList(fetchFn, [tenantId])
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Movements"
        subtitle="Track every inventory in / out / internal move"
        breadcrumb="Inventory / Stock Moves"
        actions={
          <PermissionGate action="create" moduleId="inventory">
            <Button size="sm" onClick={openNew} className="gap-1.5">
              <Plus className="w-4 h-4" />New Move
            </Button>
          </PermissionGate>
        }
      />

      {!loading && total > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <StatChip value={total} label="Total Moves" color="#6366f1" />
          {Object.entries(STOCK_MOVE_TYPES).map(([key, cfg]) => {
            const count = typeFilter === key ? moves.length : undefined
            if (count === undefined) return null
            return <StatChip key={key} value={count} label={cfg.label} color={
              key === 'incoming' ? '#10b981' : key === 'outgoing' ? '#ef4444' :
              key === 'internal' ? '#3b82f6' : '#a855f7'
            } />
          })}
        </div>
      )}

      <Card>
        <div className="flex items-center gap-3 p-4 border-b border-surface-200 dark:border-surface-800 flex-wrap">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-surface-800">
            {STOCK_MOVE_TYPE_TABS.map(t => {
              const cfg  = t !== 'all' ? STOCK_MOVE_TYPES[t] : null
              const Icon = t !== 'all' ? MOVE_ICONS[t]       : ArrowLeftRight
              return (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    typeFilter === t
                      ? 'bg-white dark:bg-surface-700 text-slate-800 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {t === 'all' ? 'All' : cfg?.label}
                </button>
              )
            })}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20
                            flex items-center justify-center">
              <ArrowLeftRight className="w-5 h-5 text-indigo-400 animate-pulse" />
            </div>
            <p className="text-sm text-slate-400">Loading stock moves…</p>
          </div>
        ) : moves.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full bg-indigo-500/5 dark:bg-indigo-500/10 scale-[2.5]" />
              <div className="absolute inset-0 rounded-full bg-indigo-500/8 dark:bg-indigo-500/15 scale-[1.8]" />
              <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-blue-600/10
                              border border-indigo-500/20 flex items-center justify-center">
                <ArrowLeftRight className="w-9 h-9 text-indigo-400" />
              </div>
            </div>
            <h3 className="text-base font-display font-bold text-slate-800 dark:text-slate-200 mb-1">
              {typeFilter !== 'all' ? 'No moves of this type' : 'No stock moves yet'}
            </h3>
            <p className="text-sm text-slate-500 text-center max-w-xs mb-5">
              {typeFilter !== 'all'
                ? 'Try selecting a different type filter.'
                : 'Record your first stock movement to start tracking inventory flow.'}
            </p>
            {typeFilter === 'all' && (
              <PermissionGate action="create" moduleId="inventory">
                <Button size="sm" onClick={openNew} className="gap-1.5">
                  <Plus className="w-4 h-4" />Record First Move
                </Button>
              </PermissionGate>
            )}
          </div>
        ) : (
          <Table>
            <Thead>
              <Th>Move #</Th>
              <Th>Type</Th>
              <Th>Product</Th>
              <Th>Qty</Th>
              <Th>Route</Th>
              <Th>Date</Th>
              <Th>Reference</Th>
            </Thead>
            <Tbody>
              {moves.map(m => {
                const cfg      = STOCK_MOVE_TYPES[m.move_type] || { label: m.move_type, color: 'default' }
                const TypeIcon = MOVE_ICONS[m.move_type]
                const from     = m.source_warehouse?.name
                const to       = m.dest_warehouse?.name
                return (
                  <Tr key={m.id}>
                    <Td>
                      <span className="font-mono text-xs font-medium text-indigo-600 dark:text-indigo-400
                                       bg-indigo-50 dark:bg-indigo-500/10
                                       px-2 py-0.5 rounded-md">
                        {m.move_number}
                      </span>
                    </Td>
                    <Td>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium
                                        px-2 py-0.5 rounded-md border ${MOVE_BG[m.move_type] || ''}`}>
                        {TypeIcon && <TypeIcon className="w-3 h-3" />}
                        {cfg.label}
                      </span>
                    </Td>
                    <Td>
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {m.product?.name || '—'}
                        </span>
                        {m.product?.sku && (
                          <p className="text-xs text-slate-400 font-mono mt-0.5">{m.product.sku}</p>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {Number(m.quantity)}
                      </span>
                    </Td>
                    <Td>
                      {from || to ? (
                        <div className="flex items-center gap-1.5 text-sm">
                          {from && <span className="text-slate-500">{from}</span>}
                          {from && to && <MoveRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
                          {to   && <span className="text-slate-700 dark:text-slate-300 font-medium">{to}</span>}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </Td>
                    <Td>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <Calendar className="w-3 h-3" />{m.move_date}
                      </span>
                    </Td>
                    <Td>
                      <span className="font-mono text-xs text-slate-400">{m.reference || '—'}</span>
                    </Td>
                  </Tr>
                )
              })}
            </Tbody>
          </Table>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          total={total}
          pageSize={PAGE_SIZE}
          label="moves"
          className="border-t border-surface-200 dark:border-surface-800"
        />
      </Card>

      <StockMoveModal
        open={showModal}
        onClose={closeModal}
        onSaved={refetch}
      />
    </div>
  )
}
