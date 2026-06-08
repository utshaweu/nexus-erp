/**
 * permissions.js
 * ──────────────
 * Pure-function permission engine. No React, no global reads.
 * All functions receive data as arguments — fully testable.
 *
 * Resolution order for can(user, action, moduleId):
 *   1. Super admin  → always true
 *   2. Explicit override in user.permissions[moduleId][action]
 *      (true / false)  → use it directly
 *   3. Role default  → derive from ROLE_DEFAULTS[role][action]
 */

// ── Constants ─────────────────────────────────────────────────

export const ROLES = Object.freeze({
  OWNER:       'owner',
  ADMIN:       'admin',
  MANAGER:     'manager',
  USER:        'user',
  VIEWER:      'viewer',
})

export const ACTIONS = Object.freeze({
  VIEW:    'view',
  CREATE:  'create',
  EDIT:    'edit',
  DELETE:  'delete',
  APPROVE: 'approve',
  EXPORT:  'export',
})

/** Ordered from least to most privileged */
const ROLE_HIERARCHY = [
  ROLES.VIEWER,
  ROLES.USER,
  ROLES.MANAGER,
  ROLES.ADMIN,
  ROLES.OWNER,
]

/**
 * Default action matrix per role.
 * true  = allowed by default
 * false = denied by default
 * These are the fallback when no explicit override exists.
 */
export const ROLE_DEFAULTS = Object.freeze({
  [ROLES.OWNER]: {
    [ACTIONS.VIEW]: true, [ACTIONS.CREATE]: true, [ACTIONS.EDIT]: true,
    [ACTIONS.DELETE]: true, [ACTIONS.APPROVE]: true, [ACTIONS.EXPORT]: true,
  },
  [ROLES.ADMIN]: {
    [ACTIONS.VIEW]: true, [ACTIONS.CREATE]: true, [ACTIONS.EDIT]: true,
    [ACTIONS.DELETE]: true, [ACTIONS.APPROVE]: true, [ACTIONS.EXPORT]: true,
  },
  [ROLES.MANAGER]: {
    [ACTIONS.VIEW]: true, [ACTIONS.CREATE]: true, [ACTIONS.EDIT]: true,
    [ACTIONS.DELETE]: false, [ACTIONS.APPROVE]: true, [ACTIONS.EXPORT]: true,
  },
  [ROLES.USER]: {
    [ACTIONS.VIEW]: true, [ACTIONS.CREATE]: true, [ACTIONS.EDIT]: true,
    [ACTIONS.DELETE]: false, [ACTIONS.APPROVE]: false, [ACTIONS.EXPORT]: false,
  },
  [ROLES.VIEWER]: {
    [ACTIONS.VIEW]: true, [ACTIONS.CREATE]: false, [ACTIONS.EDIT]: false,
    [ACTIONS.DELETE]: false, [ACTIONS.APPROVE]: false, [ACTIONS.EXPORT]: false,
  },
})

// ── Core resolver ─────────────────────────────────────────────

/**
 * can()
 * Resolves whether a user may perform an action, optionally
 * within a specific module.
 *
 * @param {object} user
 *   { role: string, isSuperAdmin?: boolean,
 *     permissions?: Record<moduleId, Record<action, boolean|null>> }
 * @param {string} action  — one of ACTIONS.*
 * @param {string|null} moduleId — optional module scope
 * @returns {boolean}
 */
export function can(user, action, moduleId = null) {
  if (!user) return false

  // 1. Super admin bypass
  if (user.isSuperAdmin) return true

  // 2. Explicit per-module override (only if a module scope was given)
  if (moduleId) {
    const override = user.permissions?.[moduleId]?.[action]
    // override is true/false (not null/undefined) → use it
    if (override === true)  return true
    if (override === false) return false
    // override is null/undefined → fall through to role default
  }

  // 3. Role default
  return ROLE_DEFAULTS[user.role]?.[action] ?? false
}

/**
 * canAccessModule()
 * A user can access a module if they can VIEW it.
 * Used to filter sidebar menu and injected routes.
 */
export function canAccessModule(user, moduleId) {
  return can(user, ACTIONS.VIEW, moduleId)
}

/**
 * resolveAllPermissions()
 * Returns the fully-resolved action map for a user+module combo.
 * Useful for building the permission editor UI.
 *
 * @returns Record<action, boolean>
 */
export function resolveAllPermissions(user, moduleId) {
  return Object.fromEntries(
    Object.values(ACTIONS).map(action => [action, can(user, action, moduleId)])
  )
}

/**
 * roleAtLeast()
 * True if userRole is at least as privileged as requiredRole.
 */
export function roleAtLeast(userRole, requiredRole) {
  return ROLE_HIERARCHY.indexOf(userRole) >= ROLE_HIERARCHY.indexOf(requiredRole)
}

/**
 * buildPermissionMap()
 * Converts raw DB rows (from tenant_user_permissions) into the
 * nested map that the permission engine expects:
 *   { [moduleId]: { view: bool|null, create: bool|null, … } }
 */
export function buildPermissionMap(dbRows) {
  const map = {}
  for (const row of dbRows) {
    map[row.module_id] = {
      [ACTIONS.VIEW]:    row.can_view,
      [ACTIONS.CREATE]:  row.can_create,
      [ACTIONS.EDIT]:    row.can_edit,
      [ACTIONS.DELETE]:  row.can_delete,
      [ACTIONS.APPROVE]: row.can_approve,
      [ACTIONS.EXPORT]:  row.can_export,
    }
  }
  return map
}
