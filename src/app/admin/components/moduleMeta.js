// All available module IDs (must match manifest ids)
export const ALL_MODULE_IDS = [
  'purchase', 'sales', 'inventory', 'accounts',
  'hr', 'configuration', 'reports', 'assets', 'approval',
]

export const MODULE_META = {
  purchase:      { label: 'Purchase',      color: '#f59e0b', emoji: '🛒' },
  sales:         { label: 'Sales',         color: '#10b981', emoji: '📈' },
  inventory:     { label: 'Inventory',     color: '#3b82f6', emoji: '📦' },
  accounts:      { label: 'Accounts',      color: '#8b5cf6', emoji: '💰' },
  hr:            { label: 'HR',            color: '#ec4899', emoji: '👥' },
  configuration: { label: 'Configuration', color: '#64748b', emoji: '⚙️'  },
  reports:       { label: 'Reports',       color: '#a855f7', emoji: '📊' },
  assets:        { label: 'Assets',        color: '#f97316', emoji: '🖥️'  },
  approval:      { label: 'Approvals',     color: '#06b6d4', emoji: '✅' },
}
