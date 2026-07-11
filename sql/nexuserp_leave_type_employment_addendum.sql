-- ============================================================
--  NexusERP — Leave Type: Employment Type Addendum
--  Run AFTER nexuserp_hr_addendum.sql
--  Safe to re-run (idempotent via IF NOT EXISTS).
--
--  Adds a required employment_type column to hr_leave_types so
--  each leave type can be scoped to a specific employment type
--  (full_time / part_time / contract / intern).
-- ============================================================

ALTER TABLE hr_leave_types
  ADD COLUMN IF NOT EXISTS employment_type TEXT NOT NULL DEFAULT 'full_time'
    CHECK (employment_type IN ('full_time','part_time','contract','intern'));
