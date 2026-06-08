import { Cpu } from 'lucide-react'

const assetsModule = {
  id: 'assets',
  name: 'Assets',
  description: 'Track and manage fixed assets, depreciation schedules, maintenance, and disposal.',
  version: '1.0.0',
  icon: Cpu,
  color: '#f97316',
  category: 'Finance',
  dependencies: ['accounts'],
  features: [
    'Asset Registry',
    'Depreciation Schedules',
    'Asset Categories',
    'Maintenance Tracking',
    'Asset Disposal',
    'Asset Reports',
  ],

  menuItems: [
    { id: 'asset-dashboard', label: 'Dashboard', path: '/assets', icon: 'LayoutDashboard', order: 1 },
    { id: 'asset-list', label: 'Assets', path: '/assets/list', icon: 'Cpu', order: 2 },
    { id: 'asset-depreciation', label: 'Depreciation', path: '/assets/depreciation', icon: 'TrendingDown', order: 3 },
    { id: 'asset-categories', label: 'Categories', path: '/assets/categories', icon: 'Tag', order: 4 },
    { id: 'asset-maintenance', label: 'Maintenance', path: '/assets/maintenance', icon: 'Wrench', order: 5 },
  ],

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
