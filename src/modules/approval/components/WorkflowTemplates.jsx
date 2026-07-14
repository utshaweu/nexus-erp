import { GitBranch, Plus, Users, CheckCircle2, Zap } from 'lucide-react'
import { Button } from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import { getModuleMeta } from './moduleMeta'

// Quick-start templates shown in the empty state
const TEMPLATES = [
  {
    name: 'Purchase Order Approval',
    module: 'purchase',
    feature: '/purchase/orders',
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
    feature: '/hr/leave',
    trigger: 'All leave requests',
    steps: [
      { step_name: 'Line Manager',  approver_role: 'manager', approval_type: 'any' },
      { step_name: 'HR Approval',   approver_role: 'admin',   approval_type: 'any' },
    ],
  },
  {
    name: 'Asset Disposal',
    module: 'assets',
    feature: '/assets/list',
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
    feature: '/sales/offers',
    trigger: 'Discount exceeds 20%',
    steps: [
      { step_name: 'Sales Manager', approver_role: 'manager', approval_type: 'any' },
    ],
  },
]

export default function WorkflowTemplates({ onCreate, onUseTemplate }) {
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
            const meta = getModuleMeta(tpl.module)
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
                  <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg mb-3" style={{ backgroundColor: `${meta.color}18` }}>
                    <Icon className="w-4 h-4" style={{ color: meta.color }} />
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
