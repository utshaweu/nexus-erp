import { useState, useCallback, useMemo, Fragment } from 'react'
import clsx from 'clsx'
import {
  Plus, Pencil, Trash2, ListTree, ChevronRight, ChevronDown,
  Folder, FolderOpen, FileText, Maximize2, Minimize2,
} from 'lucide-react'
import { Button, Badge, Table, Thead, Th, Tbody, Tr, Td } from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import { ACCOUNT_TYPES } from '@shared/lib/constants'
import { ListEmptyState } from './ListStates'

function buildAccountTree(accounts) {
  const byId = new Map(accounts.map(a => [a.id, { ...a, children: [] }]))
  const roots = []
  for (const node of byId.values()) {
    const parent = node.parent_id && byId.get(node.parent_id)
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  const sortByCode = (nodes) => {
    nodes.sort((a, b) => a.code.localeCompare(b.code))
    nodes.forEach(n => sortByCode(n.children))
  }
  sortByCode(roots)
  return roots
}

function collectGroupIds(nodes, ids = []) {
  for (const n of nodes) {
    if (n.children.length > 0) { ids.push(n.id); collectGroupIds(n.children, ids) }
  }
  return ids
}

const GUIDE = 'border-surface-300 dark:border-surface-700'

function TreeRows({ nodes, depth, ancestorLines, collapsed, onToggle, onEdit, onDelete }) {
  return nodes.map((node, i) => {
    const isLast = i === nodes.length - 1
    const hasChildren = node.children.length > 0
    const expanded = !collapsed.has(node.id)

    return (
      <Fragment key={node.id}>
        <Tr
          onClick={() => onEdit(node)}
          className={clsx(depth === 0 && 'bg-surface-50/60 dark:bg-surface-800/30')}
        >
          <Td>
            <div className="flex items-center h-5">
              {ancestorLines.map((hasMore, idx) => (
                <span key={idx} className="relative w-5 h-5 shrink-0">
                  {hasMore && <span className={clsx('absolute left-1/2 inset-y-0 border-l', GUIDE)} />}
                </span>
              ))}
              {depth > 0 && (
                <span className="relative w-5 h-5 shrink-0">
                  <span className={clsx('absolute left-1/2 top-0 border-l', GUIDE, isLast ? 'h-1/2' : 'h-full')} />
                  <span className={clsx('absolute left-1/2 top-1/2 w-2.5 border-t', GUIDE)} />
                </span>
              )}
              {hasChildren ? (
                <button
                  onClick={e => { e.stopPropagation(); onToggle(node.id) }}
                  className="shrink-0 w-5 h-5 flex items-center justify-center rounded
                             text-slate-400 hover:text-purple-600 hover:bg-purple-100
                             dark:hover:text-purple-400 dark:hover:bg-purple-500/10"
                >
                  {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              ) : (
                <span className="shrink-0 w-5 h-5" />
              )}
              <span className="shrink-0 mr-1">
                {hasChildren
                  ? (expanded
                    ? <FolderOpen className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                    : <Folder className="w-4 h-4 text-amber-500 dark:text-amber-400" />)
                  : <FileText className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />}
              </span>
              <span className="inline-flex items-center font-mono text-xs font-medium
                               text-purple-600 dark:text-purple-400
                               bg-purple-50 dark:bg-purple-500/10
                               px-2 py-0.5 rounded-md whitespace-nowrap">
                {node.code}
              </span>
            </div>
          </Td>
          <Td>
            <span className={clsx(
              'text-slate-900 dark:text-slate-100',
              hasChildren ? 'font-semibold' : 'font-medium'
            )}>
              {node.name}
            </span>
          </Td>
          <Td>
            <Badge color={ACCOUNT_TYPES[node.account_type]?.color || 'default'}>
              {ACCOUNT_TYPES[node.account_type]?.label || node.account_type}
            </Badge>
          </Td>
          <Td>
            <Badge color={node.is_active ? 'green' : 'default'}>
              {node.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </Td>
          <Td onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-1">
              <PermissionGate action="edit" moduleId="accounts">
                <Button variant="ghost" size="xs" onClick={() => onEdit(node)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </PermissionGate>
              <PermissionGate action="delete" moduleId="accounts">
                <Button variant="danger" size="xs" onClick={() => onDelete(node)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </PermissionGate>
            </div>
          </Td>
        </Tr>
        {expanded && hasChildren && (
          <TreeRows
            nodes={node.children} depth={depth + 1} ancestorLines={[...ancestorLines, !isLast]}
            collapsed={collapsed} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete}
          />
        )}
      </Fragment>
    )
  })
}

/** Hierarchical (parent_id-based) view of the chart of accounts, as an alternative to the flat paginated list. */
export default function AccountTree({ accounts, onEdit, onDelete, onNew }) {
  const [collapsed, setCollapsed] = useState(() => new Set())
  const tree = useMemo(() => buildAccountTree(accounts), [accounts])
  const toggle = useCallback(id => {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])
  const expandAll = useCallback(() => setCollapsed(new Set()), [])
  const collapseAll = useCallback(() => setCollapsed(new Set(collectGroupIds(tree))), [tree])

  if (accounts.length === 0) {
    return (
      <ListEmptyState
        color="purple" icon={ListTree} searching={false}
        title="No accounts yet" description="Add your first account to build the chart of accounts."
        action={
          <PermissionGate action="create" moduleId="accounts">
            <Button size="sm" onClick={onNew} className="gap-1.5">
              <Plus className="w-4 h-4" />Add First Account
            </Button>
          </PermissionGate>
        }
      />
    )
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1 px-4 py-2 border-b border-surface-200 dark:border-surface-800">
        <Button variant="ghost" size="xs" onClick={expandAll} className="gap-1.5">
          <Maximize2 className="w-3.5 h-3.5" />Expand all
        </Button>
        <Button variant="ghost" size="xs" onClick={collapseAll} className="gap-1.5">
          <Minimize2 className="w-3.5 h-3.5" />Collapse all
        </Button>
      </div>
      <Table>
        <Thead>
          <Th>Code</Th>
          <Th>Account Name</Th>
          <Th>Type</Th>
          <Th>Status</Th>
          <Th></Th>
        </Thead>
        <Tbody>
          <TreeRows nodes={tree} depth={0} ancestorLines={[]} collapsed={collapsed} onToggle={toggle} onEdit={onEdit} onDelete={onDelete} />
        </Tbody>
      </Table>
    </>
  )
}
