/**
 * Approvals module manifest (code side).
 *
 * Display metadata lives in the `module_catalog` DB table and is merged in by
 * the ModuleRegistry at login. This file only owns the non-serialisable parts:
 * id, routes, store slice, and install/uninstall hooks.
 */
const approvalModule = {
  id: 'approval',

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
