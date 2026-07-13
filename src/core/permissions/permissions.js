/**
 * permissions.js
 * ──────────────
 * Pure-function permission engine. No React, no global reads.
 * All functions receive data as arguments — fully testable.
 *
 * Resolution order for can(user, action, moduleId, featureId):
 *   1. Super admin  → always true
 *   2. Explicit feature override in user.permissions[moduleId].features[featureId][action]
 *      (true / false)  → use it directly (only checked when featureId is given)
 *   3. Explicit module override in user.permissions[moduleId][action]
 *      (true / false)  → use it directly
 *   4. Role default  → derive from ROLE_DEFAULTS[role][action]
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
  // user/viewer: VIEW is false so they only see modules explicitly granted by an admin.
  // Once granted VIEW, their create/edit/export defaults still apply.
  [ROLES.USER]: {
    [ACTIONS.VIEW]: false, [ACTIONS.CREATE]: true, [ACTIONS.EDIT]: true,
    [ACTIONS.DELETE]: false, [ACTIONS.APPROVE]: false, [ACTIONS.EXPORT]: false,
  },
  [ROLES.VIEWER]: {
    [ACTIONS.VIEW]: false, [ACTIONS.CREATE]: false, [ACTIONS.EDIT]: false,
    [ACTIONS.DELETE]: false, [ACTIONS.APPROVE]: false, [ACTIONS.EXPORT]: false,
  },
})

// ── Core resolver ─────────────────────────────────────────────

/**
 * can()
 * Resolves whether a user may perform an action, optionally
 * within a specific module and, more narrowly, a single feature
 * (menu item) inside that module.
 *
 * @param {object} user
 *   { role: string, isSuperAdmin?: boolean,
 *     permissions?: Record<moduleId, { [action]: boolean|null,
 *       features?: Record<featureId, Record<action, boolean|null>> }> }
 * @param {string} action  — one of ACTIONS.*
 * @param {string|null} moduleId — optional module scope
 * @param {string|null} featureId — optional feature scope within moduleId
 * @returns {boolean}
 */
export function can(user, action, moduleId = null, featureId = null) {
  if (!user) return false

  // 1. Super admin bypass
  if (user.isSuperAdmin) return true

  if (moduleId) {
    // 2. Explicit feature-level override wins over the module-level one
    if (featureId) {
      const featureOverride = user.permissions?.[moduleId]?.features?.[featureId]?.[action]
      if (featureOverride === true)  return true
      if (featureOverride === false) return false
      // null/undefined → fall through to module-level override
    }

    // 3. Explicit per-module override
    const override = user.permissions?.[moduleId]?.[action]
    if (override === true)  return true
    if (override === false) return false
    // override is null/undefined → fall through to role default
  }

  // 4. Role default
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
 * featuresForModule()
 * A module's "features" are the menu items that opt into individual
 * gating via requiredPermission.featureId (set in module_catalog.menu_items).
 * Used by the permission-editor UIs to render one sub-row per feature.
 */
export function featuresForModule(mod) {
  return (mod.menuItems ?? [])
    .filter(item => item.requiredPermission?.featureId)
    .map(item => ({ id: item.requiredPermission.featureId, label: item.label }))
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
 *   { [moduleId]: { view: bool|null, create: bool|null, …,
 *       features: { [featureId]: { view: bool|null, … } } } }
 * Rows with feature_id === null are module-level; rows with a
 * feature_id land under that module's `features` map.
 */
export function buildPermissionMap(dbRows) {
  const map = {}
  for (const row of dbRows) {
    const actions = {
      [ACTIONS.VIEW]:    row.can_view,
      [ACTIONS.CREATE]:  row.can_create,
      [ACTIONS.EDIT]:    row.can_edit,
      [ACTIONS.DELETE]:  row.can_delete,
      [ACTIONS.APPROVE]: row.can_approve,
      [ACTIONS.EXPORT]:  row.can_export,
    }
    if (row.feature_id) {
      map[row.module_id] ??= {}
      map[row.module_id].features ??= {}
      map[row.module_id].features[row.feature_id] = actions
    } else {
      map[row.module_id] = { ...map[row.module_id], ...actions }
    }
  }
  return map
}
