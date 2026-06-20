import { TrendingUp } from 'lucide-react'

const salesModule = {
  id:          'sales',
  name:        'Sales',
  description: 'Drive revenue with quotations, sales orders, customer management, and pipeline analytics.',
  version:     '1.0.0',
  icon:        TrendingUp,
  color:       '#10b981',
  category:    'Operations',
  dependencies: [],
  features: [
    'Quotations & Sales Orders',
    'Customer Management',
    'Offers & Discount Rules',
    'Coupon Code Management',
    'Sales Pipeline',
    'Revenue Analytics',
  ],

  menuItems: [
    {
      id: 'sales-dashboard', label: 'Dashboard', path: '/sales',
      icon: 'LayoutDashboard', order: 1,
      requiredPermission: { action: 'view', moduleId: 'sales' },
    },
    {
      id: 'sales-orders', label: 'Sales Orders', path: '/sales/orders',
      icon: 'FileText', order: 2,
      requiredPermission: { action: 'view', moduleId: 'sales' },
    },
    {
      id: 'sales-quotations', label: 'Quotations', path: '/sales/quotations',
      icon: 'ClipboardList', order: 3,
      requiredPermission: { action: 'view', moduleId: 'sales' },
    },
    {
      id: 'sales-customers', label: 'Customers', path: '/sales/customers',
      icon: 'Users', order: 4,
      requiredPermission: { action: 'view', moduleId: 'sales' },
    },
    {
      id: 'sales-offers', label: 'Offers & Discounts', path: '/sales/offers',
      icon: 'Tag', order: 5,
      requiredPermission: { action: 'view', moduleId: 'sales' },
    },
  ],

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
