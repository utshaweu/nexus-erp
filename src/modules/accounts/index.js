import { DollarSign } from 'lucide-react'

const accountsModule = {
  id: 'accounts',
  name: 'Accounts',
  description: 'Full financial management: invoices, bills, journals, reconciliation, and financial reports.',
  version: '1.0.0',
  icon: DollarSign,
  color: '#8b5cf6',
  category: 'Finance',
  dependencies: [],
  features: [
    'Chart of Accounts',
    'Customer Invoices',
    'Vendor Bills',
    'Payment Reconciliation',
    'Journal Entries',
    'P&L & Balance Sheet',
  ],

  menuItems: [
    { id: 'acc-dashboard', label: 'Dashboard', path: '/accounts', icon: 'LayoutDashboard', order: 1 },
    { id: 'acc-invoices', label: 'Invoices', path: '/accounts/invoices', icon: 'FileText', order: 2 },
    { id: 'acc-bills', label: 'Bills', path: '/accounts/bills', icon: 'Receipt', order: 3 },
    { id: 'acc-journals', label: 'Journals', path: '/accounts/journals', icon: 'BookOpen', order: 4 },
    { id: 'acc-coa', label: 'Chart of Accounts', path: '/accounts/coa', icon: 'List', order: 5 },
  ],

  routes: [
    { path: '/accounts', component: () => import('./pages/Dashboard') },
    { path: '/accounts/invoices', component: () => import('./pages/Invoices') },
    { path: '/accounts/bills', component: () => import('./pages/Bills') },
    { path: '/accounts/journals', component: () => import('./pages/Journals') },
    { path: '/accounts/coa', component: () => import('./pages/ChartOfAccounts') },
  ],

  storeSlice: (set) => ({
    accounts: { invoices: [], bills: [], journals: [], coa: [], stats: {} },
    setInvoices: (invoices) => set(state => ({ accounts: { ...state.accounts, invoices } })),
  }),

  onInstall: async () => { console.log('[Accounts] Module installed') },
  onUninstall: async () => { console.log('[Accounts] Module uninstalled') },
}

export default accountsModule
