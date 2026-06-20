/**
 * Assets module manifest (code side).
 *
 * Display metadata (incl. its `accounts` dependency) lives in the
 * `module_catalog` DB table and is merged in by the ModuleRegistry at login.
 * This file only owns the non-serialisable parts: id, routes, store slice,
 * and install/uninstall hooks.
 */
const assetsModule = {
  id: 'assets',

  routes: [
    { path: '/assets', component: () => import('./pages/Dashboard') },
    { path: '/assets/list', component: () => import('./pages/AssetList') },
    { path: '/assets/list/:id', component: () => import('./pages/AssetDetail') },
    { path: '/assets/depreciation', component: () => import('./pages/Depreciation') },
    { path: '/assets/categories', component: () => import('./pages/Categories') },
    { path: '/assets/maintenance', component: () => import('./pages/Maintenance') },
  ],

  storeSlice: (set) => ({
    assets: {
      items: [],
      categories: [],
      depreciationSchedules: [],
      maintenanceLogs: [],
      stats: { total: 0, totalValue: 0, fullyDepreciated: 0, underMaintenance: 0 },
    },
    setAssets: (items) => set(state => ({ assets: { ...state.assets, items } })),
    setAssetCategories: (categories) => set(state => ({ assets: { ...state.assets, categories } })),
  }),

  onInstall: async () => { console.log('[Assets] Module installed') },
  onUninstall: async () => { console.log('[Assets] Module uninstalled') },
}

export default assetsModule
