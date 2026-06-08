import { Settings } from 'lucide-react'

const configurationModule = {
  id: 'configuration',
  name: 'Configuration',
  description: 'System-wide settings: company info, users, roles, fiscal years, and module settings.',
  version: '1.0.0',
  icon: Settings,
  color: '#64748b',
  category: 'System',
  dependencies: [],
  features: ['Company Settings', 'Users & Roles', 'Module Settings', 'Fiscal Periods', 'Currency'],

  menuItems: [
    { id: 'cfg-company', label: 'Company', path: '/configuration/company', icon: 'Building2', order: 1 },
    { id: 'cfg-users', label: 'Users & Roles', path: '/configuration/users', icon: 'UserCog', order: 2 },
    { id: 'cfg-modules', label: 'Module Settings', path: '/configuration/modules', icon: 'Puzzle', order: 3 },
    { id: 'cfg-fiscal', label: 'Fiscal Periods', path: '/configuration/fiscal', icon: 'CalendarDays', order: 4 },
  ],

  routes: [
    { path: '/configuration', component: () => import('./pages/Index') },
    { path: '/configuration/company', component: () => import('./pages/Company') },
    { path: '/configuration/users', component: () => import('./pages/Users') },
    { path: '/configuration/modules', component: () => import('./pages/ModuleSettings') },
    { path: '/configuration/fiscal', component: () => import('./pages/FiscalPeriods') },
  ],

  storeSlice: (set) => ({
    configuration: { company: null, users: [], roles: [], fiscalPeriods: [] },
    setCompany: (company) => set(state => ({ configuration: { ...state.configuration, company } })),
  }),

  onInstall: async () => { console.log('[Configuration] Module installed') },
  onUninstall: async () => { console.log('[Configuration] Module uninstalled') },
}

export default configurationModule
