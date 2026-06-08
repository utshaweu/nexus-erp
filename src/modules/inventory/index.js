import { Package } from 'lucide-react'

const inventoryModule = {
  id: 'inventory',
  name: 'Inventory',
  description: 'Track stock levels, warehouses, product movements, and reorder rules.',
  version: '1.0.0',
  icon: Package,
  color: '#3b82f6',
  category: 'Operations',
  dependencies: ['purchase'],
  features: [
    'Product Catalog',
    'Stock Management',
    'Warehouse Locations',
    'Delivery & Receipts',
    'Reorder Rules',
  ],

  menuItems: [
    { id: 'inv-dashboard', label: 'Dashboard', path: '/inventory', icon: 'LayoutDashboard', order: 1 },
    { id: 'inv-products', label: 'Products', path: '/inventory/products', icon: 'Package', order: 2 },
    { id: 'inv-stock', label: 'Stock Moves', path: '/inventory/stock', icon: 'ArrowLeftRight', order: 3 },
    { id: 'inv-warehouses', label: 'Warehouses', path: '/inventory/warehouses', icon: 'Warehouse', order: 4 },
  ],

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
