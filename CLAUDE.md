# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

Every feature is a **module manifest** (`src/modules/<name>/index.js`). A manifest declares:

```js
{
  id, name, description, version, icon, color, category,
  dependencies: [],     // other module ids required before install
  menuItems: [{ id, label, path, icon, requiredPermission }],
  routes: [{ path, component: () => import('./pages/SomePage') }],
  storeSlice: (set) => ({ ... }),  // optional Zustand slice
  onInstall: async () => {},
  onUninstall: async () => {},
}
```

All manifests are registered in `src/app/Shell.jsx` before any login. `ModuleRegistry` (singleton at `src/core/registry/ModuleRegistry.js`) manages install state per tenant, persists to `tenant_modules` in Supabase with localStorage fallback.

### Routing

`DynamicRouter` (`src/core/router/DynamicRouter.jsx`) builds routes at runtime from installed manifests. Module routes are lazy-loaded and wrapped in `PermissionRoute` (VIEW check) automatically. Core routes (`/`, `/apps`, `/team`, `/admin`) are always present.

### Permission system

Three-level resolution in `src/core/permissions/permissions.js` (pure functions, no React):

1. `isSuperAdmin` → always true
2. Explicit DB override (`tenant_user_permissions` table) → true/false
3. Role default (`ROLE_DEFAULTS`) → viewer/user/manager/admin/owner matrix

`PermissionContext` exposes `can(action, moduleId)` reactively. `usePermissions()` is the hook. The `ACTIONS` and `ROLES` constants are the source of truth — import them instead of using raw strings.

### State management

- **Zustand** (`src/core/store/useStore.js`): auth session, UI state (sidebar, theme). Module slices are added dynamically via `_addSlice`. Persisted to `localStorage` as `erp-ui-store` (only `theme` and `sidebarOpen`).
- **TenantContext**: React context for tenant/membership data. Lives outside Zustand so the whole tree re-renders on tenant switch.
- **PermissionContext**: React context for RBAC state. Depends on TenantContext.
- **Globals**: `window.__erp_user__`, `window.__erp_tenant__`, `window.__erp_tenant_user__` — set by useAuth/TenantContext for non-React consumers (EventBus handlers, etc.).

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
| `tenant_user_permissions` | Per-user per-module action overrides |

Configure via `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`. Super-admin users are flagged via `user_metadata.is_super_admin = true` in Supabase Auth.

### Adding a new module

1. Create `src/modules/<name>/index.js` with the manifest shape above.
2. Create page components under `src/modules/<name>/pages/`.
3. Register the manifest in `src/app/Shell.jsx` (the array passed to `registry.register`).
4. Add the icon string to `ICON_MAP` in `src/app/Sidebar.jsx` if using a new Lucide icon.
