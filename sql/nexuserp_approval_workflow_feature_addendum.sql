-- ============================================================
--  NexusERP — Approval Workflow: Feature Addendum
--  Run AFTER nexuserp_approval_addendum.sql
--  Safe to re-run (idempotent via IF NOT EXISTS).
--
--  Adds a `feature` column to approval_workflows so a workflow
--  targets a specific page within a module (e.g. Sales > Sales
--  Orders) rather than the whole module. Stores the menu item's
--  route path (e.g. "/sales/orders"). Required for new/edited
--  workflows going forward; nullable here only so pre-existing
--  rows aren't broken by the migration.
-- ============================================================

ALTER TABLE approval_workflows
  ADD COLUMN IF NOT EXISTS feature TEXT;
