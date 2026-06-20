/**
 * Configuration module manifest (code side).
 *
 * Display metadata lives in the `module_catalog` DB table and is merged in by
 * the ModuleRegistry at login. This file only owns the non-serialisable parts:
 * id, routes, store slice, and install/uninstall hooks.
 */
const configurationModule = {
  id: 'configuration',

  routes: [
    { path: '/configuration', component: () => import('./pages/Index') },
    { path: '/configuration/company', component: () => import('./pages/Company') },
    { path: '/configuration/users', component: () => import('./pages/Users') },
    { path: '/configuration/modules', component: () => import('./pages/ModuleSettings') },
    { path: '/configuration/fiscal', component: () => import('./pages/FiscalPeriods') },
  ],

  storeSlice: (set) => ({
    configuration: { company: null, users: [], roles: [], fiscalPeriods: [] },
    setCompany: (company) => set(state => ({ configuration: { ...state.configuration, company } })),
  }),

  onInstall: async () => { console.log('[Configuration] Module installed') },
  onUninstall: async () => { console.log('[Configuration] Module uninstalled') },
}

export default configurationModule
