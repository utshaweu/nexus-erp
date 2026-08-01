---
name: add-schema-change
description: Add or alter a table, column, RLS policy, index, RPC, or trigger in NexusERP's single-file schema (sql/nexuserp_schema.sql) — tenant-scoped, two standard RLS policies, idempotent re-runnable DDL. Use for any Supabase schema change in this project.
---

# Change the schema

The whole schema lives in **one file**: `sql/nexuserp_schema.sql`. It is run **by
hand** in the Supabase SQL editor — there is no migration runner — so every
statement must be **idempotent**, and a change means editing that file and
re-running the whole thing.

Do NOT create a new `*_addendum.sql`. The 26 old addendum files were consolidated
precisely because their ordering and duplicate definitions conflicted; the header
of `nexuserp_schema.sql` documents what that cost.

Put each new object in the section it belongs to (PART 5 tables, PART 8
sequences, PART 9 RPCs, PART 11 indexes), and add the table name to the bulk-RLS
array in PART 6 and the trigger array in PART 10 if it has `updated_at`.

## Table template

```sql
CREATE TABLE IF NOT EXISTS things (
  id         UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  parent_id  UUID          REFERENCES parents(id) ON DELETE CASCADE,
  name       TEXT          NOT NULL,
  amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  status     TEXT          NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- …then add 'things' to the bulk-RLS array in PART 6, which applies:
--   CREATE POLICY "super_admin_things" ON things FOR ALL USING (is_super_admin());
--   CREATE POLICY "tenant_things"      ON things FOR ALL USING (tenant_id = current_tenant_id());

-- …and the indexes in PART 11:
CREATE INDEX IF NOT EXISTS idx_things_tenant ON things (tenant_id);
CREATE INDEX IF NOT EXISTS idx_things_parent ON things (parent_id);
```

## Non-negotiables

- **Every** business table has `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`.
- **Every** business table is listed in the PART 6 bulk-RLS array, which gives it
  the `is_super_admin()` and `tenant_id = current_tenant_id()` policies. Don't
  redefine those helper functions (PART 2) — `current_tenant_id()` and
  `current_user_role()` must stay `SECURITY DEFINER` or RLS recurses infinitely.
- Policy names are `super_admin_<table>` / `tenant_<table>`, always preceded by
  `DROP POLICY IF EXISTS` so the file re-runs cleanly.
- Index `tenant_id` and every FK column — every query filters by tenant.
- Money is `NUMERIC(12,2)`, quantities `NUMERIC(10,2)`. Never `FLOAT`.
- Timestamps are `TIMESTAMPTZ NOT NULL DEFAULT now()`.

## Idempotent forms

| Change | Form |
|--------|------|
| Table | `CREATE TABLE IF NOT EXISTS` |
| Column | `ALTER TABLE t ADD COLUMN IF NOT EXISTS c TYPE` |
| Index | `CREATE INDEX IF NOT EXISTS` |
| Policy | `DROP POLICY IF EXISTS` then `CREATE POLICY` |
| Function / RPC | `CREATE OR REPLACE FUNCTION` |
| Seed row | `INSERT … ON CONFLICT (pk) DO UPDATE SET …` |

## After editing

State plainly that `sql/nexuserp_schema.sql` must be re-run manually in the
Supabase SQL editor — nothing in the app applies it. If the change adds a module,
remind the user the `module_catalog` seed row (PART 12) is part of it.
