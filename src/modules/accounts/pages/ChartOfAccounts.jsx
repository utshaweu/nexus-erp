import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Pencil, Trash2, List, ListTree } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { PAGE_SIZE_TABLE as PAGE_SIZE, ACCOUNT_TYPES, ACCOUNT_TYPE_TABS } from '@shared/lib/constants'
import { fetchAccounts, fetchAllAccounts, deleteAccount } from '../api/chartOfAccounts'
import { useResourceList } from '@shared/hooks/useResourceList'
import ListToolbar from '../components/ListToolbar'
import { ListLoading, ListEmptyState } from '../components/ListStates'
import COAModal from '../components/COAModal'
import AccountTree from '../components/AccountTree'

const TYPE_TABS = ACCOUNT_TYPE_TABS.map(t => ({ value: t, label: t === 'all' ? 'All' : ACCOUNT_TYPES[t]?.label }))

export default function ChartOfAccounts() {
  const { tenantId } = useTenant()
  const [allAccounts, setAllAccounts] = useState([])
  const [view, setView] = useState('list')
  const allAccountsRequestId = useRef(0)

  const fetchFn = useCallback(params => fetchAccounts(tenantId, params), [tenantId])
  const {
    items: accounts, total, page, setPage, search, setSearch, filter: typeFilter, setFilter: setTypeFilter,
    loading, refetch, showModal, editItem: editAccount, openNew, openEdit, closeModal,
  } = useResourceList(fetchFn, [tenantId])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const loadAllAccounts = useCallback(() => {
    const thisRequest = ++allAccountsRequestId.current
    fetchAllAccounts(tenantId).then(data => {
      if (thisRequest === allAccountsRequestId.current) setAllAccounts(data)
    })
  }, [tenantId])

  useEffect(() => {
    loadAllAccounts()
    return () => { allAccountsRequestId.current++ }
  }, [loadAllAccounts])

  const handleSaved = () => { refetch(); loadAllAccounts() }

  const handleDelete = async (a) => {
    if (!window.confirm(`Delete "${a.name}"? This cannot be undone.`)) return
    try {
      await deleteAccount(a)
      toast.success('Account deleted.')
      handleSaved()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const searching = Boolean(search || typeFilter !== 'all')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chart of Accounts"
        subtitle="Manage your financial account structure"
        breadcrumb="Accounts / Chart of Accounts"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-surface-200 dark:border-surface-800 p-0.5">
              <Button
                variant={view === 'list' ? 'secondary' : 'ghost'} size="xs"
                onClick={() => setView('list')} className="gap-1.5"
              >
                <List className="w-3.5 h-3.5" />List
              </Button>
              <Button
                variant={view === 'tree' ? 'secondary' : 'ghost'} size="xs"
                onClick={() => setView('tree')} className="gap-1.5"
              >
                <ListTree className="w-3.5 h-3.5" />Tree
              </Button>
            </div>
            <PermissionGate action="create" moduleId="accounts">
              <Button size="sm" onClick={openNew} className="gap-1.5">
                <Plus className="w-4 h-4" />New Account
              </Button>
            </PermissionGate>
          </div>
        }
      />

      <Card>
        {view === 'tree' ? (
          <AccountTree accounts={allAccounts} onEdit={openEdit} onDelete={handleDelete} onNew={openNew} />
        ) : (
          <>
            <ListToolbar
              search={search} onSearchChange={setSearch}
              placeholder="Search by code or name…"
              tabs={TYPE_TABS} activeTab={typeFilter} onTabChange={setTypeFilter}
            />

            {loading ? (
              <ListLoading color="purple" icon={List} label="Loading accounts…" />
            ) : accounts.length === 0 ? (
              <ListEmptyState
                color="purple" icon={List} searching={searching}
                title="No accounts yet" description="Add your first account to build the chart of accounts."
                searchingTitle="No accounts match" searchingDescription="Try adjusting your search or filter."
                action={
                  <PermissionGate action="create" moduleId="accounts">
                    <Button size="sm" onClick={openNew} className="gap-1.5">
                      <Plus className="w-4 h-4" />Add First Account
                    </Button>
                  </PermissionGate>
                }
              />
            ) : (
              <Table>
                <Thead>
                  <Th>Code</Th>
                  <Th>Account Name</Th>
                  <Th>Type</Th>
                  <Th>Parent</Th>
                  <Th>Status</Th>
                  <Th></Th>
                </Thead>
                <Tbody>
                  {accounts.map(a => (
                    <Tr key={a.id} onClick={() => openEdit(a)}>
                      <Td>
                        <span className="inline-flex items-center font-mono text-xs font-medium
                                         text-purple-600 dark:text-purple-400
                                         bg-purple-50 dark:bg-purple-500/10
                                         px-2 py-0.5 rounded-md">
                          {a.code}
                        </span>
                      </Td>
                      <Td><span className="font-semibold text-slate-900 dark:text-slate-100">{a.name}</span></Td>
                      <Td>
                        <Badge color={ACCOUNT_TYPES[a.account_type]?.color || 'default'}>
                          {ACCOUNT_TYPES[a.account_type]?.label || a.account_type}
                        </Badge>
                      </Td>
                      <Td>
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          {a.parent ? `${a.parent.code} — ${a.parent.name}` : '—'}
                        </span>
                      </Td>
                      <Td>
                        <Badge color={a.is_active ? 'green' : 'default'}>
                          {a.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </Td>
                      <Td onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <PermissionGate action="edit" moduleId="accounts">
                            <Button variant="ghost" size="xs" onClick={() => openEdit(a)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          </PermissionGate>
                          <PermissionGate action="delete" moduleId="accounts">
                            <Button variant="danger" size="xs" onClick={() => handleDelete(a)}>
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
              total={total} pageSize={PAGE_SIZE} label="accounts"
              className="border-t border-surface-200 dark:border-surface-800"
            />
          </>
        )}
      </Card>

      <COAModal
        open={showModal} onClose={closeModal} onSaved={handleSaved}
        account={editAccount} allAccounts={allAccounts}
      />
    </div>
  )
}
