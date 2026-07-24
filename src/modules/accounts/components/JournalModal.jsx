import { useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PlusCircle, Minus, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button, Modal, Input, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { JOURNAL_STATUS } from '@shared/lib/constants'
import { fetchJournalEntryLines, saveJournalEntry } from '../api/journals'

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
  description: '', reference: '', status: 'draft',
  lines: [{ ...DEFAULT_LINE }, { ...DEFAULT_LINE }],
}

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function JournalModal({ open, onClose, onSaved, entry, accounts }) {
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
      fetchJournalEntryLines(entry.id).then(lines => {
        reset({
          entry_date:  entry.entry_date  || new Date().toISOString().slice(0, 10),
          description: entry.description || '',
          reference:   entry.reference   || '',
          status:      entry.status      || 'draft',
          lines: lines.length
            ? lines.map(l => ({
                account_id: l.account_id, description: l.description || '',
                debit_amount: Number(l.debit_amount), credit_amount: Number(l.credit_amount),
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
    try {
      await saveJournalEntry(tenantId, entry, data)
      toast.success(isEdit ? 'Journal entry updated.' : 'Journal entry created.')
      onSaved(); onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? `Edit ${entry?.entry_number}` : 'New Journal Entry'} size="xl">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-5">

          <div className="grid grid-cols-2 gap-4">
            <Input label="Entry Date" type="date" error={errors.entry_date?.message} {...register('entry_date')} />
            <Select label="Status" {...register('status')}>
              {Object.entries(JOURNAL_STATUS).map(([v, { label }]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </Select>
          </div>

          <Input label="Description" placeholder="e.g. Monthly accrual — June 2025" error={errors.description?.message} {...register('description')} />
          <Input label="Reference (optional)" placeholder="e.g. INV-2025-0001" {...register('reference')} />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Journal Lines
              </p>
              <Button type="button" variant="ghost" size="xs" onClick={() => append({ ...DEFAULT_LINE })} className="gap-1">
                <PlusCircle className="w-3.5 h-3.5" />Add Line
              </Button>
            </div>

            {errors.lines && (
              <p className="text-xs text-red-500">{errors.lines.message || errors.lines.root?.message}</p>
            )}

            <div className="rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden">
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
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>Cancel</Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              {isEdit ? 'Save Changes' : 'Create Entry'}
            </Button>
          </div>

        </div>
      </form>
    </Modal>
  )
}
