-- ============================================================
--  NexusERP — Approval Requests: Feature Addendum
--  Run AFTER nexuserp_approval_addendum.sql
--  Safe to re-run (idempotent via IF NOT EXISTS).
--
--  Adds a `feature` column to approval_requests, mirroring the
--  one already on approval_workflows — lets a request point at
--  the specific page it relates to (e.g. "/sales/orders") rather
--  than just the module. Optional; nullable so it never blocks a
--  submission.
-- ============================================================

ALTER TABLE approval_requests
  ADD COLUMN IF NOT EXISTS feature TEXT;
