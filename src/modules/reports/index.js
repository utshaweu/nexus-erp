/**
 * Reports module manifest (code side).
 *
 * Display metadata lives in the `module_catalog` DB table and is merged in by
 * the ModuleRegistry at login. This file only owns the non-serialisable parts:
 * id, routes, store slice, and install/uninstall hooks.
 */
const reportsModule = {
  id: 'reports',

  routes: [
    { path: '/reports', component: () => import('./pages/Overview') },
    { path: '/reports/financial', component: () => import('./pages/Financial') },
    { path: '/reports/operations', component: () => import('./pages/Operations') },
    { path: '/reports/hr', component: () => import('./pages/HRReports') },
  ],

  storeSlice: (set) => ({
    reports: { savedReports: [], scheduledReports: [] },
  }),

  onInstall: async () => { console.log('[Reports] Module installed') },
  onUninstall: async () => { console.log('[Reports] Module uninstalled') },
}

export default reportsModule
