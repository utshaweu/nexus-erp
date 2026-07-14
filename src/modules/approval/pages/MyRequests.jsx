import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Send, Plus, Eye, X, Search } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td,
  PageHeader, Card, EmptyState, Spinner,
} from '@shared/components/ui'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { PAGE_SIZE_TABLE as PAGE_SIZE } from '@shared/lib/constants'
import { fetchMyRequests, cancelRequest } from '../api/approvalRequests'
import NewRequestModal from '../components/NewRequestModal'

const STATUS = {
  pending:   { label: 'Pending',   color: 'yellow'  },
  approved:  { label: 'Approved',  color: 'green'   },
  rejected:  { label: 'Rejected',  color: 'red'     },
  cancelled: { label: 'Cancelled', color: 'default' },
}
const STATUS_TABS = ['all', 'pending', 'approved', 'rejected', 'cancelled']

const PRIORITY = {
  low:    { label: 'Low',    color: 'default' },
  normal: { label: 'Normal', color: 'blue'    },
  high:   { label: 'High',   color: 'yellow'  },
  urgent: { label: 'Urgent', color: 'red'     },
}

export default function MyRequests() {
  const { tenantId } = useTenant()
  const userId = window.__erp_user__?.id

  const [requests, setRequests] = useState([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(false)
  const [tab, setTab]           = useState('all')
  const [search, setSearch]     = useState('')
  const [showNew, setShowNew]   = useState(false)

  const fetchRequests = useCallback(async () => {
    if (!tenantId || !userId) return
    setLoading(true)
    try {
      const { requests, total } = await fetchMyRequests(tenantId, userId, { tab, search, page, pageSize: PAGE_SIZE })
      setRequests(requests)
      setTotal(total)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId, userId, tab, search, page])

  useEffect(() => { fetchRequests() }, [fetchRequests])
  useEffect(() => { setPage(1) }, [tab, search])

  const handleCancel = async (id) => {
    try {
      await cancelRequest(id, userId)
      toast.success('Request cancelled.')
      fetchRequests()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Requests"
        subtitle="Track all approval requests you have submitted"
        breadcrumb="Approvals / My Requests"
        actions={
          <Button size="sm" onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4" />New Request
          </Button>
        }
      />

      {/* Tabs + search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
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
      </div>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : requests.length === 0 ? (
          <EmptyState
            icon={Send}
            title="No requests found"
            description={tab === 'all' ? 'You have not submitted any approval requests yet.' : `No ${STATUS[tab]?.label?.toLowerCase() ?? tab} requests found.`}
            action={<Button size="sm" onClick={() => setShowNew(true)}><Plus className="w-4 h-4" />New Request</Button>}
          />
        ) : (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>Request #</Th><Th>Title</Th><Th>Module</Th><Th>Priority</Th>
                  <Th>Amount</Th><Th>Status</Th><Th>Step</Th><Th>Submitted</Th><Th></Th>
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
                    <Td><span className="text-sm text-slate-700 dark:text-slate-300 max-w-[200px] block truncate">{req.title}</span></Td>
                    <Td><span className="text-xs text-slate-500 capitalize">{req.module}</span></Td>
                    <Td>
                      <Badge color={PRIORITY[req.priority]?.color || 'default'}>{PRIORITY[req.priority]?.label || req.priority}</Badge>
                    </Td>
                    <Td><span className="text-sm text-slate-700 dark:text-slate-300">{req.amount ? `$${Number(req.amount).toLocaleString()}` : '—'}</span></Td>
                    <Td><Badge color={STATUS[req.status]?.color || 'default'}>{STATUS[req.status]?.label || req.status}</Badge></Td>
                    <Td><span className="text-xs text-slate-500">{req.status === 'pending' ? `Step ${req.current_step}` : '—'}</span></Td>
                    <Td><span className="text-xs text-slate-500">{new Date(req.created_at).toLocaleDateString()}</span></Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <Link to={`/approval/requests/${req.id}`}>
                          <Button variant="ghost" size="xs"><Eye className="w-3.5 h-3.5" /></Button>
                        </Link>
                        {req.status === 'pending' && (
                          <Button variant="ghost" size="xs" onClick={() => handleCancel(req.id)} title="Cancel">
                            <X className="w-3.5 h-3.5 text-red-500" />
                          </Button>
                        )}
                      </div>
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

      <NewRequestModal open={showNew} onClose={() => setShowNew(false)} onSaved={fetchRequests} tenantId={tenantId} />
    </div>
  )
}
