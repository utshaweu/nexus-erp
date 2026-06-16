import { useState, useEffect, useCallback } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Pencil, Trash2, BookOpen, PlusCircle, Minus, AlertCircle, CheckCircle2 } from 'lucide-react'
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
  JOURNAL_STATUS,
  JOURNAL_STATUS_TABS,
} from '@shared/lib/constants'

// ── Validation ────────────────────────────────────────────────────────────────

const jLineSchema = z.object({
  account_id:    z.string().min(1, 'Account required'),
  description:   z.string().optional(),
  debit_amount:  z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0),
  credit_amount: z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0),
})

const journalSchema = z.object({
  entry_date:  z.string().min(1, 'Entry date is required'),
  description: z.string().trim().min(1, 'Description is required'),
  reference:   z.string().optional(),
  status:      z.enum(['draft', 'posted', 'cancelled']),
  lines:       z.array(jLineSchema).min(2, 'At least two lines are required'),
})

const DEFAULT_LINE = { account_id: '', description: '', debit_amount: 0, credit_amount: 0 }
const DEFAULT_VALUES = {
  entry_date: new Date().toISOString().slice(0, 10),
  description: '',
  reference: '',
  status: 'draft',
  lines: [{ ...DEFAULT_LINE }, { ...DEFAULT_LINE }],
}

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── Journal Modal ─────────────────────────────────────────────────────────────

function JournalModal({ open, onClose, onSaved, entry, accounts }) {
  const { tenantId } = useTenant()
  const isEdit = Boolean(entry)

  const {
    register, handleSubmit, reset, control, watch, setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(journalSchema), defaultValues: DEFAULT_VALUES })

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const watchedLines = watch('lines') || []

  const totalDebit  = watchedLines.reduce((s, l) => s + Number(l.debit_amount  || 0), 0)
  const totalCredit = watchedLines.reduce((s, l) => s + Number(l.credit_amount || 0), 0)
  const balanced    = Math.abs(totalDebit - totalCredit) < 0.001 && totalDebit > 0

  useEffect(() => {
    if (!open) return
    if (entry) {
      supabase
        .from('journal_entry_lines')
        .select('*')
        .eq('journal_entry_id', entry.id)
        .order('id')
        .then(({ data }) => {
          reset({
            entry_date:  entry.entry_date  || new Date().toISOString().slice(0, 10),
            description: entry.description || '',
            reference:   entry.reference   || '',
            status:      entry.status      || 'draft',
            lines: data?.length
              ? data.map(l => ({
                  account_id:    l.account_id,
                  description:   l.description   || '',
                  debit_amount:  Number(l.debit_amount),
                  credit_amount: Number(l.credit_amount),
                }))
              : [{ ...DEFAULT_LINE }, { ...DEFAULT_LINE }],
          })
        })
    } else {
      reset(DEFAULT_VALUES)
    }
  }, [open, entry, reset])

  const onSubmit = async (data) => {
    const totalD = data.lines.reduce((s, l) => s + Number(l.debit_amount  || 0), 0)
    const totalC = data.lines.reduce((s, l) => s + Number(l.credit_amount || 0), 0)

    if (data.status === 'posted' && Math.abs(totalD - totalC) >= 0.001) {
      setError('lines', { message: 'Debits must equal credits to post the journal entry.' })
      return
    }

    const header = {
      entry_date:   data.entry_date,
      description:  data.description,
      reference:    data.reference || null,
      status:       data.status,
      total_debit:  totalD,
      total_credit: totalC,
      updated_at:   new Date().toISOString(),
    }

    if (isEdit) {
      const { error } = await supabase.from('journal_entries').update(header).eq('id', entry.id)
      if (error) { toast.error(error.message); return }

      await supabase.from('journal_entry_lines').delete().eq('journal_entry_id', entry.id)
      const lines = data.lines.map(l => ({
        tenant_id:        tenantId,
        journal_entry_id: entry.id,
        account_id:       l.account_id,
        description:      l.description || null,
        debit_amount:     Number(l.debit_amount),
        credit_amount:    Number(l.credit_amount),
      }))
      const { error: lineErr } = await supabase.from('journal_entry_lines').insert(lines)
      if (lineErr) { toast.error(lineErr.message); return }
      toast.success('Journal entry updated.')
    } else {
      const { data: num, error: numErr } = await supabase.rpc('generate_journal_entry_number')
      if (numErr) { toast.error(numErr.message); return }

      const { data: newEntry, error } = await supabase
        .from('journal_entries')
        .insert({ ...header, tenant_id: tenantId, entry_number: num })
        .select('id')
        .single()
      if (error) { toast.error(error.message); return }

      const lines = data.lines.map(l => ({
        tenant_id:        tenantId,
        journal_entry_id: newEntry.id,
        account_id:       l.account_id,
        description:      l.description || null,
        debit_amount:     Number(l.debit_amount),
        credit_amount:    Number(l.credit_amount),
      }))
      const { error: lineErr } = await supabase.from('journal_entry_lines').insert(lines)
      if (lineErr) { toast.error(lineErr.message); return }
      toast.success('Journal entry created.')
    }
    onSaved(); onClose()
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEdit ? `Edit ${entry?.entry_number}` : 'New Journal Entry'}
      size="xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-5">

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Entry Date"
              type="date"
              error={errors.entry_date?.message}
              {...register('entry_date')}
            />
            <Select label="Status" {...register('status')}>
              {Object.entries(JOURNAL_STATUS).map(([v, { label }]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </Select>
          </div>

          <Input
            label="Description"
            placeholder="e.g. Monthly accrual — June 2025"
            error={errors.description?.message}
            {...register('description')}
          />

          <Input
            label="Reference (optional)"
            placeholder="e.g. INV-2025-0001"
            {...register('reference')}
          />

          {/* Journal lines */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Journal Lines
              </p>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => append({ ...DEFAULT_LINE })}
                className="gap-1"
              >
                <PlusCircle className="w-3.5 h-3.5" />Add Line
              </Button>
            </div>

            {errors.lines && (
              <p className="text-xs text-red-500">
                {errors.lines.message || errors.lines.root?.message}
              </p>
            )}

            <div className="rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_110px_88px_88px_32px] gap-2 px-3 py-2
                              bg-slate-50 dark:bg-surface-800
                              border-b border-surface-200 dark:border-surface-700">
                {['Account', 'Note', 'Debit', 'Credit', ''].map(h => (
                  <span key={h} className="text-xs font-medium text-slate-500 dark:text-slate-400">{h}</span>
                ))}
              </div>

              {fields.map((field, i) => (
                <div
                  key={field.id}
                  className="grid grid-cols-[1fr_110px_88px_88px_32px] gap-2 px-3 py-2
                             border-b border-surface-100 dark:border-surface-800 last:border-0 items-center"
                >
                  <select
                    className="text-sm bg-transparent border-b border-surface-200 dark:border-surface-700
                               outline-none text-slate-800 dark:text-slate-200 py-0.5 min-w-0
                               cursor-pointer"
                    {...register(`lines.${i}.account_id`)}
                  >
                    <option value="">Select account…</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                    ))}
                  </select>
                  <input
                    placeholder="Note"
                    className="text-sm bg-transparent border-b border-surface-200 dark:border-surface-700
                               outline-none text-slate-800 dark:text-slate-200 py-0.5 min-w-0"
                    {...register(`lines.${i}.description`)}
                  />
                  <input
                    type="number" min="0" step="0.01" placeholder="0.00"
                    className="text-sm bg-transparent border-b border-surface-200 dark:border-surface-700
                               outline-none text-right text-slate-800 dark:text-slate-200 py-0.5 w-full"
                    {...register(`lines.${i}.debit_amount`)}
                  />
                  <input
                    type="number" min="0" step="0.01" placeholder="0.00"
                    className="text-sm bg-transparent border-b border-surface-200 dark:border-surface-700
                               outline-none text-right text-slate-800 dark:text-slate-200 py-0.5 w-full"
                    {...register(`lines.${i}.credit_amount`)}
                  />
                  <button
                    type="button"
                    onClick={() => fields.length > 2 && remove(i)}
                    disabled={fields.length <= 2}
                    className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-500/10
                               text-slate-400 hover:text-red-500 transition-colors
                               disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Balance indicator */}
            <div className="flex justify-end">
              <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border ${
                balanced
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                  : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'
              }`}>
                {balanced
                  ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                  : <AlertCircle  className="w-3.5 h-3.5 flex-shrink-0" />}
                <span className="tabular-nums">
                  Debit ${fmt(totalDebit)} · Credit ${fmt(totalCredit)}
                </span>
                {balanced && <span className="text-xs font-normal opacity-75">— Balanced</span>}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              {isEdit ? 'Save Changes' : 'Create Entry'}
            </Button>
          </div>

        </div>
      </form>
    </Modal>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Journals() {
  const { tenantId } = useTenant()
  const [entries,      setEntries]      = useState([])
  const [accounts,     setAccounts]     = useState([])
  const [total,        setTotal]        = useState(0)
  const [page,         setPage]         = useState(1)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading,      setLoading]      = useState(true)
  const [showModal,    setShowModal]    = useState(false)
  const [editEntry,    setEditEntry]    = useState(null)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const fetchEntries = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      let query = supabase
        .from('journal_entries')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('entry_date', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (statusFilter !== 'all') query = query.eq('status', statusFilter)
      if (search.trim()) {
        query = query.or(
          `entry_number.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%`
        )
      }

      const { data, count, error } = await query
      if (error) throw error
      setEntries(data || [])
      setTotal(count || 0)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId, page, search, statusFilter])

  const fetchAccounts = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name, account_type')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('code')
    setAccounts(data || [])
  }, [tenantId])

  useEffect(() => { fetchEntries() }, [fetchEntries])
  useEffect(() => { fetchAccounts() }, [fetchAccounts])
  useEffect(() => { setPage(1) }, [search, statusFilter])

  const openNew    = ()  => { setEditEntry(null); setShowModal(true) }
  const openEdit   = (e) => { setEditEntry(e);    setShowModal(true) }
  const closeModal = ()  => { setShowModal(false); setEditEntry(null) }

  const handleDelete = async (e) => {
    if (!window.confirm(`Delete journal entry ${e.entry_number}? This cannot be undone.`)) return
    await supabase.from('journal_entry_lines').delete().eq('journal_entry_id', e.id)
    const { error } = await supabase.from('journal_entries').delete().eq('id', e.id)
    if (error) { toast.error(error.message); return }
    toast.success('Journal entry deleted.')
    fetchEntries()
  }

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
              placeholder="Search by number or description…"
              className="bg-transparent text-sm text-slate-700 dark:text-slate-300
                         placeholder:text-slate-400 dark:placeholder:text-slate-600
                         flex-1 outline-none"
            />
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-surface-800">
            {JOURNAL_STATUS_TABS.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  statusFilter === s
                    ? 'bg-white dark:bg-surface-700 text-slate-800 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {s === 'all' ? 'All' : JOURNAL_STATUS[s]?.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20
                            flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-indigo-400 animate-pulse" />
            </div>
            <p className="text-sm text-slate-400">Loading journal entries…</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full bg-indigo-500/5 dark:bg-indigo-500/10 scale-[2.5]" />
              <div className="absolute inset-0 rounded-full bg-indigo-500/8 dark:bg-indigo-500/15 scale-[1.8]" />
              <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-blue-600/10
                              border border-indigo-500/20 flex items-center justify-center">
                {search || statusFilter !== 'all'
                  ? <Search className="w-9 h-9 text-slate-400" />
                  : <BookOpen className="w-9 h-9 text-indigo-400" />}
              </div>
            </div>
            <h3 className="text-base font-display font-bold text-slate-800 dark:text-slate-200 mb-1">
              {search || statusFilter !== 'all' ? 'No entries match' : 'No journal entries yet'}
            </h3>
            <p className="text-sm text-slate-500 text-center max-w-xs mb-5">
              {search || statusFilter !== 'all'
                ? 'Try adjusting your search or filter.'
                : 'Create your first journal entry for double-entry bookkeeping.'}
            </p>
            {!search && statusFilter === 'all' && (
              <PermissionGate action="create" moduleId="accounts">
                <Button size="sm" onClick={openNew} className="gap-1.5">
                  <Plus className="w-4 h-4" />New Journal Entry
                </Button>
              </PermissionGate>
            )}
          </div>
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
                  <Td>
                    <span className="text-sm text-slate-600 dark:text-slate-400">{e.entry_date}</span>
                  </Td>
                  <Td>
                    <span className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[200px] block">
                      {e.description}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-sm text-slate-500 dark:text-slate-400">{e.reference || '—'}</span>
                  </Td>
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
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          total={total}
          pageSize={PAGE_SIZE}
          label="entries"
          className="border-t border-surface-200 dark:border-surface-800"
        />
      </Card>

      <JournalModal
        open={showModal}
        onClose={closeModal}
        onSaved={fetchEntries}
        entry={editEntry}
        accounts={accounts}
      />
    </div>
  )
}
