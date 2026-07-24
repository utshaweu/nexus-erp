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
| `tenant_user_permissions` | Per-user, per-module/feature action overrides |
| `module_catalog` | DB-driven module display metadata (name, icon, menuItems, features) |

## Architecture Overview

### Multi-tenancy

Every tenant (client company) has isolated modules, users, and permissions. All Supabase queries are scoped by `tenant_id`. A single super-admin account (flagged via `user_metadata.is_super_admin`) can manage all tenants from `/admin`.

### Module System

Features are delivered as self-contained **modules** (`src/modules/<name>/{api,components,hooks,pages}/` + an `index.js` manifest). The manifest owns only the non-serialisable parts — routes, Zustand slice, install/uninstall hooks; display metadata (name, icon, menu items, features) lives in the `module_catalog` table and is merged in at login, editable without a code change. Install/uninstall state is persisted to `tenant_modules` in Supabase with localStorage as offline fallback.

### Permissions (RBAC)

Resolution per action (`view`, `create`, `edit`, `delete`, `approve`, `export`), optionally scoped to a feature within a module:

1. Super admin → always allowed
2. Explicit feature-level override in `tenant_user_permissions` → true/false
3. Explicit module-level override → true/false
4. Role default (viewer → user → manager → admin → owner)

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
│       ├── index.js  # Manifest (id, routes, storeSlice, install hooks)
│       ├── api/       # Supabase queries
│       ├── components/
│       ├── hooks/
│       └── pages/    # Page components
└── shared/
    ├── components/   # ui.jsx — Button, Card, Table, Modal, Input…
    ├── hooks/        # useAuth, useModule
    └── api/          # supabase.js client
```

## Adding a New Module

1. Create `src/modules/<name>/{api,components,hooks,pages}/` and an `index.js` manifest:

```js
export default {
  id: 'my-module',
  routes: [
    { path: '/my-module', component: () => import('./pages/MyPage') },
  ],
  storeSlice: (set) => ({ ... }),   // optional
  onInstall: async () => {},
  onUninstall: async () => {},
}
```

2. Add a row to the `module_catalog` table (name, description, icon, color, category, menuItems, features) — required, not optional.
3. Register the manifest in `src/app/Shell.jsx` (add to the manifest array).
4. If using a new Lucide icon in `menuItems`, add it to `ICON_MAP` in `src/app/Sidebar.jsx`.
