/**
 * Sales module manifest (code side).
 *
 * Display metadata — name, description, version, icon, color, category,
 * features, dependencies, menuItems — lives in the `module_catalog` DB table
 * (see sql/nexuserp_module_catalog_addendum.sql) and is merged in by the
 * ModuleRegistry at login. This file only owns what cannot be serialised to a
 * database: the module id, its routes (lazy page imports), the Zustand store
 * slice, and the install/uninstall hooks.
 */
const salesModule = {
  id: 'sales',

  routes: [
    { path: '/sales',           component: () => import('./pages/Dashboard') },
    { path: '/sales/orders',    component: () => import('./pages/SalesOrders') },
    { path: '/sales/orders/:id',component: () => import('./pages/SalesOrderDetail') },
    { path: '/sales/quotations',component: () => import('./pages/Quotations') },
    { path: '/sales/customers', component: () => import('./pages/Customers') },
    { path: '/sales/offers',    component: () => import('./pages/OffersDiscounts') },
  ],

  storeSlice: (set) => ({
    sales: { orders: [], customers: [], quotations: [], stats: {} },
    setSalesOrders:    (orders)    => set(s => ({ sales: { ...s.sales, orders } })),
    setSalesCustomers: (customers) => set(s => ({ sales: { ...s.sales, customers } })),
  }),

  onInstall:   async () => {},
  onUninstall: async () => {},
}

export default salesModule
