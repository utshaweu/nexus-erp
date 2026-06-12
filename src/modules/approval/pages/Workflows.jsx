import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { GitBranch, Plus, Settings, Users, ArrowRight, Trash2 } from 'lucide-react'
import { Button, Badge, PageHeader, Card, Modal, Input, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'

const WORKFLOWS = [
  {
    id: 'WF-001', name: 'Purchase Order Approval', module: 'purchase', trigger: 'Amount > $5,000',
    active: true, steps: [
      { order: 1, name: 'Department Manager', approvers: ['Manager'], type: 'any' },
      { order: 2, name: 'Finance Review', approvers: ['CFO', 'Finance Manager'], type: 'any' },
      { order: 3, name: 'Director Sign-off', approvers: ['Director'], type: 'all' },
    ]
  },
  {
    id: 'WF-002', name: 'Leave Request', module: 'hr', trigger: 'All leave requests',
    active: true, steps: [
      { order: 1, name: 'Direct Manager', approvers: ['Line Manager'], type: 'any' },
      { order: 2, name: 'HR Confirmation', approvers: ['HR Manager'], type: 'any' },
    ]
  },
  {
    id: 'WF-003', name: 'Asset Disposal', module: 'assets', trigger: 'Asset disposal request',
    active: true, steps: [
      { order: 1, name: 'Asset Manager', approvers: ['Asset Manager'], type: 'any' },
      { order: 2, name: 'Finance Sign-off', approvers: ['CFO'], type: 'any' },
      { order: 3, name: 'CEO Approval', approvers: ['CEO'], type: 'all' },
    ]
  },
  {
    id: 'WF-004', name: 'Sales Discount > 20%', module: 'sales', trigger: 'Discount exceeds 20%',
    active: false, steps: [
      { order: 1, name: 'Sales Manager', approvers: ['Sales Manager'], type: 'any' },
    ]
  },
]

const MODULE_COLORS = {
  purchase: '#f59e0b', hr: '#ec4899', assets: '#f97316', sales: '#10b981',
}

const workflowSchema = z.object({
  name:    z.string().trim().min(1, 'Workflow name is required'),
  module:  z.string().min(1, 'Module is required'),
  trigger: z.string().trim().min(1, 'Trigger condition is required'),
})

function WorkflowCard({ workflow }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-100">{workflow.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-xs px-2 py-0.5 rounded-md font-medium"
              style={{ backgroundColor: `${MODULE_COLORS[workflow.module]}15`, color: MODULE_COLORS[workflow.module] }}
            >
              {workflow.module}
            </span>
            <span className="text-xs text-slate-500">{workflow.trigger}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge color={workflow.active ? 'green' : 'default'}>{workflow.active ? 'Active' : 'Inactive'}</Badge>
          <Button variant="ghost" size="xs"><Settings className="w-3.5 h-3.5" /></Button>
        </div>
      </div>

      <div className="space-y-2">
        {workflow.steps.map((step, i) => (
          <div key={step.order} className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-brand-600/20 border border-brand-600/40 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-brand-400">{step.order}</span>
            </div>
            <div className="flex-1 flex items-center justify-between px-3 py-2 rounded-lg bg-surface-800 border border-surface-700">
              <span className="text-xs font-medium text-slate-300">{step.name}</span>
              <div className="flex items-center gap-1.5">
                <Users className="w-3 h-3 text-slate-500" />
                <span className="text-xs text-slate-500">{step.approvers.join(', ')}</span>
                <Badge color="default">{step.type === 'any' ? 'Any' : 'All'}</Badge>
              </div>
            </div>
            {i < workflow.steps.length - 1 && (
              <ArrowRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-surface-800">
        <span className="text-xs text-slate-500">{workflow.steps.length} approval steps</span>
        <div className="flex gap-2">
          <Button variant="secondary" size="xs">Edit</Button>
          <Button variant="ghost" size="xs"><Trash2 className="w-3.5 h-3.5 text-red-400" /></Button>
        </div>
      </div>
    </Card>
  )
}

function NewWorkflowModal({ open, onClose }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(workflowSchema),
    defaultValues: { name: '', module: '', trigger: '' },
  })

  const onSubmit = async () => {
    toast.success('Workflow created.')
    reset()
    onClose()
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title="New Approval Workflow" size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          <Input label="Workflow Name" placeholder="e.g. Purchase Order Approval"
            error={errors.name?.message}
            {...register('name')} />
          <div>
            <Select label="Module" {...register('module')}>
              <option value="">Select module...</option>
              <option value="purchase">Purchase</option>
              <option value="sales">Sales</option>
              <option value="hr">HR</option>
              <option value="assets">Assets</option>
              <option value="accounts">Accounts</option>
            </Select>
            {errors.module && <p className="mt-1 text-xs text-red-400">{errors.module.message}</p>}
          </div>
          <Input label="Trigger Condition" placeholder="e.g. Amount > $5,000"
            error={errors.trigger?.message}
            {...register('trigger')} />
          <div className="p-4 rounded-lg bg-surface-800 border border-surface-700">
            <p className="text-xs text-slate-400 mb-3 font-medium">Approval Steps</p>
            <div className="space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-brand-600/20 flex items-center justify-center text-xs font-bold text-brand-400 flex-shrink-0">{i}</span>
                  <Input placeholder={`Step ${i} approver role`} className="flex-1" />
                </div>
              ))}
            </div>
            <button type="button" className="mt-2 text-xs text-brand-400 hover:text-brand-300">+ Add step</button>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>Cancel</Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>Create Workflow</Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

export default function Workflows() {
  const [showNew, setShowNew] = useState(false)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval Workflows"
        subtitle="Configure multi-level approval processes"
        breadcrumb="Approvals / Workflows"
        actions={
          <Button size="sm" onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4" />New Workflow
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {WORKFLOWS.map(wf => <WorkflowCard key={wf.id} workflow={wf} />)}
      </div>

      <NewWorkflowModal open={showNew} onClose={() => setShowNew(false)} />
    </div>
  )
}
