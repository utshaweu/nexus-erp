import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, ArrowRight } from 'lucide-react'
import { Button, Modal, Input, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { saveWorkflow, fetchTenantUsers } from '../api/approvalWorkflows'
import { useApprovalModuleOptions } from '../hooks/useApprovalModuleOptions'
import { getModuleFeatureOptions } from './moduleMeta'
import WorkflowStepRow from './WorkflowStepRow'

const stepSchema = z.object({
  step_name:     z.string().trim().min(1, 'Step name required'),
  approver_role: z.string().trim().min(1, 'Approver required'),
  approval_type: z.enum(['any', 'all']),
})

const workflowSchema = z.object({
  name:              z.string().trim().min(1, 'Workflow name is required'),
  module:            z.string().min(1, 'Module is required'),
  feature:           z.string().trim().min(1, 'Feature is required'),
  trigger_condition: z.string().trim().min(1, 'Trigger condition is required'),
  steps:             z.array(stepSchema).min(1, 'At least one approval step is required'),
})

const DEFAULT_STEP = { step_name: '', approver_role: '', approval_type: 'any' }

export default function WorkflowModal({ open, onClose, onSaved, tenantId, workflow, prefill }) {
  const isEdit = Boolean(workflow)
  const [tenantUsers, setTenantUsers] = useState([])
  const [dragIndex, setDragIndex] = useState(null)
  const moduleOptions = useApprovalModuleOptions()

  const {
    register, handleSubmit, reset, control, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(workflowSchema),
    defaultValues: { name: '', module: '', feature: '', trigger_condition: '', steps: [DEFAULT_STEP] },
  })

  const { fields, append, remove, move } = useFieldArray({ control, name: 'steps' })

  // Feature options cascade from the selected module's own menu items, so the
  // list always matches whatever pages that module actually exposes.
  const selectedModule = watch('module')
  const featureOptions = getModuleFeatureOptions(selectedModule)
  const moduleFieldReg = register('module')

  const handleStepDrop = (dropIndex) => {
    if (dragIndex === null || dragIndex === dropIndex) { setDragIndex(null); return }
    move(dragIndex, dropIndex)
    setDragIndex(null)
  }

  useEffect(() => {
    if (!open || !tenantId) return
    fetchTenantUsers(tenantId).then(setTenantUsers)
  }, [open, tenantId])

  useEffect(() => {
    if (!open) return
    if (prefill) {
      reset({
        name: prefill.name, module: prefill.module, feature: prefill.feature || '',
        trigger_condition: prefill.trigger, steps: prefill.steps,
      })
    } else if (isEdit && workflow) {
      const steps = (workflow.steps || []).map(s => ({
        step_name: s.step_name, approver_role: s.approver_role, approval_type: s.approval_type || 'any',
      }))
      reset({
        name: workflow.name, module: workflow.module, feature: workflow.feature || '',
        trigger_condition: workflow.trigger_condition || '', steps: steps.length > 0 ? steps : [DEFAULT_STEP],
      })
    } else {
      reset({ name: '', module: '', feature: '', trigger_condition: '', steps: [DEFAULT_STEP] })
    }
  }, [open, isEdit, workflow, prefill, reset])

  const onSubmit = async (data) => {
    try {
      await saveWorkflow(tenantId, workflow, data)
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
              <Select
                label="Module"
                {...moduleFieldReg}
                onChange={(e) => { moduleFieldReg.onChange(e); setValue('feature', '') }}
              >
                <option value="">Select module...</option>
                {moduleOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
              {errors.module && <p className="mt-1 text-xs text-red-500">{errors.module.message}</p>}
              {moduleOptions.length === 0 && (
                <p className="mt-1 text-xs text-slate-400">No modules installed yet — install one from the App Store first.</p>
              )}
            </div>
            <div>
              <Select label="Feature" disabled={!selectedModule} {...register('feature')}>
                <option value="">{selectedModule ? 'Select feature...' : 'Select a module first'}</option>
                {featureOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
              {errors.feature && <p className="mt-1 text-xs text-red-500">{errors.feature.message}</p>}
            </div>
            <div className="col-span-2">
              <Input label="Trigger Condition" placeholder="e.g. Amount > $5,000" error={errors.trigger_condition?.message} {...register('trigger_condition')} />
            </div>
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
                <WorkflowStepRow
                  key={field.id} index={i}
                  register={register} errors={errors}
                  onRemove={() => remove(i)} canRemove={fields.length > 1}
                  tenantUsers={tenantUsers}
                  isDragging={dragIndex === i}
                  onDragStart={() => setDragIndex(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); handleStepDrop(i) }}
                  onDragEnd={() => setDragIndex(null)}
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
