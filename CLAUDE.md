# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`ARCHITECTURE.md` is the long-form end-to-end walkthrough (boot → login → render, plus per-layer conventions). This file is the condensed working reference.

## Commands

```bash
npm run dev       # Start dev server (Vite)
npm run build     # Production build
npm run preview   # Preview production build locally
```

No test runner is configured. There is no lint script — Vite type-checks via `@types/react`.

## Path Aliases

Defined in `vite.config.js`:

| Alias | Resolves to |
|-------|-------------|
| `@` | `src/` |
| `@core` | `src/core/` |
| `@modules` | `src/modules/` |
| `@shared` | `src/shared/` |

## Project structure

```
src/
├── main.jsx                  # entry → <Shell/>
├── index.css                 # Tailwind layers + globals
├── app/                      # the shell (not a module)
│   ├── Shell.jsx             # ROOT: registers manifests, nests providers, theme effect
│   ├── AuthGuard.jsx         # login / reset-password / boot-loader gates
│   ├── Sidebar.jsx           # permission-filtered nav + ICON_MAP
│   ├── TopBar.jsx  Home.jsx  ModuleStore.jsx  NotFound.jsx  ChangePasswordModal.jsx
│   ├── admin/                # SuperAdminPanel, TenantUsersPanel + components/
│   └── components/           # ModuleCard, DepWarningModal, FeatureOrganogram, …
├── core/                     # tenant-agnostic engine — no business logic here
│   ├── registry/ModuleRegistry.js   # plug-in engine (singleton)
│   ├── router/DynamicRouter.jsx     # routes built from installed manifests
│   ├── permissions/                 # permissions.js (pure) + PermissionContext.jsx
│   ├── tenant/TenantContext.jsx
│   ├── store/useStore.js            # Zustand
│   └── eventbus/EventBus.js
├── modules/<name>/           # one folder per feature module
│   ├── index.js              # manifest (id, routes, storeSlice, hooks)
│   ├── api/                  # ALL Supabase queries for this module
│   ├── components/           # module-local modals, tables, cards
│   ├── hooks/                # module-local hooks
│   └── pages/                # route targets
└── shared/
    ├── api/supabase.js       # the Supabase client singleton
    ├── components/           # ui.jsx, PermissionGate, Pagination, ListToolbar
    ├── hooks/                # useAuth, useResourceList, useModule
    └── lib/                  # constants, toast, moduleIcons, approvalWorkflow, …

sql/                          # migrations, run by hand in the Supabase SQL editor
```

Modules: `purchase`, `sales`, `inventory`, `accounts`, `hr`, `configuration`, `reports`, `assets`, `approval`.

Provider nesting in `Shell.jsx` (order is load-bearing): `BrowserRouter` → `TenantProvider` → `PermissionProvider` → `AuthProvider` → `AuthGuard` → layout (`Sidebar` + `TopBar` + `DynamicRouter`).

## Architecture

### Multi-tenant SaaS ERP with a pluggable module system

Each **tenant** (client company) has its own isolated set of installed modules, users, roles, and permission overrides. All data is scoped by `tenant_id` in Supabase.

### Bootstrap chain (login order)

`useAuth` (`src/shared/hooks/useAuth.js`) drives a strict 4-step sequence every login:

1. Build app user object from Supabase session → `window.__erp_user__`
2. Load tenant membership → `TenantContext` → `window.__erp_tenant__`, `window.__erp_tenant_user__`
3. Load tenant's installed modules → `ModuleRegistry.loadForTenant()`
4. Load per-user permission overrides → `PermissionContext.loadPermissions()`

Steps are sequential — each depends on the previous. Teardown on sign-out reverses all four.

### Module system

Every feature is a **module folder** (`src/modules/<name>/`) with `api/`, `components/`, `hooks/`, `pages/`, and an `index.js` manifest that owns only the non-serialisable parts:

```js
{
  id,
  routes: [{ path, component: () => import('./pages/SomePage') }],
  storeSlice: (set) => ({ ... }),  // optional Zustand slice
  onInstall: async () => {},
  onUninstall: async () => {},
}
```

Display metadata (`name`, `description`, `icon`, `menuItems`, `features`, etc.) lives in the DB-driven `module_catalog` table and is merged over the code manifest by `ModuleRegistry` at login — editable without a code change. Empty/offline table falls back to the code manifest as-is.

All manifests are registered in `src/app/Shell.jsx` before any login. `ModuleRegistry` (singleton at `src/core/registry/ModuleRegistry.js`) manages install state per tenant, persists to `tenant_modules` in Supabase with localStorage fallback.

### Routing

`DynamicRouter` (`src/core/router/DynamicRouter.jsx`) builds routes at runtime from installed manifests. Module routes are lazy-loaded and wrapped in `PermissionRoute` (VIEW check) automatically. Core routes (`/`, `/apps`, `/team`, `/admin`) are always present.

### Permission system

Resolution in `src/core/permissions/permissions.js` (`can(user, action, moduleId, featureId?)`, pure functions, no React):

1. `isSuperAdmin` → always true
2. Explicit feature-level override (`tenant_user_permissions` row with a `feature_id`) → true/false, only checked when `featureId` is passed
3. Explicit module-level override (`feature_id IS NULL`) → true/false
4. Role default (`ROLE_DEFAULTS`) → viewer/user/manager/admin/owner matrix

A menu item opts into feature-level gating via `requiredPermission.featureId` in `module_catalog.menu_items`. `PermissionContext` exposes `can(action, moduleId, featureId?)` reactively. `usePermissions()` is the hook. The `ACTIONS` and `ROLES` constants are the source of truth — import them instead of using raw strings.

### State management

- **Zustand** (`src/core/store/useStore.js`): auth session, UI state (sidebar, theme). Module slices are added dynamically via `_addSlice`. Persisted to `localStorage` as `erp-ui-store` (only `theme` and `sidebarOpen`).
- **TenantContext**: React context for tenant/membership data. Lives outside Zustand so the whole tree re-renders on tenant switch.
- **PermissionContext**: React context for RBAC state. Depends on TenantContext.
- **Globals**: `window.__erp_user__`, `window.__erp_tenant__`, `window.__erp_tenant_user__` — set by useAuth/TenantContext for non-React consumers (EventBus handlers, etc.).

### Data layer

All Supabase access lives in `src/modules/<name>/api/*.js` — pages and components never import `supabase` directly. An API function takes `tenantId` first, returns early if it's falsy, filters `.eq('tenant_id', tenantId)` (RLS also enforces it — keep both), and throws on error so the caller can toast it. List functions return `{ items, total }` and paginate with `.range()` using `PAGE_SIZE_TABLE` / `PAGE_SIZE_GRID` from `@shared/lib/constants`.

List pages use `useResourceList(fetchFn, [tenantId])` (`src/shared/hooks/useResourceList.js`) — it owns pagination, search, one filter-tab group, loading, create/edit modal state, and stale-response protection. Page shape: `PageHeader` → `Card` → `ListToolbar` → `ListLoading`/`ListEmptyState`/`Table` → `Pagination` → modal. Reference implementation: `src/modules/accounts/pages/Invoices.jsx`.

Status/label/colour dictionaries for every entity live in `src/shared/lib/constants.js` — add new ones there, not inline.

### Theming

Class-based dark/light mode via Tailwind (`darkMode: 'class'`). The `dark` class is toggled on `<html>` by a `useEffect` in `Shell.jsx` reacting to the `theme` value in the Zustand store. A synchronous init script in `index.html` reads from `localStorage` to avoid flash on page load. Always add both light and `dark:` variants — never hardcode dark-only classes.

### Shared UI

`src/shared/components/ui.jsx` exports all base components: `Button`, `Badge`, `Card`, `CardHeader`, `CardTitle`, `CardContent`, `StatCard`, `Input`, `Select`, `Table`/`Thead`/`Th`/`Tbody`/`Tr`/`Td`, `Modal`, `PageHeader`, `EmptyState`, `Spinner`. All support both light and dark mode. Import from `@shared/components/ui`.

### Supabase tables

| Table | Purpose |
|-------|---------|
| `tenants` | Client companies |
| `tenant_users` | User ↔ tenant membership + role |
| `tenant_modules` | Which modules a tenant has installed |
| `tenant_user_permissions` | Per-user per-module/feature action overrides |
| `module_catalog` | DB-driven module display metadata + menu items |

Business tables (`invoices`, `products`, `employees`, …) all carry `tenant_id`.

The entire schema is one file: [sql/nexuserp_schema.sql](sql/nexuserp_schema.sql) — tables, RLS, indexes, sequences, RPCs, triggers, and the `module_catalog` seed. Run it by hand in the Supabase SQL editor; it is fully idempotent, so schema changes mean **editing that file and re-running it**, not adding a new one. Its header documents the conflicts resolved when the previous 26 migration files were consolidated.

Configure via `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`. Super-admin users are flagged via `user_metadata.is_super_admin = true` in Supabase Auth.

### Adding a new module

1. Create `src/modules/<name>/{api,components,hooks,pages}/` and `index.js` with the manifest shape above.
2. Add a row to `module_catalog` (name, description, icon, menuItems, features, etc.) — this is now MANDATORY, not optional.
3. Register the manifest in `src/app/Shell.jsx` (the array passed to `registry.register`).
4. Add the icon string to `ICON_MAP` in `src/app/Sidebar.jsx` if using a new Lucide icon.
5. Add the tables (each with `tenant_id`), indexes and RLS policies to `sql/nexuserp_schema.sql`, then re-run it.

### Adding a page to an existing module

1. `pages/NewPage.jsx`
2. one entry in the manifest's `routes[]`
3. if it should appear in the nav, one entry in that module's `module_catalog.menu_items` (with `requiredPermission` if it needs gating)

Router, sidebar and permission guard pick it up automatically — never register a route or nav item by hand.

## Conventions (hard rules)

1. **Tenant scoping** — every business-table query filters `.eq('tenant_id', tenantId)`. RLS is the second line of defence, not a replacement.
2. **The `api/` boundary** — `supabase` is imported only in `src/modules/*/api/`, `src/shared/api/`, `src/core/`, and `src/app/admin/`. Never in a page or component.
3. **Permission-gate every mutating control** — `<PermissionGate action="…" moduleId="…">` around create/edit/delete/approve/export buttons. Import `ACTIONS`/`ROLES` for logic; don't use raw strings.
4. **Routes come from manifests** — never touch `DynamicRouter` to add a page, or `PermissionRoute` won't wrap it.
5. **Nothing hardcodes a `moduleId`** in `src/core/` or `Sidebar.jsx`.
6. **`window.__erp_*` is write-only from `useAuth.js` and `TenantContext.jsx`.** Read anywhere; write nowhere else.
7. **Both light and `dark:` variants** on every colour class. Tailwind classes must be literal strings — interpolated class names are invisible to the JIT scanner.
8. **Status labels/colours live in `@shared/lib/constants.js`**, base components in `@shared/components/ui`.
9. **List pages use `useResourceList`** with a `useCallback`-wrapped `fetchFn` and `tenantId` in the dep array.
10. **Schema changes go in `sql/nexuserp_schema.sql`** and stay idempotent. Every table: `tenant_id` + both RLS policies + indexes.
11. **Bootstrap steps are sequential.** Don't parallelise or reorder them.
12. **A registry `subscribe()` must return its unsubscribe** from the `useEffect`.

## Tooling in `.claude/`

| Path | Purpose |
|------|---------|
| `skills/add-module/` | Full new-module flow: manifest, catalog row, Shell registration, ICON_MAP, SQL |
| `skills/add-list-page/` | The `useResourceList` CRUD list-page pattern |
| `skills/add-schema-change/` | Editing `sql/nexuserp_schema.sql` — tenant column, RLS, indexes, idempotency |
| `agents/erp-conventions.md` | Reviews a diff against the hard rules above |
| `settings.json` | Permission allowlist (npm scripts, read-only git); `.env` denied |
