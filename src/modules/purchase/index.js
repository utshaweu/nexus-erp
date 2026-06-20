/**
 * Purchase module manifest (code side).
 *
 * Display metadata lives in the `module_catalog` DB table and is merged in by
 * the ModuleRegistry at login. This file only owns the non-serialisable parts:
 * id, routes, store slice, and install/uninstall hooks.
 */
const purchaseModule = {
  id: 'purchase',

  routes: [
    { path: '/purchase',           component: () => import('./pages/Dashboard') },
    { path: '/purchase/orders',    component: () => import('./pages/PurchaseOrders') },
    { path: '/purchase/orders/:id',component: () => import('./pages/PurchaseOrderDetail') },
    { path: '/purchase/rfq',       component: () => import('./pages/RFQ') },
    { path: '/purchase/vendors',   component: () => import('./pages/Vendors') },
  ],

  storeSlice: (set) => ({
    purchase: {
      orders: [], vendors: [], rfqs: [],
      stats: { total: 0, pending: 0, approved: 0, totalSpend: 0 },
    },
    setPurchaseOrders:  (orders)  => set(s => ({ purchase: { ...s.purchase, orders } })),
    setPurchaseVendors: (vendors) => set(s => ({ purchase: { ...s.purchase, vendors } })),
  }),

  onInstall:   async () => {},
  onUninstall: async () => {},
}

export default purchaseModule
