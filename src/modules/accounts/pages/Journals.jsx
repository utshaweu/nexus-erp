import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, BookOpen } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { PAGE_SIZE_TABLE as PAGE_SIZE, JOURNAL_STATUS, JOURNAL_STATUS_TABS } from '@shared/lib/constants'
import { fetchJournalEntries, deleteJournalEntry, fetchActiveAccounts } from '../api/journals'
import { useResourceList } from '@shared/hooks/useResourceList'
import ListToolbar from '../components/ListToolbar'
import { ListLoading, ListEmptyState } from '../components/ListStates'
import JournalModal from '../components/JournalModal'

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const STATUS_TABS = JOURNAL_STATUS_TABS.map(s => ({ value: s, label: s === 'all' ? 'All' : JOURNAL_STATUS[s]?.label }))

export default function Journals() {
  const { tenantId } = useTenant()
  const [accounts, setAccounts] = useState([])

  const fetchFn = useCallback(params => fetchJournalEntries(tenantId, params), [tenantId])
  const {
    items: entries, total, page, setPage, search, setSearch, filter: statusFilter, setFilter: setStatusFilter,
    loading, refetch, showModal, editItem: editEntry, openNew, openEdit, closeModal,
  } = useResourceList(fetchFn, [tenantId])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  useEffect(() => { fetchActiveAccounts(tenantId).then(setAccounts) }, [tenantId])

  const handleDelete = async (e) => {
    if (!window.confirm(`Delete journal entry ${e.entry_number}? This cannot be undone.`)) return
    try {
      await deleteJournalEntry(e)
      toast.success('Journal entry deleted.')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const searching = Boolean(search || statusFilter !== 'all')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal Entries"
        subtitle="Double-entry bookkeeping for the general ledger"
        breadcrumb="Accounts / Journals"
        actions={
          <PermissionGate action="create" moduleId="accounts">
            <Button size="sm" onClick={openNew} className="gap-1.5">
              <Plus className="w-4 h-4" />New Entry
            </Button>
          </PermissionGate>
        }
      />

      <Card>
        <ListToolbar
          search={search} onSearchChange={setSearch}
          placeholder="Search by number or description…"
          tabs={STATUS_TABS} activeTab={statusFilter} onTabChange={setStatusFilter}
        />

        {loading ? (
          <ListLoading color="indigo" icon={BookOpen} label="Loading journal entries…" />
        ) : entries.length === 0 ? (
          <ListEmptyState
            color="indigo" icon={BookOpen} searching={searching}
            title="No journal entries yet" description="Create your first journal entry for double-entry bookkeeping."
            searchingTitle="No entries match" searchingDescription="Try adjusting your search or filter."
            action={
              <PermissionGate action="create" moduleId="accounts">
                <Button size="sm" onClick={openNew} className="gap-1.5">
                  <Plus className="w-4 h-4" />New Journal Entry
                </Button>
              </PermissionGate>
            }
          />
        ) : (
          <Table>
            <Thead>
              <Th>Entry #</Th>
              <Th>Date</Th>
              <Th>Description</Th>
              <Th>Reference</Th>
              <Th>Debit</Th>
              <Th>Credit</Th>
              <Th>Status</Th>
              <Th></Th>
            </Thead>
            <Tbody>
              {entries.map(e => (
                <Tr key={e.id} onClick={() => openEdit(e)}>
                  <Td>
                    <span className="font-mono text-xs font-medium
                                     text-indigo-600 dark:text-indigo-400
                                     bg-indigo-50 dark:bg-indigo-500/10
                                     px-2 py-0.5 rounded-md">
                      {e.entry_number}
                    </span>
                  </Td>
                  <Td><span className="text-sm text-slate-600 dark:text-slate-400">{e.entry_date}</span></Td>
                  <Td>
                    <span className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[200px] block">
                      {e.description}
                    </span>
                  </Td>
                  <Td><span className="text-sm text-slate-500 dark:text-slate-400">{e.reference || '—'}</span></Td>
                  <Td>
                    <span className="font-mono text-sm text-slate-700 dark:text-slate-300">
                      ${fmt(e.total_debit)}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-sm text-slate-700 dark:text-slate-300">
                      ${fmt(e.total_credit)}
                    </span>
                  </Td>
                  <Td>
                    <Badge color={JOURNAL_STATUS[e.status]?.color || 'default'}>
                      {JOURNAL_STATUS[e.status]?.label || e.status}
                    </Badge>
                  </Td>
                  <Td onClick={ev => ev.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <PermissionGate action="edit" moduleId="accounts">
                        <Button variant="ghost" size="xs" onClick={() => openEdit(e)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </PermissionGate>
                      <PermissionGate action="delete" moduleId="accounts">
                        <Button variant="danger" size="xs" onClick={() => handleDelete(e)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </PermissionGate>
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}

        <Pagination
          page={page} totalPages={totalPages} onPageChange={setPage}
          total={total} pageSize={PAGE_SIZE} label="entries"
          className="border-t border-surface-200 dark:border-surface-800"
        />
      </Card>

      <JournalModal
        open={showModal} onClose={closeModal} onSaved={refetch}
        entry={editEntry} accounts={accounts}
      />
    </div>
  )
}
