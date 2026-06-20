-- ============================================================
--  NexusERP — Approval Module Addendum
--  Run AFTER nexuserp_complete_migration.sql (or supabase_schema.sql)
--  Safe to re-run (idempotent via IF NOT EXISTS / CREATE OR REPLACE).
--
--  This file:
--    1. Creates all four approval tables (IF NOT EXISTS)
--    2. Ensures sequences & number generator exist (IF NOT EXISTS)
--    3. Adds updated_at auto-trigger on approval_requests
--    4. Applies RLS (DROP + re-CREATE for idempotency)
--    5. Adds performance indexes
-- ============================================================

-- ────────────────────────────────────────────────────────────
--  1 — SEQUENCES & NUMBER GENERATOR
-- ────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS apr_seq START 1;

CREATE OR REPLACE FUNCTION generate_apr_number()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'APR-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('apr_seq')::TEXT, 4, '0');
$$;

-- ────────────────────────────────────────────────────────────
--  2 — TABLES (IF NOT EXISTS — safe when schema already ran)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS approval_workflows (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL,
  module            TEXT        NOT NULL,
  trigger_condition TEXT,
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS approval_workflow_steps (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_id   UUID        NOT NULL REFERENCES approval_workflows(id) ON DELETE CASCADE,
  step_order    INT         NOT NULL,
  step_name     TEXT        NOT NULL,
  approver_role TEXT        NOT NULL,
  approval_type TEXT        NOT NULL DEFAULT 'any'
    CHECK (approval_type IN ('any', 'all')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS approval_requests (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_number TEXT        NOT NULL,
  workflow_id    UUID        REFERENCES approval_workflows(id),
  title          TEXT        NOT NULL,
  description    TEXT,
  module         TEXT        NOT NULL,
  record_id      UUID,
  record_type    TEXT,
  amount         NUMERIC(15, 2),
  priority       TEXT        NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status         TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  current_step   INT         NOT NULL DEFAULT 1,
  requested_by   UUID        REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, request_number)
);

CREATE TABLE IF NOT EXISTS approval_actions (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_id  UUID        NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  step_number INT         NOT NULL,
  action      TEXT        NOT NULL
    CHECK (action IN ('approved', 'rejected', 'delegated')),
  actor_id    UUID        REFERENCES auth.users(id),
  comment     TEXT,
  acted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
--  3 — UPDATED_AT AUTO-TRIGGER
-- ────────────────────────────────────────────────────────────

-- Generic touch function (shared across modules)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger: approval_requests
DROP TRIGGER IF EXISTS trg_approval_requests_updated_at ON approval_requests;
CREATE TRIGGER trg_approval_requests_updated_at
  BEFORE UPDATE ON approval_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Trigger: approval_workflows
DROP TRIGGER IF EXISTS trg_approval_workflows_updated_at ON approval_workflows;
CREATE TRIGGER trg_approval_workflows_updated_at
  BEFORE UPDATE ON approval_workflows
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ────────────────────────────────────────────────────────────
--  4 — ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────

-- Enable RLS (idempotent)
ALTER TABLE approval_workflows       ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_workflow_steps  ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_actions         ENABLE ROW LEVEL SECURITY;

-- approval_workflows
DROP POLICY IF EXISTS "super_admin_approval_workflows" ON approval_workflows;
DROP POLICY IF EXISTS "tenant_approval_workflows"      ON approval_workflows;
CREATE POLICY "super_admin_approval_workflows" ON approval_workflows
  FOR ALL USING (is_super_admin());
CREATE POLICY "tenant_approval_workflows"      ON approval_workflows
  FOR ALL USING (tenant_id = current_tenant_id());

-- approval_workflow_steps
DROP POLICY IF EXISTS "super_admin_approval_workflow_steps" ON approval_workflow_steps;
DROP POLICY IF EXISTS "tenant_approval_workflow_steps"      ON approval_workflow_steps;
CREATE POLICY "super_admin_approval_workflow_steps" ON approval_workflow_steps
  FOR ALL USING (is_super_admin());
CREATE POLICY "tenant_approval_workflow_steps"      ON approval_workflow_steps
  FOR ALL USING (tenant_id = current_tenant_id());

-- approval_requests
DROP POLICY IF EXISTS "super_admin_approval_requests" ON approval_requests;
DROP POLICY IF EXISTS "tenant_approval_requests"      ON approval_requests;
CREATE POLICY "super_admin_approval_requests" ON approval_requests
  FOR ALL USING (is_super_admin());
CREATE POLICY "tenant_approval_requests"      ON approval_requests
  FOR ALL USING (tenant_id = current_tenant_id());

-- approval_actions
DROP POLICY IF EXISTS "super_admin_approval_actions" ON approval_actions;
DROP POLICY IF EXISTS "tenant_approval_actions"      ON approval_actions;
CREATE POLICY "super_admin_approval_actions" ON approval_actions
  FOR ALL USING (is_super_admin());
CREATE POLICY "tenant_approval_actions"      ON approval_actions
  FOR ALL USING (tenant_id = current_tenant_id());

-- ────────────────────────────────────────────────────────────
--  5 — PERFORMANCE INDEXES
-- ────────────────────────────────────────────────────────────

-- approval_requests — primary list-page queries
CREATE INDEX IF NOT EXISTS idx_approval_requests_tenant_status
  ON approval_requests (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_approval_requests_tenant_requested_by
  ON approval_requests (tenant_id, requested_by);

CREATE INDEX IF NOT EXISTS idx_approval_requests_tenant_created
  ON approval_requests (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_approval_requests_tenant_updated
  ON approval_requests (tenant_id, updated_at DESC);

-- approval_workflow_steps — join from requests
CREATE INDEX IF NOT EXISTS idx_approval_workflow_steps_workflow
  ON approval_workflow_steps (workflow_id, step_order);

-- approval_actions — audit trail fetch
CREATE INDEX IF NOT EXISTS idx_approval_actions_request
  ON approval_actions (request_id, acted_at);

-- approval_workflows — module filter
CREATE INDEX IF NOT EXISTS idx_approval_workflows_tenant_module
  ON approval_workflows (tenant_id, module, is_active);

-- ────────────────────────────────────────────────────────────
--  6 — GRANT RPC EXECUTE TO ANON / AUTHENTICATED
-- ────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION generate_apr_number() TO anon, authenticated;
