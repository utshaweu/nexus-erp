/**
 * Accounts module manifest (code side).
 *
 * Display metadata lives in the `module_catalog` DB table and is merged in by
 * the ModuleRegistry at login. This file only owns the non-serialisable parts:
 * id, routes, store slice, and install/uninstall hooks.
 */
const accountsModule = {
  id: 'accounts',

  routes: [
    { path: '/accounts', component: () => import('./pages/Dashboard') },
    { path: '/accounts/invoices', component: () => import('./pages/Invoices') },
    { path: '/accounts/bills', component: () => import('./pages/Bills') },
    { path: '/accounts/journals', component: () => import('./pages/Journals') },
    { path: '/accounts/coa', component: () => import('./pages/ChartOfAccounts') },
  ],

  storeSlice: (set) => ({
    accounts: { invoices: [], bills: [], journals: [], coa: [], stats: {} },
    setInvoices: (invoices) => set(state => ({ accounts: { ...state.accounts, invoices } })),
  }),

  onInstall: async () => { console.log('[Accounts] Module installed') },
  onUninstall: async () => { console.log('[Accounts] Module uninstalled') },
}

export default accountsModule
