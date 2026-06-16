import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Pencil, Trash2, List } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card,
  Modal, Input, Select,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import {
  PAGE_SIZE_TABLE as PAGE_SIZE,
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_TABS,
} from '@shared/lib/constants'

const coaSchema = z.object({
  code:         z.string().trim().min(1, 'Account code is required'),
  name:         z.string().trim().min(1, 'Account name is required'),
  account_type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
  parent_id:    z.string().optional(),
  is_active:    z.string(),
})

const DEFAULT_VALUES = {
  code: '', name: '', account_type: 'asset', parent_id: '', is_active: 'true',
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function COAModal({ open, onClose, onSaved, account, allAccounts }) {
  const { tenantId } = useTenant()
  const isEdit = Boolean(account)

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(coaSchema), defaultValues: DEFAULT_VALUES })

  useEffect(() => {
    if (!open) return
    reset(account ? {
      code:         account.code         || '',
      name:         account.name         || '',
      account_type: account.account_type || 'asset',
      parent_id:    account.parent_id    || '',
      is_active:    account.is_active !== false ? 'true' : 'false',
    } : DEFAULT_VALUES)
  }, [open, account, reset])

  const onSubmit = async (data) => {
    const payload = {
      code:         data.code,
      name:         data.name,
      account_type: data.account_type,
      parent_id:    data.parent_id || null,
      is_active:    data.is_active === 'true',
    }
    if (isEdit) {
      const { error } = await supabase.from('chart_of_accounts').update(payload).eq('id', account.id)
      if (error) { toast.error(error.message); return }
      toast.success('Account updated.')
    } else {
      const { error } = await supabase.from('chart_of_accounts').insert({ ...payload, tenant_id: tenantId })
      if (error) { toast.error(error.message); return }
      toast.success('Account created.')
    }
    onSaved(); onClose()
  }

  const handleClose = () => { reset(); onClose() }

  const parentOptions = allAccounts.filter(a => !account || a.id !== account.id)

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? 'Edit Account' : 'New Account'} size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Account Code"
              placeholder="e.g. 1010"
              error={errors.code?.message}
              {...register('code')}
            />
            <Select label="Type" error={errors.account_type?.message} {...register('account_type')}>
              {Object.entries(ACCOUNT_TYPES).map(([v, { label }]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </Select>
          </div>

          <Input
            label="Account Name"
            placeholder="e.g. Cash and Cash Equivalents"
            error={errors.name?.message}
            {...register('name')}
          />

          <Select label="Parent Account (optional)" {...register('parent_id')}>
            <option value="">No parent</option>
            {parentOptions.map(a => (
              <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
            ))}
          </Select>

          <Select label="Status" {...register('is_active')}>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              {isEdit ? 'Save Changes' : 'Create Account'}
            </Button>
          </div>

        </div>
      </form>
    </Modal>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChartOfAccounts() {
  const { tenantId } = useTenant()
  const [accounts,    setAccounts]    = useState([])
  const [allAccounts, setAllAccounts] = useState([])
  const [total,       setTotal]       = useState(0)
  const [page,        setPage]        = useState(1)
  const [search,      setSearch]      = useState('')
  const [typeFilter,  setTypeFilter]  = useState('all')
  const [loading,     setLoading]     = useState(true)
  const [showModal,   setShowModal]   = useState(false)
  const [editAccount, setEditAccount] = useState(null)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const fetchAccounts = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      let query = supabase
        .from('chart_of_accounts')
        .select('*, parent:parent_id(code,name)', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('code')
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (typeFilter !== 'all') query = query.eq('account_type', typeFilter)
      if (search.trim()) {
        query = query.or(
          `code.ilike.%${search.trim()}%,name.ilike.%${search.trim()}%`
        )
      }

      const { data, count, error } = await query
      if (error) throw error
      setAccounts(data || [])
      setTotal(count || 0)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId, page, search, typeFilter])

  const fetchAllAccounts = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name')
      .eq('tenant_id', tenantId)
      .order('code')
    setAllAccounts(data || [])
  }, [tenantId])

  useEffect(() => { fetchAccounts() }, [fetchAccounts])
  useEffect(() => { fetchAllAccounts() }, [fetchAllAccounts])
  useEffect(() => { setPage(1) }, [search, typeFilter])

  const openNew    = ()  => { setEditAccount(null); setShowModal(true) }
  const openEdit   = (a) => { setEditAccount(a);    setShowModal(true) }
  const closeModal = ()  => { setShowModal(false);  setEditAccount(null) }

  const handleSaved = () => { fetchAccounts(); fetchAllAccounts() }

  const handleDelete = async (a) => {
    if (!window.confirm(`Delete "${a.name}"? This cannot be undone.`)) return
    const { error } = await supabase.from('chart_of_accounts').delete().eq('id', a.id)
    if (error) { toast.error(error.message); return }
    toast.success('Account deleted.')
    fetchAccounts(); fetchAllAccounts()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chart of Accounts"
        subtitle="Manage your financial account structure"
        breadcrumb="Accounts / Chart of Accounts"
        actions={
          <PermissionGate action="create" moduleId="accounts">
            <Button size="sm" onClick={openNew} className="gap-1.5">
              <Plus className="w-4 h-4" />New Account
            </Button>
          </PermissionGate>
        }
      />

      <Card>
        {/* Toolbar */}
        <div className="flex items-center gap-3 p-4 border-b border-surface-200 dark:border-surface-800 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-xs
                          px-3 py-2 rounded-lg
                          bg-slate-50 dark:bg-surface-800
                          border border-surface-200 dark:border-surface-700">
            <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by code or name…"
              className="bg-transparent text-sm text-slate-700 dark:text-slate-300
                         placeholder:text-slate-400 dark:placeholder:text-slate-600
                         flex-1 outline-none"
            />
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-surface-800">
            {ACCOUNT_TYPE_TABS.map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  typeFilter === t
                    ? 'bg-white dark:bg-surface-700 text-slate-800 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {t === 'all' ? 'All' : ACCOUNT_TYPES[t]?.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20
                            flex items-center justify-center">
              <List className="w-5 h-5 text-purple-400 animate-pulse" />
            </div>
            <p className="text-sm text-slate-400">Loading accounts…</p>
          </div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full bg-purple-500/5 dark:bg-purple-500/10 scale-[2.5]" />
              <div className="absolute inset-0 rounded-full bg-purple-500/8 dark:bg-purple-500/15 scale-[1.8]" />
              <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-violet-600/10
                              border border-purple-500/20 flex items-center justify-center">
                {search || typeFilter !== 'all'
                  ? <Search className="w-9 h-9 text-slate-400" />
                  : <List className="w-9 h-9 text-purple-400" />}
              </div>
            </div>
            <h3 className="text-base font-display font-bold text-slate-800 dark:text-slate-200 mb-1">
              {search || typeFilter !== 'all' ? 'No accounts match' : 'No accounts yet'}
            </h3>
            <p className="text-sm text-slate-500 text-center max-w-xs mb-5">
              {search || typeFilter !== 'all'
                ? 'Try adjusting your search or filter.'
                : 'Add your first account to build the chart of accounts.'}
            </p>
            {!search && typeFilter === 'all' && (
              <PermissionGate action="create" moduleId="accounts">
                <Button size="sm" onClick={openNew} className="gap-1.5">
                  <Plus className="w-4 h-4" />Add First Account
                </Button>
              </PermissionGate>
            )}
          </div>
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
                  <Td>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{a.name}</span>
                  </Td>
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
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          total={total}
          pageSize={PAGE_SIZE}
          label="accounts"
          className="border-t border-surface-200 dark:border-surface-800"
        />
      </Card>

      <COAModal
        open={showModal}
        onClose={closeModal}
        onSaved={handleSaved}
        account={editAccount}
        allAccounts={allAccounts}
      />
    </div>
  )
}
