---
name: add-list-page
description: Build a NexusERP CRUD list page following the house pattern — api/ fetch function returning {items,total}, useResourceList, PageHeader/Card/ListToolbar/Table/Pagination, PermissionGate on every action, and a save modal. Use when adding or rewriting any list/index page in a module (products, invoices, employees, vendors, …).
---

# Add a list page

Every list page in every module follows this shape. Reference implementation:
`src/modules/accounts/pages/Invoices.jsx`. Copy it and adapt rather than inventing.

## 1. The API function — `src/modules/<mod>/api/<thing>.js`

Pages never import `supabase`. The API function does, and it:
- takes `tenantId` first, bails on falsy,
- filters `.eq('tenant_id', tenantId)`,
- returns `{ items, total }`,
- throws on error (the page toasts it).

```js
import { supabase } from '@shared/api/supabase'
import { PAGE_SIZE_TABLE as PAGE_SIZE } from '@shared/lib/constants'

export async function fetchThings(tenantId, { page, search, filter }) {
  if (!tenantId) return { items: [], total: 0 }

  let query = supabase
    .from('things')
    .select('*, related:related_id(name)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (filter !== 'all')  query = query.eq('status', filter)
  if (search.trim())     query = query.ilike('name', `%${search.trim()}%`)

  const { data, count, error } = await query
  if (error) throw error
  return { items: data || [], total: count || 0 }
}

export async function saveThing(tenantId, thing, data) { /* insert or update */ }
export async function deleteThing(thing) { /* … */ }
```

Use `PAGE_SIZE_GRID` instead for card-grid pages (vendors, customers).

## 2. Status constants → `src/shared/lib/constants.js`

Never inline label/colour maps.

```js
export const THING_STATUS = {
  draft:  { label: 'Draft',  color: 'default' },
  active: { label: 'Active', color: 'green'   },
}
export const THING_STATUS_TABS = ['all', 'draft', 'active']
```

`Badge` colours in use: `default green red blue purple yellow orange`.

## 3. The page

```jsx
export default function Things() {
  const { tenantId } = useTenant()

  const fetchFn = useCallback(params => fetchThings(tenantId, params), [tenantId])
  const {
    items: things, total, page, setPage, search, setSearch,
    filter: statusFilter, setFilter: setStatusFilter,
    loading, refetch, showModal, editItem: editThing, openNew, openEdit, closeModal,
  } = useResourceList(fetchFn, [tenantId])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const searching  = Boolean(search || statusFilter !== 'all')

  const handleDelete = async (thing) => {
    if (!window.confirm(`Delete ${thing.name}? This cannot be undone.`)) return
    try { await deleteThing(thing); toast.success('Thing deleted.'); refetch() }
    catch (err) { toast.error(err.message) }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Things" subtitle="…" breadcrumb="Module / Things"
        actions={
          <PermissionGate action="create" moduleId="<mod>">
            <Button size="sm" onClick={openNew} className="gap-1.5">
              <Plus className="w-4 h-4" />New Thing
            </Button>
          </PermissionGate>
        }
      />

      <Card>
        <ListToolbar
          search={search} onSearchChange={setSearch}
          placeholder="Search by name…"
          tabs={STATUS_TABS} activeTab={statusFilter} onTabChange={setStatusFilter}
        />

        {loading ? (
          <ListLoading color="indigo" icon={Package} label="Loading things…" />
        ) : things.length === 0 ? (
          <ListEmptyState color="indigo" icon={Package} searching={searching} … />
        ) : (
          <Table>
            <Thead><Th>Name</Th><Th>Status</Th><Th></Th></Thead>
            <Tbody>
              {things.map(t => (
                <Tr key={t.id} onClick={() => openEdit(t)}>
                  <Td>{t.name}</Td>
                  <Td><Badge color={THING_STATUS[t.status]?.color}>{THING_STATUS[t.status]?.label}</Badge></Td>
                  <Td onClick={e => e.stopPropagation()}>
                    <PermissionGate action="edit"   moduleId="<mod>">…</PermissionGate>
                    <PermissionGate action="delete" moduleId="<mod>">…</PermissionGate>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}

        <Pagination
          page={page} totalPages={totalPages} onPageChange={setPage}
          total={total} pageSize={PAGE_SIZE} label="things"
          className="border-t border-surface-200 dark:border-surface-800"
        />
      </Card>

      <ThingModal open={showModal} onClose={closeModal} onSaved={refetch} thing={editThing} />
    </div>
  )
}
```

## Rules for this pattern

- `fetchFn` **must** be wrapped in `useCallback` and `tenantId` passed in
  `useResourceList`'s dep array, or the list won't refetch on tenant change.
- Don't add your own `loading` / `page` / `search` state — `useResourceList` owns it,
  including stale-response protection.
- Every mutating control is wrapped in `PermissionGate` with the module's id.
- Row-level action cells need `onClick={e => e.stopPropagation()}` when the `Tr`
  itself is clickable.
- Both light and `dark:` Tailwind variants on every colour class.
- `ListToolbar` / `ListStates`: some modules have local copies under
  `components/`, and there's a shared `@shared/components/ListToolbar`. Use whichever
  the module already uses — don't introduce a third.
- Dropdown-select data (customers, products) loads in its own `useEffect`, not
  through `useResourceList`.
