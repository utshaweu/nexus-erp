import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { History, Eye, Search, Download } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td,
  PageHeader, Card, EmptyState, Spinner,
} from '@shared/components/ui'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { PAGE_SIZE_TABLE as PAGE_SIZE } from '@shared/lib/constants'
import { fetchHistory } from '../api/approvalRequests'
import { useApprovalModuleOptions } from '../hooks/useApprovalModuleOptions'

const STATUS = {
  pending:   { label: 'Pending',   color: 'yellow'  },
  approved:  { label: 'Approved',  color: 'green'   },
  rejected:  { label: 'Rejected',  color: 'red'     },
  cancelled: { label: 'Cancelled', color: 'default' },
}
const STATUS_TABS = ['all', 'approved', 'rejected', 'cancelled']

const PRIORITY = {
  low:    { label: 'Low',    color: 'default' },
  normal: { label: 'Normal', color: 'blue'    },
  high:   { label: 'High',   color: 'yellow'  },
  urgent: { label: 'Urgent', color: 'red'     },
}

const INPUT_CLS =
  'px-3 py-2 rounded-lg text-sm ' +
  'text-slate-700 dark:text-slate-200 ' +
  'bg-white dark:bg-surface-800 ' +
  'border border-surface-200 dark:border-surface-700 ' +
  'focus:outline-none focus:ring-1 focus:ring-brand-500'

function exportToCSV(rows) {
  if (!rows.length) { toast.error('Nothing to export.'); return }
  const headers = ['Request #', 'Title', 'Module', 'Workflow', 'Priority', 'Amount', 'Status', 'Date']
  const data = rows.map(r => [
    r.request_number, r.title, r.module, r.workflow?.name || '',
    PRIORITY[r.priority]?.label || r.priority,
    r.amount != null ? Number(r.amount).toFixed(2) : '',
    STATUS[r.status]?.label || r.status,
    new Date(r.updated_at || r.created_at).toLocaleDateString(),
  ])
  const csv = [headers, ...data]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = 'approval_history.csv'; a.click()
  URL.revokeObjectURL(url)
}

export default function ApprovalHistory() {
  const { tenantId } = useTenant()

  const [requests, setRequests]   = useState([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(1)
  const [loading, setLoading]     = useState(false)
  const [tab, setTab]             = useState('all')
  const [search, setSearch]       = useState('')
  const [moduleFilter, setModule] = useState('all')
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')
  const moduleOptions = useApprovalModuleOptions()

  const loadHistory = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const { requests, total } = await fetchHistory(tenantId, {
        tab, search, module: moduleFilter, dateFrom, dateTo, page, pageSize: PAGE_SIZE,
      })
      setRequests(requests)
      setTotal(total)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId, tab, search, moduleFilter, dateFrom, dateTo, page])

  useEffect(() => { loadHistory() }, [loadHistory])
  useEffect(() => { setPage(1) }, [tab, search, moduleFilter, dateFrom, dateTo])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval History"
        subtitle="Complete audit trail of all completed approval requests"
        breadcrumb="Approvals / History"
        actions={
          <Button variant="secondary" size="sm" onClick={() => exportToCSV(requests)}>
            <Download className="w-4 h-4" />Export CSV
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status tabs */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
          {STATUS_TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${
                tab === t
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {t === 'all' ? 'All' : (STATUS[t]?.label ?? t)}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {/* Module */}
        <select value={moduleFilter} onChange={e => setModule(e.target.value)} className={INPUT_CLS}>
          <option value="all">All Modules</option>
          {moduleOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={INPUT_CLS} />
          <span className="text-slate-400 text-xs">to</span>
          <input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   className={INPUT_CLS} />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo('') }} className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-2">
              Clear
            </button>
          )}
        </div>
      </div>

      {!loading && total > 0 && (
        <p className="text-xs text-slate-500">{total} record{total !== 1 ? 's' : ''} found</p>
      )}

      {/* Table */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : requests.length === 0 ? (
          <EmptyState icon={History} title="No history found" description="No completed approval requests match your current filters." />
        ) : (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>Request #</Th><Th>Title</Th><Th>Module</Th><Th>Workflow</Th>
                  <Th>Priority</Th><Th>Amount</Th><Th>Status</Th><Th>Completed</Th><Th></Th>
                </Tr>
              </Thead>
              <Tbody>
                {requests.map(req => (
                  <Tr key={req.id}>
                    <Td>
                      <Link to={`/approval/requests/${req.id}`} className="text-sm font-mono font-semibold text-brand-600 dark:text-brand-400 hover:underline">
                        {req.request_number}
                      </Link>
                    </Td>
                    <Td><span className="text-sm text-slate-700 dark:text-slate-300 max-w-[180px] block truncate">{req.title}</span></Td>
                    <Td><span className="text-xs text-slate-500 capitalize">{req.module}</span></Td>
                    <Td><span className="text-xs text-slate-500">{req.workflow?.name || '—'}</span></Td>
                    <Td><Badge color={PRIORITY[req.priority]?.color || 'default'}>{PRIORITY[req.priority]?.label || req.priority}</Badge></Td>
                    <Td><span className="text-sm text-slate-700 dark:text-slate-300">{req.amount != null ? `$${Number(req.amount).toLocaleString()}` : '—'}</span></Td>
                    <Td><Badge color={STATUS[req.status]?.color || 'default'}>{STATUS[req.status]?.label || req.status}</Badge></Td>
                    <Td><span className="text-xs text-slate-500">{new Date(req.updated_at || req.created_at).toLocaleDateString()}</span></Td>
                    <Td>
                      <Link to={`/approval/requests/${req.id}`}>
                        <Button variant="ghost" size="xs"><Eye className="w-3.5 h-3.5" /></Button>
                      </Link>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
            {totalPages > 1 && (
              <div className="p-4 border-t border-surface-200 dark:border-surface-800">
                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
