import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Modal, Input, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { createRequest, fetchActiveWorkflowsForModule } from '../api/approvalRequests'
import { useApprovalModuleOptions } from '../hooks/useApprovalModuleOptions'
import { getModuleFeatureOptions } from './moduleMeta'

const requestSchema = z.object({
  title:       z.string().trim().min(1, 'Title is required'),
  description: z.string().optional(),
  module:      z.string().min(1, 'Module is required'),
  feature:     z.string().min(1, 'Feature is required'),
  workflow_id: z.string().optional(),
  amount:      z.coerce.number({ invalid_type_error: 'Enter a valid amount' }).min(0).optional().or(z.literal('')),
  priority:    z.enum(['low', 'normal', 'high', 'urgent']),
  record_type: z.string().optional(),
})

const DEFAULT_VALUES = {
  title: '', description: '', module: '', feature: '', workflow_id: '',
  amount: '', priority: 'normal', record_type: '',
}

const TEXTAREA_CLS =
  'w-full px-3 py-2 rounded-lg text-sm resize-none ' +
  'text-slate-700 dark:text-slate-200 ' +
  'placeholder:text-slate-400 dark:placeholder:text-slate-600 ' +
  'bg-white dark:bg-surface-900 ' +
  'border border-surface-200 dark:border-surface-700 ' +
  'focus:outline-none focus:ring-1 focus:ring-brand-500'

export default function NewRequestModal({ open, onClose, onSaved, tenantId }) {
  const [workflows, setWorkflows] = useState([])
  const userId = window.__erp_user__?.id
  const moduleOptions = useApprovalModuleOptions()

  const {
    register, handleSubmit, reset, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(requestSchema), defaultValues: DEFAULT_VALUES })

  const watchedModule = watch('module')
  const featureOptions = getModuleFeatureOptions(watchedModule)
  const moduleFieldReg = register('module')

  useEffect(() => {
    if (!open) { reset(DEFAULT_VALUES); setWorkflows([]); return }
  }, [open, reset])

  useEffect(() => {
    if (!watchedModule || !tenantId) { setWorkflows([]); return }
    fetchActiveWorkflowsForModule(tenantId, watchedModule).then(setWorkflows)
  }, [watchedModule, tenantId])

  const onSubmit = async (data) => {
    try {
      await createRequest(tenantId, userId, data)
      toast.success('Request submitted.')
      onSaved(); onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleClose = () => { reset(DEFAULT_VALUES); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title="New Approval Request" size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          <Input label="Title" placeholder="e.g. Q1 Budget Approval" error={errors.title?.message} {...register('title')} />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Select
                label="Module"
                {...moduleFieldReg}
                onChange={(e) => { moduleFieldReg.onChange(e); setValue('feature', '') }}
              >
                <option value="">Select module...</option>
                {moduleOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
              {errors.module && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.module.message}</p>}
            </div>
            <div>
              <Select label="Feature" disabled={!watchedModule} {...register('feature')}>
                <option value="">{watchedModule ? 'Select feature...' : 'Select a module first'}</option>
                {featureOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
              {errors.feature && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.feature.message}</p>}
            </div>
          </div>

          {workflows.length > 0 && (
            <Select label="Workflow (optional)" {...register('workflow_id')}>
              <option value="">Auto-detect</option>
              {workflows.map(wf => <option key={wf.id} value={wf.id}>{wf.name}</option>)}
            </Select>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Select label="Priority" {...register('priority')}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
            <Input label="Amount (optional)" type="number" min="0" step="0.01" placeholder="0.00" error={errors.amount?.message} {...register('amount')} />
          </div>

          <Input label="Record Type (optional)" placeholder="e.g. purchase_order, leave_request" {...register('record_type')} />

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
              Description
            </label>
            <textarea rows={3} className={TEXTAREA_CLS} placeholder="Provide context for this request..." {...register('description')} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>Cancel</Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>Submit Request</Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
