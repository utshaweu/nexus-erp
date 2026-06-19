-- ============================================================
--  NexusERP — HR Module (Complete)
--  Run AFTER nexuserp_complete_migration.sql
--  Safe to re-run (idempotent via CREATE … IF NOT EXISTS).
--
--  Adds:
--    1.  Sequences & number generators
--    2.  hr_departments
--    3.  hr_positions
--    4.  hr_employees         (includes user_id link to auth.users)
--    5.  hr_leave_types
--    6.  hr_leave_requests
--    7.  hr_payroll_runs
--    8.  hr_payroll_entries
--    9.  hr_attendance
--    10. hr_movements         — out-of-office requests
--    11. hr_leave_balances    — per-employee leave balance per year
--    12. Performance indexes
-- ============================================================

-- ────────────────────────────────────────────────────────────
--  1 — SEQUENCES & NUMBER GENERATORS
-- ────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS employee_number_seq    START 1;
CREATE SEQUENCE IF NOT EXISTS payroll_run_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_employee_number()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'EMP-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('employee_number_seq')::TEXT,4,'0');
$$;

CREATE OR REPLACE FUNCTION generate_payroll_run_number()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'PAY-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('payroll_run_number_seq')::TEXT,4,'0');
$$;

-- ────────────────────────────────────────────────────────────
--  2 — HR DEPARTMENTS
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_departments (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  description TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

ALTER TABLE hr_departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_hr_departments" ON hr_departments;
DROP POLICY IF EXISTS "tenant_hr_departments"      ON hr_departments;
CREATE POLICY "super_admin_hr_departments" ON hr_departments FOR ALL USING (is_super_admin());
CREATE POLICY "tenant_hr_departments"      ON hr_departments FOR ALL USING (tenant_id = current_tenant_id());

-- ────────────────────────────────────────────────────────────
--  3 — HR POSITIONS
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_positions (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  department_id UUID        REFERENCES hr_departments(id) ON DELETE SET NULL,
  title         TEXT        NOT NULL,
  description   TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, title, department_id)
);

ALTER TABLE hr_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_hr_positions" ON hr_positions;
DROP POLICY IF EXISTS "tenant_hr_positions"      ON hr_positions;
CREATE POLICY "super_admin_hr_positions" ON hr_positions FOR ALL USING (is_super_admin());
CREATE POLICY "tenant_hr_positions"      ON hr_positions FOR ALL USING (tenant_id = current_tenant_id());

-- ────────────────────────────────────────────────────────────
--  4 — HR EMPLOYEES
--  user_id links an employee to an auth user account,
--  enabling self-service leave/movement for normal users.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_employees (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_number TEXT          NOT NULL,

  -- Auth user link (optional) — enables self-service leave/movement portal
  user_id         UUID          REFERENCES auth.users(id) ON DELETE SET NULL, -- links to auth user

  -- Personal
  first_name      TEXT          NOT NULL,
  last_name       TEXT          NOT NULL,
  email           TEXT,
  phone           TEXT,
  gender          TEXT          CHECK (gender IN ('male','female','other','prefer_not_to_say')),
  date_of_birth   DATE,
  address         TEXT,
  nationality     TEXT,

  -- Employment
  join_date       DATE          NOT NULL DEFAULT CURRENT_DATE,
  employment_type TEXT          NOT NULL DEFAULT 'full_time'
                    CHECK (employment_type IN ('full_time','part_time','contract','intern')),
  status          TEXT          NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','inactive','on_leave','terminated')),
  department_id   UUID          REFERENCES hr_departments(id) ON DELETE SET NULL,
  position_id     UUID          REFERENCES hr_positions(id)   ON DELETE SET NULL,
  manager_id      UUID          REFERENCES hr_employees(id)   ON DELETE SET NULL,

  -- Compensation
  basic_salary        NUMERIC(15,2) NOT NULL DEFAULT 0,
  bank_account_name   TEXT,
  bank_account_number TEXT,
  bank_name           TEXT,

  notes      TEXT,
  created_by UUID          REFERENCES auth.users(id),
  created_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, employee_number)
);

-- One employee per linked user (no dual-linking)
CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_employees_user_id_unique
  ON hr_employees(user_id) WHERE user_id IS NOT NULL;

ALTER TABLE hr_employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_hr_employees" ON hr_employees;
DROP POLICY IF EXISTS "tenant_hr_employees"      ON hr_employees;
CREATE POLICY "super_admin_hr_employees" ON hr_employees FOR ALL USING (is_super_admin());
CREATE POLICY "tenant_hr_employees"      ON hr_employees FOR ALL USING (tenant_id = current_tenant_id());

-- ────────────────────────────────────────────────────────────
--  5 — HR LEAVE TYPES
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_leave_types (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  days_allowed INTEGER     NOT NULL DEFAULT 0,
  is_paid      BOOLEAN     NOT NULL DEFAULT true,
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

ALTER TABLE hr_leave_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_hr_leave_types" ON hr_leave_types;
DROP POLICY IF EXISTS "tenant_hr_leave_types"      ON hr_leave_types;
CREATE POLICY "super_admin_hr_leave_types" ON hr_leave_types FOR ALL USING (is_super_admin());
CREATE POLICY "tenant_hr_leave_types"      ON hr_leave_types FOR ALL USING (tenant_id = current_tenant_id());

-- ────────────────────────────────────────────────────────────
--  6 — HR LEAVE REQUESTS
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_leave_requests (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID        NOT NULL REFERENCES tenants(id)      ON DELETE CASCADE,
  employee_id       UUID        NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  leave_type_id     UUID        REFERENCES hr_leave_types(id)        ON DELETE SET NULL,
  start_date        DATE        NOT NULL,
  end_date          DATE        NOT NULL,
  days_count        INTEGER     NOT NULL DEFAULT 1,
  reason            TEXT,
  status            TEXT        NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','approved','rejected','cancelled')),
  approved_by       UUID        REFERENCES auth.users(id),
  approved_at       TIMESTAMPTZ,
  rejection_reason  TEXT,
  created_by        UUID        REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE hr_leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_hr_leave_requests" ON hr_leave_requests;
DROP POLICY IF EXISTS "tenant_hr_leave_requests"      ON hr_leave_requests;
CREATE POLICY "super_admin_hr_leave_requests" ON hr_leave_requests FOR ALL USING (is_super_admin());
CREATE POLICY "tenant_hr_leave_requests"      ON hr_leave_requests FOR ALL USING (tenant_id = current_tenant_id());

-- ────────────────────────────────────────────────────────────
--  7 — HR PAYROLL RUNS
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_payroll_runs (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_number       TEXT          NOT NULL,
  period_month     INTEGER       NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year      INTEGER       NOT NULL,
  status           TEXT          NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','approved','paid','cancelled')),
  total_gross      NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_deductions NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_net        NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes            TEXT,
  approved_by      UUID          REFERENCES auth.users(id),
  approved_at      TIMESTAMPTZ,
  created_by       UUID          REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, run_number)
);

ALTER TABLE hr_payroll_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_hr_payroll_runs" ON hr_payroll_runs;
DROP POLICY IF EXISTS "tenant_hr_payroll_runs"      ON hr_payroll_runs;
CREATE POLICY "super_admin_hr_payroll_runs" ON hr_payroll_runs FOR ALL USING (is_super_admin());
CREATE POLICY "tenant_hr_payroll_runs"      ON hr_payroll_runs FOR ALL USING (tenant_id = current_tenant_id());

-- ────────────────────────────────────────────────────────────
--  8 — HR PAYROLL ENTRIES
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_payroll_entries (
  id             UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID          NOT NULL REFERENCES tenants(id)         ON DELETE CASCADE,
  payroll_run_id UUID          NOT NULL REFERENCES hr_payroll_runs(id) ON DELETE CASCADE,
  employee_id    UUID          NOT NULL REFERENCES hr_employees(id)    ON DELETE CASCADE,
  basic_salary   NUMERIC(15,2) NOT NULL DEFAULT 0,
  allowances     NUMERIC(15,2) NOT NULL DEFAULT 0,
  deductions     NUMERIC(15,2) NOT NULL DEFAULT 0,
  gross_salary   NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_salary     NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (payroll_run_id, employee_id)
);

ALTER TABLE hr_payroll_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_hr_payroll_entries" ON hr_payroll_entries;
DROP POLICY IF EXISTS "tenant_hr_payroll_entries"      ON hr_payroll_entries;
CREATE POLICY "super_admin_hr_payroll_entries" ON hr_payroll_entries FOR ALL USING (is_super_admin());
CREATE POLICY "tenant_hr_payroll_entries"      ON hr_payroll_entries FOR ALL USING (tenant_id = current_tenant_id());

-- ────────────────────────────────────────────────────────────
--  9 — HR ATTENDANCE
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_attendance (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID        NOT NULL REFERENCES tenants(id)      ON DELETE CASCADE,
  employee_id    UUID        NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  date           DATE        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'present'
                   CHECK (status IN ('present','absent','late','half_day','holiday','on_leave')),
  check_in_time  TIME,
  check_out_time TIME,
  notes          TEXT,
  created_by     UUID        REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, date)
);

ALTER TABLE hr_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_hr_attendance" ON hr_attendance;
DROP POLICY IF EXISTS "tenant_hr_attendance"      ON hr_attendance;
CREATE POLICY "super_admin_hr_attendance" ON hr_attendance FOR ALL USING (is_super_admin());
CREATE POLICY "tenant_hr_attendance"      ON hr_attendance FOR ALL USING (tenant_id = current_tenant_id());

-- ────────────────────────────────────────────────────────────
--  10 — HR MOVEMENTS
--  Out-of-office requests: field visits, WFH, tours, etc.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_movements (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id)      ON DELETE CASCADE,
  employee_id      UUID        NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  movement_type    TEXT        NOT NULL,
  from_date        DATE        NOT NULL,
  to_date          DATE        NOT NULL,
  start_time       TIME,
  end_time         TIME,
  location         TEXT,
  reason           TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','rejected','cancelled')),
  approved_by      UUID        REFERENCES auth.users(id),
  approved_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  created_by       UUID        REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE hr_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_hr_movements" ON hr_movements;
DROP POLICY IF EXISTS "tenant_hr_movements"      ON hr_movements;
CREATE POLICY "super_admin_hr_movements" ON hr_movements FOR ALL USING (is_super_admin());
CREATE POLICY "tenant_hr_movements"      ON hr_movements FOR ALL USING (tenant_id = current_tenant_id());

-- ────────────────────────────────────────────────────────────
--  11 — HR LEAVE BALANCES
--  Per-employee leave balance per year.
--  Auto-deducted when leave is approved; refunded on cancel.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_leave_balances (
  id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID         NOT NULL REFERENCES tenants(id)        ON DELETE CASCADE,
  employee_id   UUID         NOT NULL REFERENCES hr_employees(id)   ON DELETE CASCADE,
  leave_type_id UUID         NOT NULL REFERENCES hr_leave_types(id) ON DELETE CASCADE,
  year          INTEGER      NOT NULL,
  total_days    NUMERIC(5,1) NOT NULL DEFAULT 0,
  used_days     NUMERIC(5,1) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (employee_id, leave_type_id, year)
);

ALTER TABLE hr_leave_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_hr_leave_balances" ON hr_leave_balances;
DROP POLICY IF EXISTS "tenant_hr_leave_balances"      ON hr_leave_balances;
CREATE POLICY "super_admin_hr_leave_balances" ON hr_leave_balances FOR ALL USING (is_super_admin());
CREATE POLICY "tenant_hr_leave_balances"      ON hr_leave_balances FOR ALL USING (tenant_id = current_tenant_id());

-- ────────────────────────────────────────────────────────────
--  12 — PERFORMANCE INDEXES
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_hr_departments_tenant
  ON hr_departments(tenant_id);

CREATE INDEX IF NOT EXISTS idx_hr_positions_tenant_dept
  ON hr_positions(tenant_id, department_id);

CREATE INDEX IF NOT EXISTS idx_hr_employees_tenant_status
  ON hr_employees(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_employees_tenant_dept
  ON hr_employees(tenant_id, department_id);
CREATE INDEX IF NOT EXISTS idx_hr_employees_tenant_joined
  ON hr_employees(tenant_id, join_date DESC);
CREATE INDEX IF NOT EXISTS idx_hr_employees_user_id
  ON hr_employees(user_id);

CREATE INDEX IF NOT EXISTS idx_hr_leave_types_tenant
  ON hr_leave_types(tenant_id);

CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_tenant_status
  ON hr_leave_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_employee
  ON hr_leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_dates
  ON hr_leave_requests(tenant_id, start_date DESC);

CREATE INDEX IF NOT EXISTS idx_hr_payroll_runs_tenant_status
  ON hr_payroll_runs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_payroll_runs_period
  ON hr_payroll_runs(tenant_id, period_year DESC, period_month DESC);

CREATE INDEX IF NOT EXISTS idx_hr_payroll_entries_run
  ON hr_payroll_entries(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_hr_payroll_entries_employee
  ON hr_payroll_entries(employee_id);

CREATE INDEX IF NOT EXISTS idx_hr_attendance_tenant_date
  ON hr_attendance(tenant_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_employee_date
  ON hr_attendance(employee_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_tenant_status
  ON hr_attendance(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_hr_movements_tenant_status
  ON hr_movements(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_movements_employee
  ON hr_movements(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_movements_dates
  ON hr_movements(tenant_id, from_date DESC);

CREATE INDEX IF NOT EXISTS idx_hr_leave_balances_emp_year
  ON hr_leave_balances(employee_id, year);
CREATE INDEX IF NOT EXISTS idx_hr_leave_balances_tenant
  ON hr_leave_balances(tenant_id);

-- ────────────────────────────────────────────────────────────
--  DONE
-- ============================================================
