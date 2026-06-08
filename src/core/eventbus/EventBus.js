/**
 * EventBus — Pub/Sub for cross-module communication.
 * Modules never import each other. They communicate only via events.
 *
 * Usage:
 *   EventBus.on('purchase.order.confirmed', handler)
 *   EventBus.emit('purchase.order.confirmed', { orderId: 'PO-001' })
 *   EventBus.off('purchase.order.confirmed', handler)
 */
class EventBus {
  constructor() {
    this._handlers = new Map()
    this._history = []           // Last 100 events for debugging
    this._maxHistory = 100
  }

  /** Subscribe to an event */
  on(event, handler) {
    if (!this._handlers.has(event)) {
      this._handlers.set(event, new Set())
    }
    this._handlers.get(event).add(handler)

    // Return unsubscribe function
    return () => this.off(event, handler)
  }

  /** Unsubscribe from an event */
  off(event, handler) {
    this._handlers.get(event)?.delete(handler)
  }

  /** Emit an event with optional payload */
  emit(event, payload = {}) {
    const entry = { event, payload, timestamp: new Date().toISOString() }
    this._history.push(entry)
    if (this._history.length > this._maxHistory) this._history.shift()

    if (import.meta.env.DEV) {
      console.debug(`[EventBus] ${event}`, payload)
    }

    this._handlers.get(event)?.forEach(handler => {
      try {
        handler(payload)
      } catch (err) {
        console.error(`[EventBus] Error in handler for "${event}":`, err)
      }
    })
  }

  /** Subscribe to an event only once */
  once(event, handler) {
    const wrapper = (payload) => {
      handler(payload)
      this.off(event, wrapper)
    }
    return this.on(event, wrapper)
  }

  /** Get event history (for debugging) */
  getHistory() {
    return [...this._history]
  }

  /** Clear all handlers (useful in tests) */
  clear() {
    this._handlers.clear()
    this._history = []
  }
}

// Singleton
const eventBus = new EventBus()
export default eventBus

// Standardized ERP event names (documentation)
export const ERP_EVENTS = {
  // Module lifecycle
  MODULE_INSTALLED: 'module:installed',
  MODULE_UNINSTALLED: 'module:uninstalled',

  // Purchase
  PURCHASE_ORDER_CREATED: 'purchase.order.created',
  PURCHASE_ORDER_CONFIRMED: 'purchase.order.confirmed',
  PURCHASE_ORDER_RECEIVED: 'purchase.order.received',

  // Sales
  SALES_ORDER_CREATED: 'sales.order.created',
  SALES_ORDER_CONFIRMED: 'sales.order.confirmed',
  SALES_INVOICE_CREATED: 'sales.invoice.created',

  // Inventory
  INVENTORY_STOCK_LOW: 'inventory.stock.low',
  INVENTORY_STOCK_UPDATED: 'inventory.stock.updated',
  INVENTORY_DELIVERY_CREATED: 'inventory.delivery.created',

  // Accounts
  ACCOUNTS_INVOICE_PAID: 'accounts.invoice.paid',
  ACCOUNTS_BILL_CREATED: 'accounts.bill.created',

  // HR
  HR_EMPLOYEE_CREATED: 'hr.employee.created',
  HR_LEAVE_APPROVED: 'hr.leave.approved',

  // Approval
  APPROVAL_REQUESTED: 'approval.requested',
  APPROVAL_APPROVED: 'approval.approved',
  APPROVAL_REJECTED: 'approval.rejected',

  // Asset
  ASSET_CREATED: 'asset.created',
  ASSET_DEPRECIATED: 'asset.depreciated',
}
