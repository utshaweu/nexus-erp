import { useState, useEffect, useCallback } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  GitBranch, Plus, Settings, Users, ArrowRight, Trash2,
  ToggleLeft, ToggleRight, GripVertical, CheckCircle2,
  ShoppingCart, UserCheck, Package, DollarSign, Zap,
} from 'lucide-react'
import { Button, Badge, PageHeader, Card, Modal, Input, Select, Spinner } from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import toast from '@shared/lib/toast'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import { clsx } from 'clsx'

// ── Constants ─────────────────────────────────────────────────────────────────

const MODULE_META = {
  purchase: { label: 'Purchase',  color: '#f59e0b', bg: 'bg-amber-50  dark:bg-amber-500/10',  text: 'text-amber-600  dark:text-amber-400',  Icon: ShoppingCart },
  hr:       { label: 'HR',        color: '#ec4899', bg: 'bg-pink-50   dark:bg-pink-500/10',   text: 'text-pink-600   dark:text-pink-400',   Icon: UserCheck    },
  assets:   { label: 'Assets',    color: '#f97316', bg: 'bg-orange-50 dark:bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', Icon: Package      },
  sales:    { label: 'Sales',     color: '#10b981', bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', Icon: DollarSign },
  accounts: { label: 'Accounts',  color: '#6366f1', bg: 'bg-indigo-50 dark:bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400', Icon: DollarSign  },
}

const MODULE_OPTIONS = [
  { value: 'purchase', label: 'Purchase' },
  { value: 'sales',    label: 'Sales'    },
  { value: 'hr',       label: 'HR'       },
  { value: 'assets',   label: 'Assets'   },
  { value: 'accounts', label: 'Accounts' },
]

const ROLE_OPTIONS = [
  { value: 'owner',   label: 'Owner'   },
  { value: 'admin',   label: 'Admin'   },
  { value: 'manager', label: 'Manager' },
  { value: 'user',    label: 'User'    },
]

// Quick-start templates shown in the empty state
const TEMPLATES = [
  {
    name: 'Purchase Order Approval',
    module: 'purchase',
    trigger: 'Amount > $5,000',
    steps: [
      { step_name: 'Department Manager', approver_role: 'manager', approval_type: 'any' },
      { step_name: 'Finance Review',     approver_role: 'admin',   approval_type: 'any' },
      { step_name: 'Director Sign-off',  approver_role: 'owner',   approval_type: 'all' },
    ],
  },
  {
    name: 'Leave Request',
    module: 'hr',
    trigger: 'All leave requests',
    steps: [
      { step_name: 'Line Manager',  approver_role: 'manager', approval_type: 'any' },
      { step_name: 'HR Approval',   approver_role: 'admin',   approval_type: 'any' },
    ],
  },
  {
    name: 'Asset Disposal',
    module: 'assets',
    trigger: 'Asset disposal request',
    steps: [
      { step_name: 'Asset Manager',    approver_role: 'manager', approval_type: 'any' },
      { step_name: 'Finance Sign-off', approver_role: 'admin',   approval_type: 'any' },
      { step_name: 'CEO Approval',     approver_role: 'owner',   approval_type: 'all' },
    ],
  },
  {
    name: 'Sales Discount > 20%',
    module: 'sales',
    trigger: 'Discount exceeds 20%',
    steps: [
      { step_name: 'Sales Manager', approver_role: 'manager', approval_type: 'any' },
    ],
  },
]

// ── Validation ────────────────────────────────────────────────────────────────

const stepSchema = z.object({
  step_name:     z.string().trim().min(1, 'Step name required'),
  approver_role: z.string().trim().min(1, 'Approver required'),
  approval_type: z.enum(['any', 'all']),
})

const workflowSchema = z.object({
  name:              z.string().trim().min(1, 'Workflow name is required'),
  module:            z.string().min(1, 'Module is required'),
  trigger_condition: z.string().trim().min(1, 'Trigger condition is required'),
  steps:             z.array(stepSchema).min(1, 'At least one approval step is required'),
})

const DEFAULT_STEP = { step_name: '', approver_role: '', approval_type: 'any' }

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyStateWithTemplates({ onCreate, onUseTemplate }) {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20 mb-4">
          <GitBranch className="w-8 h-8 text-brand-600 dark:text-brand-400" />
        </div>
        <h2 className="text-lg font-display font-bold text-slate-800 dark:text-slate-100 mb-2">No workflows configured yet</h2>
        <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
          Create approval workflows to automatically route documents through the right people before they're processed.
        </p>
        <PermissionGate action="create" moduleId="approval">
          <Button onClick={onCreate}>
            <Plus className="w-4 h-4" />Create Your First Workflow
          </Button>
        </PermissionGate>
      </div>

      {/* Feature highlights */}
      <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
        {[
          { icon: Zap, label: 'Auto-routing', desc: 'Documents route automatically based on your rules' },
          { icon: Users, label: 'Multi-level', desc: 'Chain as many approval steps as you need' },
          { icon: CheckCircle2, label: 'Full audit trail', desc: 'Every decision is logged with timestamp & comment' },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="text-center p-4 rounded-xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-700">
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white dark:bg-surface-700 border border-surface-200 dark:border-surface-600 mb-2.5 shadow-sm">
              <Icon className="w-4 h-4 text-brand-500 dark:text-brand-400" />
            </div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">{label}</p>
            <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      {/* Quick-start templates */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-surface-200 dark:bg-surface-700" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Quick-start templates</span>
          <div className="h-px flex-1 bg-surface-200 dark:bg-surface-700" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TEMPLATES.map(tpl => {
            const meta = MODULE_META[tpl.module] || MODULE_META.purchase
            const { Icon } = meta
            return (
              <div
                key={tpl.name}
                className="group relative rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900/60 hover:border-brand-300 dark:hover:border-brand-600/50 hover:shadow-md dark:hover:shadow-brand-500/5 transition-all duration-200 overflow-hidden cursor-pointer"
                onClick={() => onUseTemplate(tpl)}
              >
                {/* Top accent bar */}
                <div className="h-1 w-full" style={{ backgroundColor: meta.color }} />
                <div className="p-4">
                  <div className={clsx('inline-flex items-center justify-center w-9 h-9 rounded-lg mb-3', meta.bg)}>
                    <Icon className={clsx('w-4 h-4', meta.text)} />
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1 leading-tight">{tpl.name}</p>
                  <p className="text-xs text-slate-500 mb-3">{tpl.trigger}</p>
                  <div className="flex items-center gap-1 flex-wrap">
                    {tpl.steps.map((_, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
                        {i < tpl.steps.length - 1 && <div className="w-3 h-px" style={{ backgroundColor: `${meta.color}50` }} />}
                      </div>
                    ))}
                    <span className="text-xs text-slate-400 ml-1">{tpl.steps.length} step{tpl.steps.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="px-4 pb-4">
                  <span className="text-xs font-medium text-brand-600 dark:text-brand-400 group-hover:underline">
                    Use this template →
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Workflow Card ─────────────────────────────────────────────────────────────

function WorkflowCard({ workflow, onEdit, onToggle, onDelete }) {
  const meta  = MODULE_META[workflow.module] || MODULE_META.purchase
  const steps = workflow.steps || []
  const { Icon } = meta

  return (
    <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900/60 overflow-hidden hover:shadow-md dark:hover:shadow-brand-500/5 transition-all duration-200">
      {/* Colored top accent */}
      <div className="h-1 w-full" style={{ backgroundColor: meta.color }} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', meta.bg)}>
              <Icon className={clsx('w-5 h-5', meta.text)} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 leading-tight">{workflow.name}</h3>
              {workflow.trigger_condition && (
                <p className="text-xs text-slate-500 mt-0.5">{workflow.trigger_condition}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge color={workflow.is_active ? 'green' : 'default'}>
              {workflow.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>

        {/* Steps visualization */}
        {steps.length === 0 ? (
          <p className="text-xs text-slate-400 italic mb-4">No steps configured.</p>
        ) : (
          <div className="space-y-2 mb-5">
            {steps.map((step, i) => (
              <div key={step.id || i} className="flex items-center gap-2">
                {/* Connector line */}
                <div className="flex flex-col items-center flex-shrink-0 self-stretch">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border flex-shrink-0"
                    style={{ backgroundColor: `${meta.color}18`, borderColor: `${meta.color}40`, color: meta.color }}
                  >
                    {i + 1}
                  </div>
                  {i < steps.length - 1 && (
                    <div className="w-px flex-1 mt-1" style={{ backgroundColor: `${meta.color}25` }} />
                  )}
                </div>
                <div className="flex-1 flex items-center justify-between px-3 py-2 rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 mb-0.5">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{step.step_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{step.approver_role}</span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-medium"
                      style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
                    >
                      {step.approval_type === 'any' ? 'Any' : 'All'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-surface-100 dark:border-surface-800">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              {steps.length} step{steps.length !== 1 ? 's' : ''}
            </span>
            <span className="w-1 h-1 rounded-full bg-surface-300 dark:bg-surface-600" />
            <span className={clsx('text-xs font-medium', workflow.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400')}>
              {workflow.is_active ? '● Active' : '○ Inactive'}
            </span>
          </div>
          <PermissionGate action="edit" moduleId="approval">
            <div className="flex items-center gap-1">
              <button
                onClick={() => onToggle(workflow)}
                title={workflow.is_active ? 'Deactivate' : 'Activate'}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
              >
                {workflow.is_active
                  ? <ToggleRight className="w-4 h-4 text-emerald-500" />
                  : <ToggleLeft  className="w-4 h-4" />
                }
              </button>
              <Button variant="ghost" size="xs" onClick={() => onEdit(workflow)}>
                <Settings className="w-3.5 h-3.5" />Edit
              </Button>
              <button
                onClick={() => onDelete(workflow)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </PermissionGate>
        </div>
      </div>
    </div>
  )
}

// ── Step Row in modal ─────────────────────────────────────────────────────────

function StepRow({ index, field, register, errors, onRemove, canRemove, tenantUsers }) {
  const meta = MODULE_META.purchase // default color for step numbers
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700">
      <div className="flex flex-col items-center gap-1 pt-1 flex-shrink-0">
        <GripVertical className="w-4 h-4 text-slate-300 dark:text-slate-600" />
        <div className="w-5 h-5 rounded-full bg-brand-50 dark:bg-brand-500/15 border border-brand-200 dark:border-brand-500/30 flex items-center justify-center">
          <span className="text-xs font-bold text-brand-600 dark:text-brand-400">{index + 1}</span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 gap-2 min-w-0">
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="Step name"
            error={errors.steps?.[index]?.step_name?.message}
            {...register(`steps.${index}.step_name`)}
          />
          <div>
            <select
              {...register(`steps.${index}.approver_role`)}
              className="w-full px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">Select approver...</option>
              <optgroup label="By Role">
                {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </optgroup>
              {tenantUsers.length > 0 && (
                <optgroup label="Specific User">
                  {tenantUsers.map(u => (
                    <option key={u.user_id} value={u.full_name || u.user_id}>
                      {u.full_name || u.user_id} ({u.role})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {errors.steps?.[index]?.approver_role && (
              <p className="mt-1 text-xs text-red-500">{errors.steps[index].approver_role.message}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" value="any" {...register(`steps.${index}.approval_type`)} className="accent-brand-600" />
            <span className="text-xs text-slate-600 dark:text-slate-400">Any approver</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" value="all" {...register(`steps.${index}.approval_type`)} className="accent-brand-600" />
            <span className="text-xs text-slate-600 dark:text-slate-400">All must approve</span>
          </label>
        </div>
      </div>

      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="mt-1 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex-shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

// ── Workflow Modal ────────────────────────────────────────────────────────────

function WorkflowModal({ open, onClose, onSaved, tenantId, workflow, prefill }) {
  const isEdit = Boolean(workflow)
  const [tenantUsers, setTenantUsers] = useState([])

  const {
    register, handleSubmit, reset, control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(workflowSchema),
    defaultValues: { name: '', module: '', trigger_condition: '', steps: [DEFAULT_STEP] },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'steps' })

  useEffect(() => {
    if (!open || !tenantId) return
    supabase
      .from('tenant_users')
      .select('user_id, role, full_name')
      .eq('tenant_id', tenantId).eq('is_active', true).order('full_name')
      .then(({ data }) => setTenantUsers(data || []))
  }, [open, tenantId])

  useEffect(() => {
    if (!open) return
    if (prefill) {
      reset({
        name: prefill.name, module: prefill.module,
        trigger_condition: prefill.trigger, steps: prefill.steps,
      })
    } else if (isEdit && workflow) {
      const steps = (workflow.steps || []).map(s => ({
        step_name: s.step_name, approver_role: s.approver_role, approval_type: s.approval_type || 'any',
      }))
      reset({ name: workflow.name, module: workflow.module, trigger_condition: workflow.trigger_condition || '', steps: steps.length > 0 ? steps : [DEFAULT_STEP] })
    } else {
      reset({ name: '', module: '', trigger_condition: '', steps: [DEFAULT_STEP] })
    }
  }, [open, isEdit, workflow, prefill, reset])

  const onSubmit = async (data) => {
    try {
      let workflowId = workflow?.id
      if (isEdit) {
        const { error } = await supabase.from('approval_workflows').update({
          name: data.name, module: data.module, trigger_condition: data.trigger_condition,
          updated_at: new Date().toISOString(),
        }).eq('id', workflowId)
        if (error) throw error
        await supabase.from('approval_workflow_steps').delete().eq('workflow_id', workflowId)
      } else {
        const { data: wf, error } = await supabase.from('approval_workflows').insert({
          tenant_id: tenantId, name: data.name, module: data.module,
          trigger_condition: data.trigger_condition, is_active: true,
        }).select('id').single()
        if (error) throw error
        workflowId = wf.id
      }
      const { error: sErr } = await supabase.from('approval_workflow_steps').insert(
        data.steps.map((s, i) => ({
          tenant_id: tenantId, workflow_id: workflowId,
          step_order: i + 1, step_name: s.step_name,
          approver_role: s.approver_role, approval_type: s.approval_type,
        }))
      )
      if (sErr) throw sErr
      toast.success(isEdit ? 'Workflow updated.' : 'Workflow created.')
      onSaved(); onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? 'Edit Workflow' : prefill ? `Use Template: ${prefill.name}` : 'New Approval Workflow'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4 max-h-[68vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input label="Workflow Name" placeholder="e.g. Purchase Order Approval" error={errors.name?.message} {...register('name')} />
            </div>
            <div>
              <Select label="Module" {...register('module')}>
                <option value="">Select module...</option>
                {MODULE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
              {errors.module && <p className="mt-1 text-xs text-red-500">{errors.module.message}</p>}
            </div>
            <Input label="Trigger Condition" placeholder="e.g. Amount > $5,000" error={errors.trigger_condition?.message} {...register('trigger_condition')} />
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Approval Steps
              </label>
              <span className="text-xs text-slate-400 bg-surface-100 dark:bg-surface-800 px-2 py-0.5 rounded-full">
                {fields.length} step{fields.length !== 1 ? 's' : ''}
              </span>
            </div>
            {errors.steps?.root && <p className="text-xs text-red-500 mb-2">{errors.steps.root.message}</p>}

            {/* Step flow preview */}
            {fields.length > 1 && (
              <div className="flex items-center gap-1.5 mb-3 p-3 rounded-lg bg-surface-50 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-700 overflow-x-auto">
                {fields.map((_, i) => (
                  <div key={i} className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="w-5 h-5 rounded-full bg-brand-500/20 border border-brand-500/40 flex items-center justify-center">
                      <span className="text-xs font-bold text-brand-600 dark:text-brand-400">{i + 1}</span>
                    </div>
                    {i < fields.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-slate-400" />}
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              {fields.map((field, i) => (
                <StepRow
                  key={field.id} index={i} field={field}
                  register={register} errors={errors}
                  onRemove={() => remove(i)} canRemove={fields.length > 1}
                  tenantUsers={tenantUsers}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => append(DEFAULT_STEP)}
              className="mt-3 text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 flex items-center gap-1.5 transition-colors font-medium px-2 py-1.5 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-500/10"
            >
              <Plus className="w-3.5 h-3.5" />Add step
            </button>
          </div>
        </div>

        <div className="flex gap-3 pt-4 mt-2 border-t border-surface-200 dark:border-surface-800">
          <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isSubmitting}>
            {isEdit ? 'Save Changes' : 'Create Workflow'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Delete Confirm ────────────────────────────────────────────────────────────

function DeleteModal({ open, onClose, onConfirm, workflow, loading }) {
  return (
    <Modal open={open} onClose={onClose} title="Delete Workflow" size="sm">
      <div className="space-y-4">
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20">
          <p className="text-sm text-red-700 dark:text-red-300">
            This will permanently delete <span className="font-semibold">{workflow?.name}</span> and all its steps.
            Existing requests will not be affected.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="danger" className="flex-1" loading={loading} onClick={onConfirm}>Delete Workflow</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Workflows() {
  const { tenantId } = useTenant()

  const [workflows, setWorkflows]       = useState([])
  const [loading, setLoading]           = useState(false)
  const [showModal, setShowModal]       = useState(false)
  const [editTarget, setEditTarget]     = useState(null)
  const [prefill, setPrefill]           = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]         = useState(false)

  const fetchWorkflows = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('approval_workflows')
        .select('*, steps:approval_workflow_steps(*)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
      if (error) throw error
      setWorkflows((data || []).map(wf => ({
        ...wf,
        steps: [...(wf.steps || [])].sort((a, b) => a.step_order - b.step_order),
      })))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { fetchWorkflows() }, [fetchWorkflows])

  const openNew = () => { setEditTarget(null); setPrefill(null); setShowModal(true) }
  const openEdit = (wf) => { setEditTarget(wf); setPrefill(null); setShowModal(true) }
  const useTemplate = (tpl) => { setEditTarget(null); setPrefill(tpl); setShowModal(true) }
  const closeModal  = () => { setShowModal(false); setEditTarget(null); setPrefill(null) }

  const toggleActive = async (wf) => {
    const { error } = await supabase.from('approval_workflows')
      .update({ is_active: !wf.is_active, updated_at: new Date().toISOString() })
      .eq('id', wf.id)
    if (error) { toast.error(error.message); return }
    toast.success(wf.is_active ? 'Workflow deactivated.' : 'Workflow activated.')
    fetchWorkflows()
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('approval_workflows').delete().eq('id', deleteTarget.id)
      if (error) throw error
      toast.success('Workflow deleted.')
      setDeleteTarget(null); fetchWorkflows()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval Workflows"
        subtitle="Configure multi-level approval processes for your ERP documents"
        breadcrumb="Approvals / Workflows"
        actions={
          !loading && workflows.length > 0 && (
            <PermissionGate action="create" moduleId="approval">
              <Button size="sm" onClick={openNew}>
                <Plus className="w-4 h-4" />New Workflow
              </Button>
            </PermissionGate>
          )
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner />
        </div>
      ) : workflows.length === 0 ? (
        <EmptyStateWithTemplates onCreate={openNew} onUseTemplate={useTemplate} />
      ) : (
        <>
          {/* Summary row */}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-500">{workflows.length} workflow{workflows.length !== 1 ? 's' : ''}</span>
            <span className="w-1 h-1 rounded-full bg-surface-300 dark:bg-surface-600" />
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              {workflows.filter(w => w.is_active).length} active
            </span>
            {workflows.some(w => !w.is_active) && (
              <>
                <span className="w-1 h-1 rounded-full bg-surface-300 dark:bg-surface-600" />
                <span className="text-slate-400">{workflows.filter(w => !w.is_active).length} inactive</span>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {workflows.map(wf => (
              <WorkflowCard key={wf.id} workflow={wf} onEdit={openEdit} onToggle={toggleActive} onDelete={setDeleteTarget} />
            ))}
          </div>
        </>
      )}

      <WorkflowModal
        open={showModal} onClose={closeModal} onSaved={fetchWorkflows}
        tenantId={tenantId} workflow={editTarget} prefill={prefill}
      />
      <DeleteModal
        open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete} workflow={deleteTarget} loading={deleting}
      />
    </div>
  )
}
