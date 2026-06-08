import { CheckSquare } from 'lucide-react'

const approvalModule = {
  id: 'approval',
  name: 'Approvals',
  description: 'Configurable multi-level approval workflows for any ERP document or request.',
  version: '1.0.0',
  icon: CheckSquare,
  color: '#06b6d4',
  category: 'Operations',
  dependencies: [],
  features: [
    'Multi-level Approval Workflows',
    'Approval Templates',
    'Delegation Support',
    'Approval History & Audit Trail',
    'Email & In-app Notifications',
    'Approval Dashboard',
  ],

  menuItems: [
    { id: 'approval-dashboard', label: 'Dashboard', path: '/approval', icon: 'LayoutDashboard', order: 1 },
    { id: 'approval-pending', label: 'Pending Approvals', path: '/approval/pending', icon: 'Clock', order: 2 },
    { id: 'approval-my', label: 'My Requests', path: '/approval/my-requests', icon: 'Send', order: 3 },
    { id: 'approval-workflows', label: 'Workflows', path: '/approval/workflows', icon: 'GitBranch', order: 4 },
    { id: 'approval-history', label: 'History', path: '/approval/history', icon: 'History', order: 5 },
  ],

  routes: [
    { path: '/approval', component: () => import('./pages/Dashboard') },
    { path: '/approval/pending', component: () => import('./pages/PendingApprovals') },
    { path: '/approval/my-requests', component: () => import('./pages/MyRequests') },
    { path: '/approval/workflows', component: () => import('./pages/Workflows') },
    { path: '/approval/history', component: () => import('./pages/ApprovalHistory') },
    { path: '/approval/requests/:id', component: () => import('./pages/ApprovalDetail') },
  ],

  storeSlice: (set) => ({
    approval: {
      pending: [],
      myRequests: [],
      workflows: [],
      history: [],
      stats: { pending: 0, approved: 0, rejected: 0, avgTime: '0h' },
    },
    setApprovalPending: (pending) => set(state => ({ approval: { ...state.approval, pending } })),
    setApprovalWorkflows: (workflows) => set(state => ({ approval: { ...state.approval, workflows } })),
  }),

  onInstall: async () => { console.log('[Approval] Module installed') },
  onUninstall: async () => { console.log('[Approval] Module uninstalled') },
}

export default approvalModule
