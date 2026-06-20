/**
 * Human Resources module manifest (code side).
 *
 * Display metadata lives in the `module_catalog` DB table and is merged in by
 * the ModuleRegistry at login. This file only owns the non-serialisable parts:
 * id, routes, store slice, and install/uninstall hooks.
 */
const hrModule = {
  id: 'hr',

  routes: [
    { path: '/hr',                  component: () => import('./pages/Dashboard')     },
    { path: '/hr/employees',        component: () => import('./pages/Employees')     },
    { path: '/hr/employees/:id',    component: () => import('./pages/EmployeeDetail')},
    { path: '/hr/departments',      component: () => import('./pages/Departments')   },
    { path: '/hr/attendance',       component: () => import('./pages/Attendance')    },
    { path: '/hr/movement',         component: () => import('./pages/Movement')      },
    { path: '/hr/leave',            component: () => import('./pages/Leave')         },
    { path: '/hr/payroll',          component: () => import('./pages/Payroll')       },
  ],

  storeSlice: (set) => ({
    hr: { employees: [], departments: [], leaves: [], stats: {} },
    setEmployees: (employees) => set(state => ({ hr: { ...state.hr, employees } })),
  }),

  onInstall:   async () => { console.log('[HR] Module installed')   },
  onUninstall: async () => { console.log('[HR] Module uninstalled') },
}

export default hrModule
