# NexusERP

A multi-tenant, modular ERP platform built with React, Vite, Tailwind CSS, and Supabase.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router 6 |
| Build | Vite 5 |
| Styling | Tailwind CSS 3 (class-based dark/light mode) |
| State | Zustand (UI/auth), React Context (tenant, permissions) |
| Backend | Supabase (Auth + Postgres) |
| Charts | Recharts |
| Forms | React Hook Form + Zod |

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project

### Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# Start dev server
npm run dev
```

### Environment Variables

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Scripts

```bash
npm run dev       # Development server (http://localhost:5173)
npm run build     # Production build → dist/
npm run preview   # Preview production build locally
```

## Database Schema

| Table | Purpose |
|-------|---------|
| `tenants` | Client companies (`id`, `name`, `slug`, `plan`, `status`) |
| `tenant_users` | User ↔ tenant membership with role |
| `tenant_modules` | Which modules each tenant has installed |
| `tenant_user_permissions` | Per-user per-module action overrides |

## Architecture Overview

### Multi-tenancy

Every tenant (client company) has isolated modules, users, and permissions. All Supabase queries are scoped by `tenant_id`. A single super-admin account (flagged via `user_metadata.is_super_admin`) can manage all tenants from `/admin`.

### Module System

Features are delivered as self-contained **module manifests** registered at startup. Each manifest declares its menu items, routes, Zustand slice, and install/uninstall hooks. Modules can declare dependencies on other modules. Install/uninstall state is persisted to `tenant_modules` in Supabase with localStorage as offline fallback.

### Permissions (RBAC)

Three-level resolution per action (`view`, `create`, `edit`, `delete`, `approve`, `export`):

1. Super admin → always allowed
2. Explicit DB override in `tenant_user_permissions` → true/false
3. Role default (viewer → user → manager → admin → owner)

### Theming

Light/dark mode toggled from the top bar. Theme is persisted to `localStorage` and applied as a `dark` class on `<html>` before React hydrates (no flash).

## Available Modules

| Module | Category | Description |
|--------|----------|-------------|
| Sales | Operations | Quotations, sales orders, customers, pipeline |
| Purchase | Operations | Purchase orders, vendors, receipts |
| Inventory | Operations | Stock management, warehouses, transfers |
| Accounts | Finance | Chart of accounts, journals, invoicing |
| HR | Human Resources | Employees, attendance, payroll |
| Assets | Operations | Fixed asset register, depreciation |
| Reports | Analytics | Cross-module reporting and dashboards |
| Approval | System | Configurable approval workflows |
| Configuration | System | Tenant settings and system config |

## Project Structure

```
src/
├── app/              # Shell, layout, core pages (Home, ModuleStore, admin/)
├── core/
│   ├── store/        # Zustand global store
│   ├── registry/     # Module plug-in engine (ModuleRegistry)
│   ├── router/       # Dynamic route builder
│   ├── tenant/       # TenantContext
│   ├── permissions/  # RBAC engine + PermissionContext
│   └── eventbus/     # Cross-module event bus
├── modules/          # Feature modules (one folder per module)
│   └── <name>/
│       ├── index.js  # Manifest (id, routes, menuItems, storeSlice…)
│       └── pages/    # Page components
└── shared/
    ├── components/   # ui.jsx — Button, Card, Table, Modal, Input…
    ├── hooks/        # useAuth, useModule
    └── api/          # supabase.js client
```

## Adding a New Module

1. Create `src/modules/<name>/index.js` with the manifest:

```js
export default {
  id: 'my-module',
  name: 'My Module',
  description: '...',
  version: '1.0.0',
  icon: SomeLucideIcon,
  color: '#6366f1',
  category: 'Operations',
  dependencies: [],           // other module ids
  features: ['Feature A'],
  menuItems: [
    { id: 'my-page', label: 'Page', path: '/my-module', icon: 'LayoutDashboard',
      requiredPermission: { action: 'view', moduleId: 'my-module' } },
  ],
  routes: [
    { path: '/my-module', component: () => import('./pages/MyPage') },
  ],
}
```

2. Add page components under `src/modules/<name>/pages/`.
3. Register in `src/app/Shell.jsx` (add to the manifest array).
4. If using a new Lucide icon in `menuItems`, add it to `ICON_MAP` in `src/app/Sidebar.jsx`.
