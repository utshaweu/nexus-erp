import { ShoppingCart } from 'lucide-react'

/**
 * Purchase module manifest
 *
 * Each menuItem carries:
 *   requiredPermission: { action, moduleId }
 * The Sidebar reads this to decide whether to show the link.
 * No hardcoding — the Sidebar never knows module names.
 */
const purchaseModule = {
  id:          'purchase',
  name:        'Purchase',
  description: 'Manage purchase orders, vendor relationships, RFQs, and procurement workflows.',
  version:     '1.0.0',
  icon:        ShoppingCart,
  color:       '#f59e0b',
  category:    'Operations',
  dependencies: [],
  features: [
    'Purchase Orders',
    'Request for Quotations (RFQ)',
    'Vendor Management',
    'Purchase Approvals',
    'Purchase Analytics',
  ],

  menuItems: [
    {
      id:    'purchase-dashboard',
      label: 'Dashboard',
      path:  '/purchase',
      icon:  'LayoutDashboard',
      order: 1,
      requiredPermission: { action: 'view', moduleId: 'purchase' },
    },
    {
      id:    'purchase-orders',
      label: 'Purchase Orders',
      path:  '/purchase/orders',
      icon:  'FileText',
      order: 2,
      requiredPermission: { action: 'view', moduleId: 'purchase' },
    },
    {
      id:    'purchase-rfq',
      label: 'RFQ',
      path:  '/purchase/rfq',
      icon:  'ClipboardList',
      order: 3,
      requiredPermission: { action: 'view', moduleId: 'purchase' },
    },
    {
      id:    'purchase-vendors',
      label: 'Vendors',
      path:  '/purchase/vendors',
      icon:  'Building2',
      order: 4,
      requiredPermission: { action: 'view', moduleId: 'purchase' },
    },
  ],

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
