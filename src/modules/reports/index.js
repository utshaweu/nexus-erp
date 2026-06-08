import { BarChart2 } from 'lucide-react'

const reportsModule = {
  id: 'reports',
  name: 'Reports',
  description: 'Dynamic reports across all installed modules. Export to PDF and Excel.',
  version: '1.0.0',
  icon: BarChart2,
  color: '#a855f7',
  category: 'Analytics',
  dependencies: [],
  features: [
    'Cross-module Analytics',
    'Financial Reports',
    'Operations Reports',
    'Export to PDF & Excel',
    'Scheduled Reports',
    'Custom Dashboards',
  ],

  menuItems: [
    { id: 'rpt-overview', label: 'Overview', path: '/reports', icon: 'BarChart2', order: 1 },
    { id: 'rpt-financial', label: 'Financial', path: '/reports/financial', icon: 'DollarSign', order: 2 },
    { id: 'rpt-operations', label: 'Operations', path: '/reports/operations', icon: 'Activity', order: 3 },
    { id: 'rpt-hr', label: 'HR Reports', path: '/reports/hr', icon: 'Users', order: 4 },
  ],

  routes: [
    { path: '/reports', component: () => import('./pages/Overview') },
    { path: '/reports/financial', component: () => import('./pages/Financial') },
    { path: '/reports/operations', component: () => import('./pages/Operations') },
    { path: '/reports/hr', component: () => import('./pages/HRReports') },
  ],

  storeSlice: (set) => ({
    reports: { savedReports: [], scheduledReports: [] },
  }),

  onInstall: async () => { console.log('[Reports] Module installed') },
  onUninstall: async () => { console.log('[Reports] Module uninstalled') },
}

export default reportsModule
