/**
 * Inventory module manifest (code side).
 *
 * Display metadata (incl. its `purchase` dependency) lives in the
 * `module_catalog` DB table and is merged in by the ModuleRegistry at login.
 * This file only owns the non-serialisable parts: id, routes, store slice,
 * and install/uninstall hooks.
 */
const inventoryModule = {
  id: 'inventory',

  routes: [
    { path: '/inventory', component: () => import('./pages/Dashboard') },
    { path: '/inventory/products', component: () => import('./pages/Products') },
    { path: '/inventory/stock', component: () => import('./pages/StockMoves') },
    { path: '/inventory/warehouses', component: () => import('./pages/Warehouses') },
  ],

  storeSlice: (set) => ({
    inventory: { products: [], stockMoves: [], warehouses: [], stats: {} },
    setInventoryProducts: (products) => set(state => ({ inventory: { ...state.inventory, products } })),
  }),

  onInstall: async () => { console.log('[Inventory] Module installed') },
  onUninstall: async () => { console.log('[Inventory] Module uninstalled') },
}

export default inventoryModule
