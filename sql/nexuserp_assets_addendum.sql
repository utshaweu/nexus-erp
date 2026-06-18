-- ============================================================
--  NexusERP — Assets Module Addendum
--  Run AFTER nexuserp_complete_migration.sql
--  Safe to re-run (idempotent).
--
--  Adds:
--    1. asset_categories               — category definitions with depreciation defaults
--    2. assets                         — fixed asset registry
--    3. asset_depreciation_schedules   — yearly depreciation schedule entries per asset
--    4. asset_maintenance_logs         — maintenance / service records
--    5. Number-generator functions
--    6. Performance indexes
-- ============================================================

-- ────────────────────────────────────────────────────────────
--  1 — SEQUENCES & NUMBER GENERATORS
-- ────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS asset_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS maint_log_seq    START 1;

CREATE OR REPLACE FUNCTION generate_asset_number()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'AST-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('asset_number_seq')::TEXT,4,'0');
$$;

CREATE OR REPLACE FUNCTION generate_maintenance_log_number()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'MNT-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('maint_log_seq')::TEXT,4,'0');
$$;

-- ────────────────────────────────────────────────────────────
--  2 — ASSET CATEGORIES
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS asset_categories (
  id                   UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                 TEXT         NOT NULL,
  description          TEXT,
  depreciation_method  TEXT         NOT NULL DEFAULT 'straight_line'
                         CHECK (depreciation_method IN ('straight_line','declining_balance')),
  default_useful_life  INTEGER      NOT NULL DEFAULT 5
                         CHECK (default_useful_life BETWEEN 1 AND 99),
  default_salvage_rate NUMERIC(5,2) NOT NULL DEFAULT 10
                         CHECK (default_salvage_rate BETWEEN 0 AND 100),
  is_active            BOOLEAN      NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

ALTER TABLE asset_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_asset_categories" ON asset_categories;
DROP POLICY IF EXISTS "tenant_asset_categories"      ON asset_categories;
CREATE POLICY "super_admin_asset_categories" ON asset_categories FOR ALL USING (is_super_admin());
CREATE POLICY "tenant_asset_categories"      ON asset_categories FOR ALL USING (tenant_id = current_tenant_id());

-- ────────────────────────────────────────────────────────────
--  3 — ASSETS
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS assets (
  id                       UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id                UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  asset_number             TEXT          NOT NULL,
  name                     TEXT          NOT NULL,
  description              TEXT,
  category_id              UUID          REFERENCES asset_categories(id) ON DELETE SET NULL,
  status                   TEXT          NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active','maintenance','disposed','fully_depreciated')),
  purchase_date            DATE          NOT NULL,
  purchase_cost            NUMERIC(15,2) NOT NULL DEFAULT 0,
  salvage_value            NUMERIC(15,2) NOT NULL DEFAULT 0,
  useful_life_years        INTEGER       NOT NULL DEFAULT 5
                             CHECK (useful_life_years BETWEEN 1 AND 99),
  depreciation_method      TEXT          NOT NULL DEFAULT 'straight_line'
                             CHECK (depreciation_method IN ('straight_line','declining_balance')),
  accumulated_depreciation NUMERIC(15,2) NOT NULL DEFAULT 0,
  book_value               NUMERIC(15,2) NOT NULL DEFAULT 0,
  location                 TEXT,
  serial_number            TEXT,
  warranty_expiry          DATE,
  disposal_date            DATE,
  disposal_amount          NUMERIC(15,2),
  notes                    TEXT,
  created_by               UUID          REFERENCES auth.users(id),
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, asset_number)
);

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_assets" ON assets;
DROP POLICY IF EXISTS "tenant_assets"      ON assets;
CREATE POLICY "super_admin_assets" ON assets FOR ALL USING (is_super_admin());
CREATE POLICY "tenant_assets"      ON assets FOR ALL USING (tenant_id = current_tenant_id());

-- ────────────────────────────────────────────────────────────
--  4 — ASSET DEPRECIATION SCHEDULES
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS asset_depreciation_schedules (
  id                       UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id                UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  asset_id                 UUID          NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  period_date              DATE          NOT NULL,
  period_label             TEXT          NOT NULL,
  depreciation_amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
  accumulated_depreciation NUMERIC(15,2) NOT NULL DEFAULT 0,
  book_value_after         NUMERIC(15,2) NOT NULL DEFAULT 0,
  status                   TEXT          NOT NULL DEFAULT 'scheduled'
                             CHECK (status IN ('scheduled','posted','cancelled')),
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE asset_depreciation_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_asset_depr_sched" ON asset_depreciation_schedules;
DROP POLICY IF EXISTS "tenant_asset_depr_sched"      ON asset_depreciation_schedules;
CREATE POLICY "super_admin_asset_depr_sched" ON asset_depreciation_schedules FOR ALL USING (is_super_admin());
CREATE POLICY "tenant_asset_depr_sched"      ON asset_depreciation_schedules FOR ALL USING (tenant_id = current_tenant_id());

-- ────────────────────────────────────────────────────────────
--  5 — ASSET MAINTENANCE LOGS
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS asset_maintenance_logs (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  asset_id         UUID          NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  log_number       TEXT          NOT NULL,
  maintenance_type TEXT          NOT NULL DEFAULT 'preventive'
                     CHECK (maintenance_type IN ('preventive','corrective','emergency','inspection')),
  status           TEXT          NOT NULL DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  scheduled_date   DATE          NOT NULL,
  completed_date   DATE,
  description      TEXT          NOT NULL,
  cost             NUMERIC(15,2) NOT NULL DEFAULT 0,
  performed_by     TEXT,
  notes            TEXT,
  created_by       UUID          REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, log_number)
);

ALTER TABLE asset_maintenance_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_asset_maint" ON asset_maintenance_logs;
DROP POLICY IF EXISTS "tenant_asset_maint"      ON asset_maintenance_logs;
CREATE POLICY "super_admin_asset_maint" ON asset_maintenance_logs FOR ALL USING (is_super_admin());
CREATE POLICY "tenant_asset_maint"      ON asset_maintenance_logs FOR ALL USING (tenant_id = current_tenant_id());

-- ────────────────────────────────────────────────────────────
--  6 — COLUMN MIGRATIONS
--  If any of the tables above were created by an earlier base
--  migration the CREATE TABLE IF NOT EXISTS blocks were no-ops.
--  These ALTER TABLE statements backfill every column the Assets
--  module requires that the v1 schema was missing.
-- ────────────────────────────────────────────────────────────

-- asset_categories: v1 only had name, code, depreciation_method,
--   useful_life_years, salvage_value_pct — add the four columns
--   that the Assets module actually reads/writes.
ALTER TABLE asset_categories ADD COLUMN IF NOT EXISTS description          TEXT;
ALTER TABLE asset_categories ADD COLUMN IF NOT EXISTS default_useful_life  INTEGER      NOT NULL DEFAULT 5;
ALTER TABLE asset_categories ADD COLUMN IF NOT EXISTS default_salvage_rate NUMERIC(5,2) NOT NULL DEFAULT 10;
ALTER TABLE asset_categories ADD COLUMN IF NOT EXISTS is_active            BOOLEAN      NOT NULL DEFAULT true;

-- assets: v1 was missing these columns.
ALTER TABLE assets ADD COLUMN IF NOT EXISTS accumulated_depreciation NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS disposal_date            DATE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS disposal_amount          NUMERIC(15,2);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS notes                    TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS created_by               UUID REFERENCES auth.users(id);

-- asset_maintenance_logs: v1 had a very different schema —
--   maintenance_date/next_maintenance_date instead of scheduled/completed,
--   and no status, log_number, notes, updated_at, or created_by.
ALTER TABLE asset_maintenance_logs ADD COLUMN IF NOT EXISTS log_number     TEXT;
ALTER TABLE asset_maintenance_logs ADD COLUMN IF NOT EXISTS status         TEXT NOT NULL DEFAULT 'scheduled'
  CHECK (status IN ('scheduled','in_progress','completed','cancelled'));
ALTER TABLE asset_maintenance_logs ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE asset_maintenance_logs ADD COLUMN IF NOT EXISTS completed_date DATE;
ALTER TABLE asset_maintenance_logs ADD COLUMN IF NOT EXISTS notes          TEXT;
ALTER TABLE asset_maintenance_logs ADD COLUMN IF NOT EXISTS created_by     UUID REFERENCES auth.users(id);
ALTER TABLE asset_maintenance_logs ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT now();

-- Unique constraint on (tenant_id, log_number) — skip if already present.
DO $$ BEGIN
  ALTER TABLE asset_maintenance_logs
    ADD CONSTRAINT asset_maintenance_logs_tenant_log_key UNIQUE (tenant_id, log_number);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ────────────────────────────────────────────────────────────
--  7 — PERFORMANCE INDEXES
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_asset_categories_tenant
  ON asset_categories(tenant_id);

CREATE INDEX IF NOT EXISTS idx_assets_tenant_status
  ON assets(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_assets_tenant_category
  ON assets(tenant_id, category_id);
CREATE INDEX IF NOT EXISTS idx_assets_tenant_date
  ON assets(tenant_id, purchase_date DESC);

CREATE INDEX IF NOT EXISTS idx_asset_depr_asset_id
  ON asset_depreciation_schedules(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_depr_tenant_status
  ON asset_depreciation_schedules(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_asset_depr_period
  ON asset_depreciation_schedules(tenant_id, period_date);

CREATE INDEX IF NOT EXISTS idx_asset_maint_asset_id
  ON asset_maintenance_logs(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_maint_tenant_status
  ON asset_maintenance_logs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_asset_maint_scheduled
  ON asset_maintenance_logs(tenant_id, scheduled_date DESC);

-- ────────────────────────────────────────────────────────────
--  DONE
-- ============================================================
