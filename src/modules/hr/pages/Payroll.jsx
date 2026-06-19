import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, DollarSign, Eye, Check, Pencil, Trash2, X } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card,
  CardHeader, CardTitle, CardContent, Modal, Input, Select, EmptyState,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import useStore from '@core/store/useStore'
import {
  PAGE_SIZE_TABLE as PAGE_SIZE,
  PAYROLL_RUN_STATUS,
  PAYROLL_RUN_STATUS_TABS,
} from '@shared/lib/constants'

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']

const fmt = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const currentYear  = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

// ── Payroll Run Modal (Create) ────────────────────────────────────────────────

const runSchema = z.object({
  period_month: z.coerce.number().int().min(1).max(12),
  period_year:  z.coerce.number().int().min(2000).max(2100),
  notes:        z.string().optional(),
})

function PayrollRunModal({ open, onClose, onSaved }) {
  const { tenantId } = useTenant()
  const session      = useStore(s => s.session)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm({
      resolver: zodResolver(runSchema),
      defaultValues: { period_month: currentMonth, period_year: currentYear, notes: '' },
    })

  useEffect(() => {
    if (!open) return
    reset({ period_month: currentMonth, period_year: currentYear, notes: '' })
  }, [open, reset])

  const onSubmit = async (data) => {
    const { data: num, error: numErr } = await supabase.rpc('generate_payroll_run_number')
    if (numErr) { toast.error(numErr.message); return }

    const { error } = await supabase.from('hr_payroll_runs').insert({
      tenant_id:    tenantId,
      run_number:   num,
      period_month: parseInt(data.period_month),
      period_year:  parseInt(data.period_year),
      notes:        data.notes || null,
      status:       'draft',
      created_by:   session?.user?.id || null,
    })
    if (error) { toast.error(error.message); return }
    toast.success('Payroll run created.')
    onSaved(); onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="New Payroll Run" size="sm">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Month" error={errors.period_month?.message} {...register('period_month')}>
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </Select>
          <Input
            label="Year"
            type="number" min="2000" max="2100"
            error={errors.period_year?.message}
            {...register('period_year')}
          />
        </div>
        <Input label="Notes (optional)" placeholder="Any notes for this payroll run" {...register('notes')} />
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isSubmitting}>Create Run</Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Payroll Entry Modal (per-employee) ────────────────────────────────────────

const entrySchema = z.object({
  employee_id:  z.string().min(1, 'Employee is required'),
  basic_salary: z.coerce.number().min(0, 'Must be 0 or more'),
  allowances:   z.coerce.number().min(0, 'Must be 0 or more'),
  deductions:   z.coerce.number().min(0, 'Must be 0 or more'),
  notes:        z.string().optional(),
})

function PayrollEntryModal({ open, onClose, onSaved, runId, tenantId, employees, entry }) {
  const isEdit = Boolean(entry)

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } =
    useForm({
      resolver: zodResolver(entrySchema),
      defaultValues: { employee_id: '', basic_salary: 0, allowances: 0, deductions: 0, notes: '' },
    })

  const basic      = parseFloat(watch('basic_salary')) || 0
  const allowances = parseFloat(watch('allowances'))   || 0
  const deductions = parseFloat(watch('deductions'))   || 0
  const gross      = basic + allowances
  const net        = Math.max(0, gross - deductions)

  useEffect(() => {
    if (!open) return
    reset(entry
      ? {
          employee_id:  entry.employee_id,
          basic_salary: entry.basic_salary,
          allowances:   entry.allowances,
          deductions:   entry.deductions,
          notes:        entry.notes || '',
        }
      : { employee_id: '', basic_salary: 0, allowances: 0, deductions: 0, notes: '' }
    )
  }, [open, entry, reset])

  const onSubmit = async (data) => {
    const payload = {
      basic_salary:  parseFloat(data.basic_salary) || 0,
      allowances:    parseFloat(data.allowances)   || 0,
      deductions:    parseFloat(data.deductions)   || 0,
      gross_salary:  gross,
      net_salary:    net,
      notes:         data.notes || null,
    }

    if (isEdit) {
      const { error } = await supabase.from('hr_payroll_entries').update(payload).eq('id', entry.id)
      if (error) { toast.error(error.message); return }
    } else {
      const { error } = await supabase.from('hr_payroll_entries').insert({
        ...payload,
        tenant_id:     tenantId,
        payroll_run_id: runId,
        employee_id:   data.employee_id,
      })
      if (error) { toast.error(error.message); return }
    }

    // Recalculate run totals
    const { data: entries } = await supabase
      .from('hr_payroll_entries')
      .select('gross_salary, deductions, net_salary')
      .eq('payroll_run_id', runId)

    if (entries) {
      const totalGross = entries.reduce((s, e) => s + (e.gross_salary || 0), 0)
      const totalDeductions = entries.reduce((s, e) => s + (e.deductions || 0), 0)
      const totalNet   = entries.reduce((s, e) => s + (e.net_salary   || 0), 0)
      await supabase.from('hr_payroll_runs')
        .update({ total_gross: totalGross, total_deductions: totalDeductions, total_net: totalNet, updated_at: new Date().toISOString() })
        .eq('id', runId)
    }

    toast.success(isEdit ? 'Entry updated.' : 'Employee added to payroll.')
    onSaved(); onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Payroll Entry' : 'Add Employee to Payroll'} size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {!isEdit && (
          <Select label="Employee" error={errors.employee_id?.message} {...register('employee_id')}>
            <option value="">— Select employee —</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>
                {e.first_name} {e.last_name} ({e.employee_number})
              </option>
            ))}
          </Select>
        )}
        {isEdit && entry && (
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Editing entry for: {employees.find(e => e.id === entry.employee_id)?.first_name || '—'}
          </p>
        )}

        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Basic Salary"
            type="number" min="0" step="0.01"
            error={errors.basic_salary?.message}
            {...register('basic_salary')}
          />
          <Input
            label="Allowances"
            type="number" min="0" step="0.01"
            error={errors.allowances?.message}
            {...register('allowances')}
          />
          <Input
            label="Deductions"
            type="number" min="0" step="0.01"
            error={errors.deductions?.message}
            {...register('deductions')}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-slate-50 dark:bg-surface-800 text-sm">
          <div>
            <span className="text-slate-500">Gross Salary</span>
            <p className="font-bold text-slate-900 dark:text-slate-100">${fmt(gross)}</p>
          </div>
          <div>
            <span className="text-slate-500">Net Salary</span>
            <p className="font-bold text-pink-600 dark:text-pink-400">${fmt(net)}</p>
          </div>
        </div>

        <Input label="Notes (optional)" placeholder="e.g. includes bonus" {...register('notes')} />

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isSubmitting}>
            {isEdit ? 'Save Changes' : 'Add to Payroll'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Payroll Run Detail Modal ──────────────────────────────────────────────────

function RunDetailModal({ open, onClose, run, tenantId }) {
  const [entries,     setEntries]    = useState([])
  const [employees,   setEmployees]  = useState([])
  const [loading,     setLoading]    = useState(true)
  const [showAddEntry,setShowAdd]    = useState(false)
  const [editEntry,   setEditEntry]  = useState(null)
  const session                      = useStore(s => s.session)

  const fetchEntries = useCallback(async () => {
    if (!run?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('hr_payroll_entries')
      .select('*, hr_employees(first_name, last_name, employee_number, hr_departments(name))')
      .eq('payroll_run_id', run.id)
      .order('created_at')
    setEntries(data || [])
    setLoading(false)
  }, [run?.id])

  const fetchEmployees = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase
      .from('hr_employees')
      .select('id, first_name, last_name, employee_number, basic_salary')
      .eq('tenant_id', tenantId)
      .in('status', ['active', 'on_leave'])
      .order('first_name')
    setEmployees(data || [])
  }, [tenantId])

  useEffect(() => {
    if (open) { fetchEntries(); fetchEmployees() }
  }, [open, fetchEntries, fetchEmployees])

  const handleDeleteEntry = async (entry) => {
    if (!window.confirm('Remove this employee from payroll?')) return
    const { error } = await supabase.from('hr_payroll_entries').delete().eq('id', entry.id)
    if (error) { toast.error(error.message); return }

    // Recalculate run totals
    const { data: remaining } = await supabase
      .from('hr_payroll_entries')
      .select('gross_salary, deductions, net_salary')
      .eq('payroll_run_id', run.id)
    const totalGross = (remaining || []).reduce((s, e) => s + (e.gross_salary || 0), 0)
    const totalDeductions = (remaining || []).reduce((s, e) => s + (e.deductions || 0), 0)
    const totalNet   = (remaining || []).reduce((s, e) => s + (e.net_salary   || 0), 0)
    await supabase.from('hr_payroll_runs')
      .update({ total_gross: totalGross, total_deductions: totalDeductions, total_net: totalNet })
      .eq('id', run.id)

    toast.success('Entry removed.')
    fetchEntries()
  }

  const handleApprove = async () => {
    if (!window.confirm('Approve this payroll run? This confirms all entries.')) return
    const { error } = await supabase.from('hr_payroll_runs').update({
      status:      'approved',
      approved_by: session?.user?.id || null,
      approved_at: new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    }).eq('id', run.id)
    if (error) { toast.error(error.message); return }
    toast.success('Payroll run approved.')
    onClose()
  }

  const handleMarkPaid = async () => {
    if (!window.confirm('Mark this payroll run as paid?')) return
    const { error } = await supabase.from('hr_payroll_runs').update({
      status:     'paid',
      updated_at: new Date().toISOString(),
    }).eq('id', run.id)
    if (error) { toast.error(error.message); return }
    toast.success('Payroll run marked as paid.')
    onClose()
  }

  if (!run) return null

  const s = PAYROLL_RUN_STATUS[run.status]
  const isDraft    = run.status === 'draft'
  const isApproved = run.status === 'approved'

  // Employees not yet in this run
  const existingEmployeeIds = new Set(entries.map(e => e.employee_id))
  const availableEmployees = employees.filter(e => !existingEmployeeIds.has(e.id))

  return (
    <Modal open={open} onClose={onClose} title={`Payroll Run — ${run.run_number}`} size="xl">
      <div className="space-y-5">
        {/* Header strip */}
        <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-surface-800">
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Period</p>
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              {MONTHS[(run.period_month || 1) - 1]} {run.period_year}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Status</p>
            <Badge color={s?.color || 'default'}>{s?.label || run.status}</Badge>
          </div>
          <div className="ml-auto grid grid-cols-3 gap-6 text-right">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Gross</p>
              <p className="font-bold text-slate-900 dark:text-slate-100">${fmt(run.total_gross)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Deductions</p>
              <p className="font-bold text-red-600 dark:text-red-400">-${fmt(run.total_deductions)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Net</p>
              <p className="font-bold text-pink-600 dark:text-pink-400">${fmt(run.total_net)}</p>
            </div>
          </div>
        </div>

        {/* Entries table */}
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Payroll Entries ({entries.length})
          </h4>
          {isDraft && availableEmployees.length > 0 && (
            <PermissionGate action="create" moduleId="hr">
              <Button size="sm" onClick={() => setShowAdd(true)}>
                <Plus className="w-4 h-4" />Add Employee
              </Button>
            </PermissionGate>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400">Loading entries…</div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            No employees in this payroll run yet.{isDraft && ' Click "Add Employee" to begin.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <Thead>
                <Th>Employee</Th>
                <Th>Department</Th>
                <Th>Basic</Th>
                <Th>Allowances</Th>
                <Th>Deductions</Th>
                <Th>Gross</Th>
                <Th>Net</Th>
                {isDraft && <Th></Th>}
              </Thead>
              <Tbody>
                {entries.map(e => {
                  const emp = e.hr_employees
                  return (
                    <Tr key={e.id}>
                      <Td>
                        <div>
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {emp ? `${emp.first_name} ${emp.last_name}` : '—'}
                          </span>
                          {emp?.employee_number && (
                            <p className="text-xs font-mono text-slate-500">{emp.employee_number}</p>
                          )}
                        </div>
                      </Td>
                      <Td>
                        <span className="text-slate-500 dark:text-slate-400 text-sm">
                          {emp?.hr_departments?.name || '—'}
                        </span>
                      </Td>
                      <Td><span className="font-mono text-sm">${fmt(e.basic_salary)}</span></Td>
                      <Td><span className="font-mono text-sm text-green-600 dark:text-green-400">+${fmt(e.allowances)}</span></Td>
                      <Td><span className="font-mono text-sm text-red-600 dark:text-red-400">-${fmt(e.deductions)}</span></Td>
                      <Td><span className="font-mono text-sm">${fmt(e.gross_salary)}</span></Td>
                      <Td><span className="font-mono text-sm font-bold text-pink-600 dark:text-pink-400">${fmt(e.net_salary)}</span></Td>
                      {isDraft && (
                        <Td onClick={ev => ev.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <PermissionGate action="edit" moduleId="hr">
                              <Button variant="ghost" size="xs" onClick={() => setEditEntry(e)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            </PermissionGate>
                            <PermissionGate action="delete" moduleId="hr">
                              <Button variant="danger" size="xs" onClick={() => handleDeleteEntry(e)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </PermissionGate>
                          </div>
                        </Td>
                      )}
                    </Tr>
                  )
                })}
              </Tbody>
            </Table>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-surface-200 dark:border-surface-800">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {isDraft && entries.length > 0 && (
            <PermissionGate action="approve" moduleId="hr">
              <Button onClick={handleApprove}>
                <Check className="w-4 h-4" />Approve Run
              </Button>
            </PermissionGate>
          )}
          {isApproved && (
            <PermissionGate action="approve" moduleId="hr">
              <Button onClick={handleMarkPaid}>
                <DollarSign className="w-4 h-4" />Mark as Paid
              </Button>
            </PermissionGate>
          )}
        </div>
      </div>

      {/* Add employee to run */}
      <PayrollEntryModal
        open={showAddEntry}
        onClose={() => setShowAdd(false)}
        onSaved={() => { setShowAdd(false); fetchEntries() }}
        runId={run.id}
        tenantId={tenantId}
        employees={availableEmployees}
        entry={null}
      />

      {/* Edit entry */}
      <PayrollEntryModal
        open={Boolean(editEntry)}
        onClose={() => setEditEntry(null)}
        onSaved={() => { setEditEntry(null); fetchEntries() }}
        runId={run.id}
        tenantId={tenantId}
        employees={employees}
        entry={editEntry}
      />
    </Modal>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Payroll() {
  const { tenantId }   = useTenant()
  const [runs,         setRuns]        = useState([])
  const [total,        setTotal]       = useState(0)
  const [page,         setPage]        = useState(1)
  const [search,       setSearch]      = useState('')
  const [statusFilter, setStatusFilter]= useState('all')
  const [loading,      setLoading]     = useState(true)
  const [showModal,    setShowModal]   = useState(false)
  const [viewRun,      setViewRun]     = useState(null)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const fetchRuns = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      let query = supabase
        .from('hr_payroll_runs')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('period_year',  { ascending: false })
        .order('period_month', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (statusFilter !== 'all') query = query.eq('status', statusFilter)
      if (search.trim()) query = query.ilike('run_number', `%${search.trim()}%`)

      const { data, count, error } = await query
      if (error) throw error
      setRuns(data || [])
      setTotal(count || 0)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId, page, search, statusFilter])

  useEffect(() => { fetchRuns() }, [fetchRuns])
  useEffect(() => { setPage(1) }, [search, statusFilter])

  const handleDelete = async (run) => {
    if (run.status !== 'draft') {
      toast.error('Only draft payroll runs can be deleted.')
      return
    }
    if (!window.confirm(`Delete payroll run ${run.run_number}? All entries will be removed.`)) return
    const { error } = await supabase.from('hr_payroll_runs').delete().eq('id', run.id)
    if (error) { toast.error(error.message); return }
    toast.success('Payroll run deleted.')
    fetchRuns()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        subtitle="Manage monthly payroll runs"
        breadcrumb="HR / Payroll"
        actions={
          <PermissionGate action="create" moduleId="hr">
            <Button size="sm" onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4" />New Payroll Run
            </Button>
          </PermissionGate>
        }
      />

      <Card>
        <div className="flex items-center gap-3 p-4 border-b border-surface-200 dark:border-surface-800 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-xs
                          px-3 py-2 rounded-lg bg-slate-50 dark:bg-surface-800
                          border border-surface-200 dark:border-surface-700">
            <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search run number…"
              className="bg-transparent text-sm text-slate-700 dark:text-slate-300
                         placeholder:text-slate-400 dark:placeholder:text-slate-600 flex-1 outline-none"
            />
          </div>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-surface-800">
            {PAYROLL_RUN_STATUS_TABS.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  statusFilter === s
                    ? 'bg-white dark:bg-surface-700 text-slate-800 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {s === 'all' ? 'All' : PAYROLL_RUN_STATUS[s]?.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <DollarSign className="w-8 h-8 text-pink-400 animate-pulse" />
            <p className="text-sm text-slate-400">Loading payroll runs…</p>
          </div>
        ) : runs.length === 0 ? (
          <EmptyState
            icon={DollarSign}
            title={search || statusFilter !== 'all' ? 'No runs match' : 'No payroll runs yet'}
            description={
              search || statusFilter !== 'all'
                ? 'Try adjusting your search or filter.'
                : 'Create your first monthly payroll run.'
            }
            action={!search && statusFilter === 'all' && (
              <PermissionGate action="create" moduleId="hr">
                <Button size="sm" onClick={() => setShowModal(true)}>
                  <Plus className="w-4 h-4" />New Payroll Run
                </Button>
              </PermissionGate>
            )}
          />
        ) : (
          <Table>
            <Thead>
              <Th>Run #</Th>
              <Th>Period</Th>
              <Th>Total Gross</Th>
              <Th>Total Deductions</Th>
              <Th>Total Net</Th>
              <Th>Status</Th>
              <Th></Th>
            </Thead>
            <Tbody>
              {runs.map(run => {
                const s = PAYROLL_RUN_STATUS[run.status]
                return (
                  <Tr key={run.id}>
                    <Td>
                      <span className="font-mono text-xs font-medium
                                       text-pink-600 dark:text-pink-400
                                       bg-pink-50 dark:bg-pink-500/10
                                       px-2 py-0.5 rounded-md">
                        {run.run_number}
                      </span>
                    </Td>
                    <Td>
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {MONTHS[(run.period_month || 1) - 1]} {run.period_year}
                      </span>
                    </Td>
                    <Td><span className="font-mono text-sm">${fmt(run.total_gross)}</span></Td>
                    <Td><span className="font-mono text-sm text-red-600 dark:text-red-400">-${fmt(run.total_deductions)}</span></Td>
                    <Td><span className="font-mono text-sm font-bold text-pink-600 dark:text-pink-400">${fmt(run.total_net)}</span></Td>
                    <Td><Badge color={s?.color || 'default'}>{s?.label || run.status}</Badge></Td>
                    <Td onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="xs" onClick={() => setViewRun(run)}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        {run.status === 'draft' && (
                          <PermissionGate action="delete" moduleId="hr">
                            <Button variant="danger" size="xs" onClick={() => handleDelete(run)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </PermissionGate>
                        )}
                      </div>
                    </Td>
                  </Tr>
                )
              })}
            </Tbody>
          </Table>
        )}

        <Pagination
          page={page} totalPages={totalPages} onPageChange={setPage}
          total={total} pageSize={PAGE_SIZE} label="payroll runs"
          className="border-t border-surface-200 dark:border-surface-800"
        />
      </Card>

      <PayrollRunModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSaved={() => { setShowModal(false); fetchRuns() }}
      />

      <RunDetailModal
        open={Boolean(viewRun)}
        onClose={() => { setViewRun(null); fetchRuns() }}
        run={viewRun}
        tenantId={tenantId}
      />
    </div>
  )
}
