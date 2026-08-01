---
name: add-module
description: Scaffold a new NexusERP feature module end-to-end — folder + manifest, module_catalog seed row, Shell.jsx registration, Sidebar ICON_MAP entry, and the SQL addendum. Use when adding a new module (e.g. "add a CRM module", "new manufacturing module"), or when a module exists in code but has no name/icon/menu items in the sidebar.
---

# Add a NexusERP module

Five steps. Skipping any one leaves a module that half-works — most commonly a
missing `module_catalog` row, which makes the module invisible in the sidebar and
the App Store.

## 1. Folder + manifest

```
src/modules/<name>/
├── index.js
├── api/          # Supabase queries only
├── components/   # modals, tables, cards
├── hooks/        # optional
└── pages/        # route targets
```

`index.js` owns ONLY the non-serialisable parts. No `name`, `icon`, `menuItems`,
`description`, `features` here — those live in the DB.

```js
/**
 * <Name> module manifest (code side).
 * Display metadata lives in the `module_catalog` DB table and is merged in by
 * the ModuleRegistry at login.
 */
const <name>Module = {
  id: '<name>',

  routes: [
    { path: '/<name>',            component: () => import('./pages/Dashboard') },
    { path: '/<name>/things',     component: () => import('./pages/Things') },
    { path: '/<name>/things/:id', component: () => import('./pages/ThingDetail') },
  ],

  storeSlice: (set) => ({          // optional — omit if the module has no global state
    <name>: { items: [] },
    set<Name>Items: (items) => set(state => ({ <name>: { ...state.<name>, items } })),
  }),

  onInstall:   async () => { console.log('[<Name>] Module installed') },
  onUninstall: async () => { console.log('[<Name>] Module uninstalled') },
}

export default <name>Module
```

## 2. `module_catalog` row — MANDATORY

Add it to the PART 12 seed block in `sql/nexuserp_schema.sql`, matching the style
of the nine rows already there.

```sql
INSERT INTO module_catalog
  (module_id, name, description, version, icon, color, category,
   features, dependencies, menu_items, sort_order)
VALUES (
  '<name>', '<Display Name>',
  '<One-sentence description shown in the App Store.>',
  '1.0.0', '<LucideIconName>', '#6366f1', 'Operations',
  '["Feature one","Feature two"]'::jsonb,
  '[]'::jsonb,                    -- module ids this depends on
  '[
    {"id":"<name>-dashboard","label":"Dashboard","path":"/<name>","icon":"LayoutDashboard","order":1,
     "requiredPermission":{"action":"view","moduleId":"<name>"}},
    {"id":"<name>-things","label":"Things","path":"/<name>/things","icon":"Package","order":2,
     "requiredPermission":{"action":"view","moduleId":"<name>"}}
  ]'::jsonb,
  10
)
ON CONFLICT (module_id) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, icon = EXCLUDED.icon,
  color = EXCLUDED.color, category = EXCLUDED.category, features = EXCLUDED.features,
  dependencies = EXCLUDED.dependencies, menu_items = EXCLUDED.menu_items,
  sort_order = EXCLUDED.sort_order, updated_at = now();
```

Notes:
- `menu_items[].path` must exactly match a manifest `routes[].path` for the sidebar
  active state and the route's feature gate to line up.
- Detail routes (`/<name>/things/:id`) get **no** menu item — the parent item stays
  highlighted via the depth-based match in `Sidebar.jsx`.
- For per-menu-item permission gating, add `"featureId":"<name>.things"` inside
  `requiredPermission`. Without it the item is gated at module level only.

## 3. Register in `src/app/Shell.jsx`

```js
import <name>Module from '@modules/<name>'
// …then add it to the array passed to registry.register
```

## 4. `ICON_MAP` in `src/app/Sidebar.jsx`

Every Lucide icon name used in `menu_items[].icon` must be imported and added to
`ICON_MAP`, or it silently renders `LayoutDashboard`. The module-level `icon`
(catalog `icon` column) is resolved separately by `@shared/lib/moduleIcons`.

## 5. Schema

Add the module's tables to `sql/nexuserp_schema.sql` (PART 5), list them in the
PART 6 bulk-RLS array, and add indexes in PART 11. Use the `add-schema-change`
skill for the exact shape. Every table needs `tenant_id UUID NOT NULL REFERENCES
tenants(id) ON DELETE CASCADE`. Re-run the file in the Supabase SQL editor.

## Verify

- `npm run build` passes.
- Install the module for a tenant at `/apps`.
- Sidebar shows the module with its icon, colour and every menu item.
- A `viewer`-role user does **not** see it until granted VIEW at `/team`.
- Typing a module URL directly as that user redirects to `/`.
