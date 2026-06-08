# NexusERP — Multi-Tenant Setup Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  NexusERP App                    │
│                                                  │
│  ┌──────────────┐    ┌──────────────┐            │
│  │ Prince Bazar │    │    Agora     │   + any     │
│  │  Sales ✓     │    │  HR ✓        │   future    │
│  │  Purchase ✓  │    │  Config ✓    │   clients   │
│  └──────────────┘    └──────────────┘            │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │           Supabase PostgreSQL              │  │
│  │  tenants | tenant_users | tenant_modules   │  │
│  │  All business tables carry tenant_id       │  │
│  │  RLS isolates data between tenants         │  │
│  └────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**One codebase. One database. Infinite clients.**
Each client sees only their own data, own modules, own users — enforced at the database level via Supabase Row Level Security.

---

## 1. Supabase Project Setup

### 1.1 Create the project
1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Click **New Project**
3. Note your **Project URL** and **anon public key** (Settings → API)

### 1.2 Run the schema
1. Go to **SQL Editor** in your Supabase dashboard
2. Paste the entire contents of `supabase_schema.sql`
3. Click **Run** — all tables, RLS policies, functions, and indexes will be created

---

## 2. Configure the App

Copy `.env.example` to `.env` and fill in your values:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_DEMO_MODE=false
```

> Set `VITE_DEMO_MODE=true` to bypass authentication entirely (for local dev/demos).

---

## 3. Create the Super Admin

The super admin can create and manage all tenants (clients) from a built-in panel.

### 3.1 Create the Supabase auth user
1. Go to **Authentication → Users** in your Supabase dashboard
2. Click **Add User** (or use the Supabase API)
3. Email: `superadmin@nexuserp.com`  ·  Password: your choice
4. After creating, click the user → **Edit** → add to **User Metadata**:
   ```json
   { "is_super_admin": true, "full_name": "Super Admin" }
   ```

The `is_super_admin` flag in user metadata is read by the `is_super_admin()` SQL function, which bypasses all tenant RLS policies.

---

## 4. Create Clients (Tenants)

### Option A — Via the Super Admin Panel (Recommended)

1. Log in with `superadmin@nexuserp.com`
2. Click **Admin Panel** in the sidebar (shield icon)
3. Click **New Client**
4. Fill in the 3-step wizard:
   - **Step 1**: Company name (e.g. "Prince Bazar"), URL slug, plan
   - **Step 2**: Select modules (e.g. Sales + Purchase for Prince Bazar)
   - **Step 3**: Admin user email + password for that client

This creates the tenant row, the admin user in Supabase Auth, links them together, and installs the selected modules — all in one click.

### Option B — Via SQL (manual)

```sql
-- 1. Insert the tenant
INSERT INTO tenants (name, slug, plan) VALUES
  ('Prince Bazar', 'prince-bazar', 'growth'),
  ('Agora',        'agora',        'starter');

-- 2. In Supabase Auth dashboard, create users:
--    admin@prince-bazar.com → note their UUID (e.g. 'uuid-prince')
--    admin@agora.com        → note their UUID (e.g. 'uuid-agora')

-- 3. Link users to their tenants
INSERT INTO tenant_users (tenant_id, user_id, role, full_name)
SELECT t.id, 'uuid-prince', 'owner', 'Prince Bazar Admin'
FROM tenants t WHERE t.slug = 'prince-bazar';

INSERT INTO tenant_users (tenant_id, user_id, role, full_name)
SELECT t.id, 'uuid-agora', 'owner', 'Agora Admin'
FROM tenants t WHERE t.slug = 'agora';

-- 4. Install modules per tenant
-- Prince Bazar gets: Sales + Purchase
INSERT INTO tenant_modules (tenant_id, module_id)
SELECT t.id, m.module_id
FROM tenants t,
     (VALUES ('sales'), ('purchase')) AS m(module_id)
WHERE t.slug = 'prince-bazar';

-- Agora gets: HR + Configuration
INSERT INTO tenant_modules (tenant_id, module_id)
SELECT t.id, m.module_id
FROM tenants t,
     (VALUES ('hr'), ('configuration')) AS m(module_id)
WHERE t.slug = 'agora';
```

---

## 5. How It Works — Data Flow

```
User logs in
     │
     ▼
useAuth.bootstrap()
     │
     ├── setUser(authUser)              → Zustand store
     │
     ├── tenantCtx.loadTenantForUser()  → queries tenant_users JOIN tenants
     │        └── sets tenant, tenantUser in TenantContext
     │
     └── registry.loadForTenant(tenantId) → queries tenant_modules
              └── populates installed module set for THIS tenant
                       │
                       ▼
              Sidebar shows only installed modules
              App Store shows tenant's install state
              All DB queries auto-filtered by RLS
```

---

## 6. Adding a New Client in the Future

**It's just one action** — no code changes needed:

```
Super Admin Panel → New Client → fill wizard → done
```

Or via SQL:
```sql
INSERT INTO tenants (name, slug, plan) VALUES ('New Client', 'new-client', 'starter');
```

Then create their user and link via `tenant_users`. The system handles everything else.

---

## 7. Role Permissions

| Role    | Install Modules | Manage Users | View Data | Edit Data | Approve |
|---------|:-:|:-:|:-:|:-:|:-:|
| owner   | ✓ | ✓ | ✓ | ✓ | ✓ |
| admin   | ✓ | ✓ | ✓ | ✓ | ✓ |
| manager | ✗ | ✗ | ✓ | ✓ | ✓ |
| user    | ✗ | ✗ | ✓ | ✓ | ✗ |
| viewer  | ✗ | ✗ | ✓ | ✗ | ✗ |

---

## 8. Module Dependencies

Some modules require others. The registry resolves this automatically:

| Module      | Requires   |
|-------------|------------|
| Inventory   | Purchase   |
| Assets      | Accounts   |
| All others  | None       |

If you try to install Inventory without Purchase, the registry installs Purchase first automatically (with a confirmation dialog in the UI).

If you try to uninstall Purchase while Inventory is installed, it blocks with a clear error message.

---

## 9. Project Structure

```
src/
├── core/
│   ├── registry/
│   │   └── ModuleRegistry.js     ← Tenant-aware install engine (SINGLETON)
│   ├── tenant/
│   │   └── TenantContext.jsx     ← React context: current tenant + user role
│   ├── router/
│   │   └── DynamicRouter.jsx     ← Routes injected per installed module
│   ├── store/
│   │   └── useStore.js           ← Zustand: auth + UI state only
│   ├── eventbus/
│   │   └── EventBus.js           ← Cross-module pub/sub
│   └── permissions/
│       └── permissions.js        ← RBAC helpers
│
├── modules/                      ← Each module is self-contained
│   ├── purchase/
│   │   ├── index.js              ← Manifest: routes, menu, deps, store slice
│   │   └── pages/
│   ├── sales/    inventory/  accounts/
│   ├── hr/       configuration/  reports/
│   ├── assets/   approval/
│   └── ...
│
├── shared/
│   ├── components/ui.jsx         ← Button, Card, Table, Badge, Modal...
│   ├── hooks/
│   │   ├── useAuth.js            ← Auth + tenant bootstrap chain
│   │   └── useModule.js          ← Install/uninstall (tenant-scoped)
│   └── api/supabase.js
│
└── app/
    ├── Shell.jsx                 ← Root: BrowserRouter → TenantProvider → AuthGuard
    ├── Sidebar.jsx               ← Dynamic menu from installed modules
    ├── TopBar.jsx                ← Breadcrumbs + tenant name pill
    ├── Home.jsx                  ← Dashboard (tenant-aware)
    ├── ModuleStore.jsx           ← App Store (role-gated)
    ├── AuthGuard.jsx             ← Login / tenant-error / loading states
    └── admin/
        └── SuperAdminPanel.jsx  ← Create tenants, manage modules, toggle status
```

---

## 10. Adding a New Module

Only 3 steps needed — no changes to existing code:

```js
// 1. Create src/modules/mymodule/index.js
const myModule = {
  id:           'mymodule',
  name:         'My Module',
  icon:         SomeIcon,
  color:        '#hexcolor',
  category:     'Operations',
  version:      '1.0.0',
  dependencies: [],            // other module IDs required
  description:  'What it does',
  features:     ['Feature A', 'Feature B'],
  menuItems:    [{ id:'mm-dash', label:'Dashboard', path:'/mymodule', icon:'LayoutDashboard', order:1 }],
  routes:       [{ path:'/mymodule', component: () => import('./pages/Dashboard') }],
  storeSlice:   (set) => ({ mymodule: { data: [] } }),
  onInstall:    async () => {},
  onUninstall:  async () => {},
}
export default myModule

// 2. Register it in src/app/Shell.jsx
import myModule from '@modules/mymodule'
registry.register(myModule)

// 3. Done — it appears in every tenant's App Store automatically.
```

---

## 11. Quick Start

```bash
# Install dependencies
npm install

# Copy env and configure
cp .env.example .env
# edit .env with your Supabase URL and key

# Run the schema in Supabase SQL Editor
# (paste supabase_schema.sql)

# Start dev server
npm run dev

# Or demo mode (no Supabase needed)
# set VITE_DEMO_MODE=true in .env, then:
npm run dev
```
