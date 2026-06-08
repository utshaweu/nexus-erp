import { usePermissions } from '@core/permissions/PermissionContext'

/**
 * PermissionGate
 * ──────────────
 * Conditionally renders children based on the current user's permissions.
 * Reads from PermissionContext — reactive, re-renders when permissions update.
 *
 * Usage:
 *   // Hide a button if user can't create in purchase module
 *   <PermissionGate action="create" moduleId="purchase">
 *     <Button>New Order</Button>
 *   </PermissionGate>
 *
 *   // Show a fallback instead
 *   <PermissionGate
 *     action="delete"
 *     moduleId="sales"
 *     fallback={<span className="text-slate-600">No permission</span>}
 *   >
 *     <Button variant="danger">Delete</Button>
 *   </PermissionGate>
 *
 * Props:
 *   action   — one of 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export'
 *   moduleId — optional: scope check to a specific module
 *   fallback — what to render when access is denied (default: null)
 *   children — what to render when access is granted
 */
export default function PermissionGate({ action, moduleId = null, fallback = null, children }) {
  const { can } = usePermissions()
  return can(action, moduleId) ? children : fallback
}
