import { ReactFlow, Background, Controls, Handle, Position, MarkerType } from '@xyflow/react'
import '@xyflow/react/dist/style.css'

// Real per-module accent colors — same values as MODULE_META (admin/components/moduleMeta.js)
const TONE = {
  purchase: '#f59e0b',
  sales:    '#10b981',
  hr:       '#ec4899',
  assets:   '#f97316',
  accounts: '#8b5cf6',
  approved: '#10b981',
  rejected: '#ef4444',
}

function FlowNode({ data }) {
  return (
    <div
      className="px-3.5 py-2.5 rounded-xl border-2 bg-white dark:bg-surface-900 shadow-sm"
      style={{ borderColor: TONE[data.tone], width: data.width ?? 200 }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-tight">
        {data.label}
      </div>
      {data.sub && (
        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
          {data.sub}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
}

const nodeTypes = { flow: FlowNode }

// One row per record type that's wired to the approval bridge
// (src/shared/lib/approvalWorkflow.js). RFQ and Quotation feed a row via a
// same-module conversion first — they never call submitForApproval directly.
const ROWS = [
  {
    y: 0, tone: 'purchase',
    source: { id: 'rfq',  label: 'RFQ',  sub: 'purchase · status: received' },
    convertLabel: 'Convert to PO',
    record: { id: 'po', label: 'Purchase Order', sub: 'purchase' },
    approved: { label: 'PO → approved' },
    rejected: { label: 'PO → cancelled' },
  },
  {
    y: 150, tone: 'sales',
    source: { id: 'quote', label: 'Quotation', sub: 'sales · status: accepted' },
    convertLabel: 'Convert to Order',
    record: { id: 'so', label: 'Sales Order', sub: 'sales' },
    approved: { label: 'SO → confirmed' },
    rejected: { label: 'SO → cancelled' },
  },
  {
    y: 300, tone: 'hr',
    record: { id: 'leave', label: 'Leave Request', sub: 'hr' },
    approved: { label: 'Leave → approved', sub: 'deducts balance, employee → on_leave' },
    rejected: { label: 'Leave → rejected' },
  },
  {
    y: 450, tone: 'hr',
    record: { id: 'movement', label: 'Movement', sub: 'hr' },
    approved: { label: 'Movement → approved' },
    rejected: { label: 'Movement → rejected' },
  },
  {
    y: 600, tone: 'assets',
    record: { id: 'disposal', label: 'Asset Disposal', sub: 'assets' },
    approved: { label: 'Asset → disposed', sub: 'depreciation schedule cancelled' },
    rejected: { label: 'Disposal cleared', sub: 'asset stays active' },
  },
  {
    y: 750, tone: 'accounts',
    record: { id: 'bill', label: 'Bill', sub: 'accounts' },
    approved: { label: 'Bill → posted' },
    rejected: { label: 'Bill → cancelled' },
  },
]

const SOURCE_X = 0
const RECORD_X = 300
const OUTCOME_X = 660

function buildGraph() {
  const nodes = []
  const edges = []

  for (const row of ROWS) {
    nodes.push({
      id: row.record.id, type: 'flow', position: { x: RECORD_X, y: row.y },
      data: { label: row.record.label, sub: row.record.sub, tone: row.tone },
    })
    nodes.push({
      id: `${row.record.id}-approved`, type: 'flow', position: { x: OUTCOME_X, y: row.y - 42 },
      data: { label: row.approved.label, sub: row.approved.sub, tone: 'approved', width: 190 },
    })
    nodes.push({
      id: `${row.record.id}-rejected`, type: 'flow', position: { x: OUTCOME_X, y: row.y + 42 },
      data: { label: row.rejected.label, sub: row.rejected.sub, tone: 'rejected', width: 190 },
    })

    // Conditional bridge — only fires if the tenant has an active workflow
    // for this module (findActiveWorkflow in approvalWorkflow.js).
    edges.push({
      id: `${row.record.id}->approved`, source: row.record.id, target: `${row.record.id}-approved`,
      label: 'approve', style: { stroke: TONE.approved, strokeDasharray: '5 4' },
      labelStyle: { fill: TONE.approved, fontSize: 11, fontWeight: 600 },
      markerEnd: { type: MarkerType.ArrowClosed, color: TONE.approved },
    })
    edges.push({
      id: `${row.record.id}->rejected`, source: row.record.id, target: `${row.record.id}-rejected`,
      label: 'reject', style: { stroke: TONE.rejected, strokeDasharray: '5 4' },
      labelStyle: { fill: TONE.rejected, fontSize: 11, fontWeight: 600 },
      markerEnd: { type: MarkerType.ArrowClosed, color: TONE.rejected },
    })

    if (row.source) {
      nodes.push({
        id: row.source.id, type: 'flow', position: { x: SOURCE_X, y: row.y },
        data: { label: row.source.label, sub: row.source.sub, tone: row.tone },
      })
      // Deterministic — always happens on click, not conditional on a workflow.
      edges.push({
        id: `${row.source.id}->${row.record.id}`, source: row.source.id, target: row.record.id,
        label: row.convertLabel, style: { stroke: TONE[row.tone], strokeWidth: 2 },
        labelStyle: { fill: TONE[row.tone], fontSize: 11, fontWeight: 600 },
        markerEnd: { type: MarkerType.ArrowClosed, color: TONE[row.tone] },
      })
    }
  }

  return { nodes, edges }
}

const { nodes: INITIAL_NODES, edges: INITIAL_EDGES } = buildGraph()

/**
 * What happens after a record is created, and whether it needs approval.
 * Solid arrows = same-module conversions that always run on click.
 * Dashed arrows = the approval bridge — only fires if the tenant has an
 * active workflow for that module; otherwise the record's status is set
 * directly by its own module.
 */
export default function ApprovalWorkflowMap() {
  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        Solid arrow = always happens on click (same-module conversion). Dashed arrow = routes through the
        approval bridge (<code className="text-[11px]">submitForApproval</code> /{' '}
        <code className="text-[11px]">applyApprovalOutcome</code>) — only if the tenant has an active
        workflow for that module, otherwise the record's own status logic applies directly.
      </p>
      <div
        className="rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden"
        style={{ height: 860 }}
      >
        <ReactFlow
          nodes={INITIAL_NODES}
          edges={INITIAL_EDGES}
          nodeTypes={nodeTypes}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} className="!bg-surface-50 dark:!bg-surface-950" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  )
}
