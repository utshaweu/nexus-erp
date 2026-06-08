import { Users } from 'lucide-react'

const hrModule = {
  id: 'hr',
  name: 'Human Resources',
  description: 'Manage employees, departments, attendance, leave, and payroll.',
  version: '1.0.0',
  icon: Users,
  color: '#ec4899',
  category: 'Human Resources',
  dependencies: [],
  features: [
    'Employee Directory',
    'Departments & Positions',
    'Leave Management',
    'Attendance Tracking',
    'Payroll',
  ],

  menuItems: [
    { id: 'hr-dashboard', label: 'Dashboard', path: '/hr', icon: 'LayoutDashboard', order: 1 },
    { id: 'hr-employees', label: 'Employees', path: '/hr/employees', icon: 'Users', order: 2 },
    { id: 'hr-departments', label: 'Departments', path: '/hr/departments', icon: 'Building', order: 3 },
    { id: 'hr-leave', label: 'Leave', path: '/hr/leave', icon: 'Calendar', order: 4 },
    { id: 'hr-payroll', label: 'Payroll', path: '/hr/payroll', icon: 'DollarSign', order: 5 },
  ],

  routes: [
    { path: '/hr', component: () => import('./pages/Dashboard') },
    { path: '/hr/employees', component: () => import('./pages/Employees') },
    { path: '/hr/employees/:id', component: () => import('./pages/EmployeeDetail') },
    { path: '/hr/departments', component: () => import('./pages/Departments') },
    { path: '/hr/leave', component: () => import('./pages/Leave') },
    { path: '/hr/payroll', component: () => import('./pages/Payroll') },
  ],

  storeSlice: (set) => ({
    hr: { employees: [], departments: [], leaves: [], stats: {} },
    setEmployees: (employees) => set(state => ({ hr: { ...state.hr, employees } })),
  }),

  onInstall: async () => { console.log('[HR] Module installed') },
  onUninstall: async () => { console.log('[HR] Module uninstalled') },
}

export default hrModule
