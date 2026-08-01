# NexusERP — How It Works, First to Last

End-to-end walkthrough of the system: from `index.html` to a rendered module page,
and the rules to follow when extending it.

> Setup/install instructions live in [README.md](README.md) and [SETUP.md](SETUP.md).
> This document is about **how the running app behaves** and **how to add to it**.

---

## 1. What this is

A **multi-tenant, modular ERP**. One codebase, one Supabase database, many client
companies ("tenants"). Each tenant has its own installed modules, users, roles and
permission overrides. Every business table carries a `tenant_id` and is isolated by
Postgres Row Level Security.

| Layer | Tech |
|-------|------|
| UI | React 18, React Router 6, Tailwind 3 (class-based dark mode) |
| Build | Vite 5 (`@`, `@core`, `@modules`, `@shared` aliases in `vite.config.js`) |
| State | Zustand (UI + auth session), React Context (tenant, permissions) |
| Backend | Supabase — Auth + Postgres + Realtime |
| Forms | react-hook-form + zod |
| Charts | Recharts |

```bash
npm run dev       # Vite dev server
npm run build     # production build → dist/
npm run preview   # serve the build
```

No test runner, no lint script. Type-checking is whatever `@types/react` gives the editor.

---

## 2. Repo map

```
src/
├── main.jsx                  # ReactDOM entry → <Shell/>
├── index.css                 # Tailwind layers + global styles
├── app/                      # The shell: layout, auth screens, admin panels
│   ├── Shell.jsx             # ROOT — registers modules, nests providers, theme effect
│   ├── AuthGuard.jsx         # Login / reset-password / boot-loader gates
│   ├── Sidebar.jsx           # Permission-filtered nav, ICON_MAP
│   ├── TopBar.jsx, Home.jsx, ModuleStore.jsx, NotFound.jsx
│   └── admin/                # SuperAdminPanel, TenantUsersPanel + components
├── core/                     # Tenant-agnostic engine — no business logic
│   ├── registry/ModuleRegistry.js     # plug-in engine (singleton)
│   ├── router/DynamicRouter.jsx       # builds routes from installed manifests
│   ├── permissions/                   # permissions.js (pure) + PermissionContext.jsx
│   ├── tenant/TenantContext.jsx       # current tenant + membership
│   ├── store/useStore.js              # Zustand
│   └── eventbus/EventBus.js           # pub/sub for cross-module events
├── modules/<name>/           # One folder per feature module
│   ├── index.js              # manifest: id, routes, storeSlice, hooks
│   ├── api/                  # Supabase queries — the ONLY place SQL-ish code lives
│   ├── components/           # module-local components (modals, tables, cards)
│   ├── hooks/                # module-local hooks
│   └── pages/                # route targets
└── shared/                   # Cross-module reusables
    ├── api/supabase.js       # the Supabase client singleton
    ├── components/ui.jsx     # ALL base UI primitives
    ├── components/{PermissionGate,Pagination,ListToolbar}.jsx
    ├── hooks/{useAuth,useResourceList,useModule}.js
    └── lib/{constants,toast,moduleIcons,...}.js

sql/                          # Migrations, run manually in the Supabase SQL editor
```

Current modules: `purchase`, `sales`, `inventory`, `accounts`, `hr`, `configuration`,
`reports`, `assets`, `approval`.

---

## 3. Cold start — what happens before anyone logs in

1. **`index.html`** runs a tiny synchronous script that reads the theme from
   `localStorage` and sets the `dark` class on `<html>` — prevents a flash of the
   wrong theme.
2. **`main.jsx`** mounts `<Shell/>` in `React.StrictMode`.
3. **`Shell.jsx`** — at *module-import* time, before any React renders — imports all
   nine module manifests and calls `registry.register(m)` on each. The registry now
   knows every module that *exists*; nothing is installed yet.
4. Shell renders the provider stack. **Order matters — each depends on the one above:**

```
BrowserRouter
└── TenantProvider          tenant + membership
    └── PermissionProvider  RBAC (needs tenant)
        └── AuthProvider    owns the single Supabase auth subscription
            └── AuthGuard   gates rendering until bootstrap finishes
                └── layout  Sidebar + TopBar + <DynamicRouter/>
```

`<Toaster/>` is mounted *outside* AuthGuard so toasts work on the login screen.

---

## 4. Login and the bootstrap chain

`AuthProvider` ([useAuth.js](src/shared/hooks/useAuth.js)) subscribes **once** to
`supabase.auth.onAuthStateChange`. `useAuth()` elsewhere is a plain context consumer —
calling it from ten components does not create ten subscriptions.

On `INITIAL_SESSION` / `SIGNED_IN`, `bootstrap(session)` runs these steps **in order**:

| # | Step | Effect |
|---|------|--------|
| 1 | Build the app user from the Supabase session | `setUser`, `setSession`, `window.__erp_user__` |
| 2 | `registry.loadCatalog()` | pulls `module_catalog` rows (display metadata) |
| 3 | `tenantCtx.loadTenantForUser(userId)` | `window.__erp_tenant__`, `window.__erp_tenant_user__`, and copies `role` onto `__erp_user__` |
| 4 | `registry.loadForTenant(tenantId)` | reads `tenant_modules` → which modules this tenant has |
| 5 | `permissionCtx.loadPermissions(userId, tenantId)` | reads `tenant_user_permissions` → override map |

Special paths:

- **Super admin** (`user_metadata.is_super_admin === true`) has no tenant row. Bootstrap
  calls `clearTenant()` and returns after step 2. `can()` short-circuits to `true` for them.
- **Re-authentication of an already-bootstrapped user** (e.g. the reverification inside
  `ChangePasswordModal`) issues a new token and fires `SIGNED_IN` again. The
  `alreadyBootstrapped` check skips steps 2–5 so the app doesn't flash a full-screen
  loader and unmount the user's work.
- **Token dedupe**: `lastTokenRef` skips bootstrap when the same `access_token` fires twice.
- **`PASSWORD_RECOVERY`**: sets `isRecovery`, which makes AuthGuard show `ResetPasswordPage`
  instead of running the tenant chain.

**Teardown** on `SIGNED_OUT` reverses everything: clear permissions → clear active tenant →
clear tenant → Zustand `logout()` → null the three globals → navigate to `/`.

### AuthGuard gates

Rendered in order; the first one that matches wins:

1. `authLoading` → BootLoader "Authenticating…"
2. `isRecovery` → ResetPasswordPage
3. `!user` → LoginPage (sign in / sign up / forgot password)
4. `tenantLoading` → BootLoader "Loading workspace…"
5. `!tenant && tenantError` → NoTenantScreen
6. `permLoading` → BootLoader "Loading permissions…"
7. otherwise → render the app

`VITE_DEMO_MODE=true` injects mock globals and skips every gate — no Supabase needed.

### The three globals

`window.__erp_user__`, `window.__erp_tenant__`, `window.__erp_tenant_user__` exist so
non-React code (EventBus handlers, the permission resolver, route guards) can read the
current identity without a hook. They are set by useAuth/TenantContext and nulled on
sign-out. **Treat them as read-only outside those two files.**

---

## 5. Multi-tenancy

`TenantContext` owns `tenant` (the `tenants` row) and `tenantUser` (the `tenant_users`
membership row, which carries `role`). It exposes convenience derivations used all over
the app:

```js
const { tenantId, tenantName, userRole, isOwner, isAdmin, isManager, refreshTenant } = useTenant()
```

Every data query passes `tenantId` explicitly (`.eq('tenant_id', tenantId)`) *and* RLS
enforces it server-side. Belt and braces — never rely on only one.

---

## 6. The module system

### A manifest is thin

`src/modules/<name>/index.js` owns only the parts that can't live in a database:

```js
export default {
  id: 'approval',
  routes: [
    { path: '/approval',           component: () => import('./pages/Dashboard') },
    { path: '/approval/requests/:id', component: () => import('./pages/ApprovalDetail') },
  ],
  storeSlice: (set) => ({ /* optional Zustand slice */ }),
  onInstall:   async () => {},
  onUninstall: async () => {},
}
```

### Display metadata lives in the DB

`name`, `description`, `icon`, `color`, `category`, `version`, `features`,
`dependencies`, `menu_items` come from the **`module_catalog`** table and are merged
*over* the code manifest by `ModuleRegistry._withCatalog()` at login. That means the
sidebar labels, module colours and feature list are editable without a deploy.

If the table is missing or Supabase is unreachable, `loadCatalog()` swallows the error and
the code manifests are used verbatim. A row in `module_catalog` with **no** code manifest
still shows up in the App Store — routeless.

**Adding a `module_catalog` row is mandatory for a new module**, otherwise it has no name,
no icon and no menu items.

### ModuleRegistry (singleton, `@core/registry/ModuleRegistry`)

```
register(manifest)              add to the code catalogue (startup)
loadCatalog()                   pull module_catalog metadata (login)
loadForTenant(tenantId)         pull tenant_modules → active install set (login)
install/uninstall(id, tenantId) with dependency resolution
getAll() / get(id) / getInstalled() / isInstalled(id)
subscribe(fn)                   → returns unsubscribe
```

- Install sets are kept per tenant in a `Map<tenantId, Set<moduleId>>`, so switching
  tenants is instant.
- `install()` topologically resolves and installs missing `dependencies` first.
- `uninstall()` is blocked if another installed module depends on the target.
- Persistence is **Supabase `tenant_modules` + a localStorage mirror**
  (`erp_modules_<tenantId>`) as an offline fallback. Writes are delete-then-insert.
- Every mutation calls `_notifyListeners()`; Sidebar and DynamicRouter subscribe and
  re-render.
- Install/uninstall also emit `module:installed` / `module:uninstalled` on the EventBus.

Users install modules from **`/apps`** (the App Store), gated to managers and above.

---

## 7. Routing

`DynamicRouter` builds the route tree at runtime:

- **Core routes, always present:** `/` (Home), `/apps` (ModuleStore), `/team`
  (TenantUsersPanel — guard is inside the component), `/admin` (SuperAdminPanel, wrapped
  in `AdminRoute`), and `*` (NotFound).
- **Module routes:** for each installed manifest, each `routes[]` entry becomes a lazy
  `<Route>`. Every one is automatically wrapped in `PermissionRoute`, which checks
  `can(VIEW, moduleId, featureId)` and redirects to `/` on failure.
- `featureId` is derived by matching the route path against the manifest's `menuItems` —
  so typing the URL of a feature you can't see in the sidebar is blocked too.
- Pages are code-split (`lazy()` + `<Suspense>` with a spinner).

**You never register a route manually.** Add it to the manifest's `routes[]`.

---

## 8. Permissions (RBAC)

### The resolver — `@core/permissions/permissions.js`

Pure functions, no React, no globals read inside. `can(user, action, moduleId, featureId)`
resolves in this order:

1. `user.isSuperAdmin` → **true**
2. Explicit **feature-level** override — `permissions[moduleId].features[featureId][action]`
   (only consulted when a `featureId` is passed; `null` falls through)
3. Explicit **module-level** override — `permissions[moduleId][action]` (`null` falls through)
4. **Role default** — `ROLE_DEFAULTS[user.role][action]`

Constants are the source of truth — import them, never use raw strings:

```js
import { ACTIONS, ROLES } from '@core/permissions/permissions'
// ACTIONS: view create edit delete approve export
// ROLES:   viewer < user < manager < admin < owner
```

`ROLE_DEFAULTS` matrix, condensed:

| Role | view | create | edit | delete | approve | export |
|------|:----:|:------:|:----:|:------:|:-------:|:------:|
| owner / admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| manager | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| user | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| viewer | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

`view` is `false` for user/viewer on purpose: they see **only** the modules an admin has
explicitly granted. Once granted view, their create/edit defaults apply.

### PermissionContext

Loads `tenant_user_permissions` rows and runs them through `buildPermissionMap()` — rows
with `feature_id IS NULL` are module-level, rows with a `feature_id` land under
`features`. It also opens a **Supabase Realtime subscription** on that table filtered by
`user_id`, so an admin changing someone's permissions updates their UI live, no reload.

```js
const { can, canAccessModule, permissions, refreshPermissions } = usePermissions()
can('edit', 'accounts')                  // module-level
can('view', 'sales', 'sales.offers')     // feature-level
```

### Where permissions are enforced (all three, always)

| Layer | Mechanism |
|-------|-----------|
| Navigation | `Sidebar` filters `menuItems` by `item.requiredPermission` and hides a whole module section if nothing remains |
| Routing | `PermissionRoute` wraps every module route (VIEW check) |
| Actions | `<PermissionGate action="create" moduleId="accounts">…</PermissionGate>` around buttons |

### Feature-level gating

A menu item opts in by declaring a `featureId` in `module_catalog.menu_items`:

```json
{ "id": "offers", "label": "Offers & Discounts", "path": "/sales/offers", "icon": "Tag",
  "requiredPermission": { "action": "view", "moduleId": "sales", "featureId": "sales.offers" } }
```

`featuresForModule()` reads those back so the permission-editor UIs
(`TenantUsersPanel`, `UserPermissionEditor`) can render one sub-row per feature.

---

## 9. State management

| Concern | Where | Why |
|---------|-------|-----|
| Auth session, sidebar open, theme, notifications | Zustand `useStore` | cheap, no re-render cascade |
| Tenant + membership | `TenantContext` | must re-render the whole tree on tenant switch |
| Permissions | `PermissionContext` | depends on tenant; realtime-updated |
| Server data | local `useState` in pages, via `api/` functions | no global cache layer |
| Module-specific state | `storeSlice` injected into Zustand via `_addSlice` | optional |

Only `theme` and `sidebarOpen` are persisted (`localStorage` key `erp-ui-store`) —
auth and module state deliberately are not.

---

## 10. Data layer conventions

**All Supabase access lives in `src/modules/<name>/api/*.js`.** Pages never call
`supabase` directly.

An API function:
- takes `tenantId` as its first argument and returns early when it's falsy,
- filters `.eq('tenant_id', tenantId)`,
- for lists, returns `{ items, total }` and applies `.range()` using
  `PAGE_SIZE_TABLE` / `PAGE_SIZE_GRID` from `@shared/lib/constants`,
- throws on error (the caller toasts it).

```js
export async function fetchInvoices(tenantId, { page, search, filter }) {
  if (!tenantId) return { items: [], total: 0 }
  let query = supabase.from('invoices')
    .select('*, customer:customer_id(name)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('invoice_date', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  if (filter !== 'all') query = query.eq('status', filter)
  if (search.trim()) query = query.ilike('invoice_number', `%${search.trim()}%`)
  const { data, count, error } = await query
  if (error) throw error
  return { items: data || [], total: count || 0 }
}
```

### `useResourceList` — the list-page workhorse

Every list page in every module uses it. It owns pagination, search, one filter tab
group, loading state, the create/edit modal state, and stale-response protection
(a `requestId` ref discards out-of-order fetches).

```js
const fetchFn = useCallback(params => fetchInvoices(tenantId, params), [tenantId])
const {
  items, total, page, setPage, search, setSearch, filter, setFilter,
  loading, refetch, showModal, editItem, openNew, openEdit, closeModal,
} = useResourceList(fetchFn, [tenantId])
```

### Anatomy of a list page

`PageHeader` (+ a `PermissionGate`-wrapped action button) → `Card` → `ListToolbar`
(search + status tabs) → `ListLoading` / `ListEmptyState` / `Table` → `Pagination` →
the modal. See [Invoices.jsx](src/modules/accounts/pages/Invoices.jsx) as the reference
implementation.

Status maps and label/colour dictionaries for every entity live in
[shared/lib/constants.js](src/shared/lib/constants.js) — add new ones there, not inline.

---

## 11. UI and theming

- **Import every base component from `@shared/components/ui`**: `Button`, `Badge`, `Card`,
  `CardHeader`, `CardTitle`, `CardContent`, `StatCard`, `Input`, `PasswordInput`, `Select`,
  `Table`/`Thead`/`Th`/`Tbody`/`Tr`/`Td`, `Modal`, `PageHeader`, `EmptyState`, `Spinner`.
- **Dark mode is class-based.** `Shell.jsx` toggles `dark` on `<html>` from the Zustand
  `theme` value (`light` | `dark` | `system`; `system` attaches a `matchMedia` listener).
  **Always write both variants** — `text-slate-800 dark:text-slate-200`. Never hardcode
  dark-only classes.
- Toasts: `import toast from '@shared/lib/toast'` — `toast.success/error/info`.
- Icons are Lucide. Manifest icons are strings resolved by
  `@shared/lib/moduleIcons`; sidebar menu-item icons are resolved by `ICON_MAP` in
  [Sidebar.jsx](src/app/Sidebar.jsx) — **a new icon name must be added there** or it
  silently falls back to `LayoutDashboard`.

---

## 12. Supabase tables

| Table | Purpose |
|-------|---------|
| `tenants` | Client companies |
| `tenant_users` | User ↔ tenant membership + role |
| `tenant_modules` | Which modules a tenant has installed |
| `tenant_user_permissions` | Per-user, per-module/feature action overrides |
| `module_catalog` | DB-driven module display metadata + menu items |
| *(business tables)* | `invoices`, `products`, `employees`, … all carry `tenant_id` |

Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, optional `VITE_DEMO_MODE`.
Super admins are flagged with `user_metadata.is_super_admin = true` in Supabase Auth.

The whole schema is a single file — [sql/nexuserp_schema.sql](sql/nexuserp_schema.sql) — run by
hand in the Supabase SQL editor. It covers extensions, helper functions, every table, RLS,
views, sequences, RPCs, triggers, indexes and the `module_catalog` seed, and is fully
idempotent, so a schema change means **editing that file and re-running it**. Its header
records the conflicts that were resolved when the previous 26 migration files were merged
into it.

---

## 13. Adding a new module — the checklist

1. **Folder**: `src/modules/<name>/{api,components,hooks,pages}/` + `index.js` with the
   manifest shape from §6.
2. **DB row** in `module_catalog` (mandatory): `module_id`, `name`, `description`, `icon`,
   `color`, `category`, `menu_items`, `features`, `dependencies`, `is_active`.
3. **Register** the manifest in the array in [Shell.jsx](src/app/Shell.jsx).
4. **Icons**: add any new Lucide icon name to `ICON_MAP` in [Sidebar.jsx](src/app/Sidebar.jsx).
5. **Schema**: add the tables (each with `tenant_id`), indexes and RLS policies to
   [sql/nexuserp_schema.sql](sql/nexuserp_schema.sql), then re-run it.
6. Install it for a tenant from `/apps`.

### Adding a page to an existing module

1. `pages/NewPage.jsx`
2. one entry in the manifest's `routes[]`
3. if it should appear in the nav, one entry in that module's `module_catalog.menu_items`
   (with `requiredPermission` if it needs gating)

That's it — the router, the sidebar and the permission guard pick it up automatically.

---

## 14. Rules that are easy to get wrong

- Bootstrap steps are **sequential and order-dependent**. Don't parallelise them.
- Don't call `supabase` from a page or component — put it in the module's `api/`.
- Don't hardcode a `moduleId` in `core/` or `Sidebar` — everything comes from manifests.
- Don't use raw permission strings — import `ACTIONS` / `ROLES`.
- Always pass `tenantId` in queries even though RLS also enforces it.
- Always ship both light and `dark:` Tailwind variants.
- `window.__erp_*` globals are read-only outside `useAuth` / `TenantContext`.
- A registry `subscribe()` call must have its unsubscribe returned from the `useEffect`.
- New module without a `module_catalog` row = invisible module.
