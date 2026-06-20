import {
  LayoutDashboard, FileText, ClipboardList, Building2, Users, Package,
  ArrowLeftRight, DollarSign, BookOpen, List, UserCog, Settings, BarChart2,
  Calendar, Cpu, TrendingDown, TrendingUp, Tag, Wrench, CheckSquare, Clock, Send,
  GitBranch, History, Receipt, Building, Activity, CalendarDays, Puzzle,
  Warehouse, Store, ShoppingCart,
} from 'lucide-react'

/**
 * moduleIcons
 * ───────────
 * Maps icon *name strings* (as stored in the `module_catalog` DB table) to
 * their Lucide React components.
 *
 * Module manifests in code use real components (`icon: TrendingUp`), but the
 * database can only hold a string. When the registry merges DB metadata over a
 * code manifest it calls `resolveModuleIcon(row.icon)` so the rest of the app
 * (Sidebar, App Store) can keep doing `const Icon = manifest.icon` unchanged.
 *
 * Adding a new module-level icon = add one entry here.
 */
export const MODULE_ICON_MAP = {
  LayoutDashboard, FileText, ClipboardList, Building2, Users, Package,
  ArrowLeftRight, DollarSign, BookOpen, List, UserCog, Settings, BarChart2,
  Calendar, Cpu, TrendingDown, TrendingUp, Tag, Wrench, CheckSquare, Clock, Send,
  GitBranch, History, Receipt, Building, Activity, CalendarDays, Puzzle,
  Warehouse, Store, ShoppingCart,
}

/**
 * Resolve an icon name string to a Lucide component.
 * Falls back to `Puzzle` for unknown / empty names so the UI never crashes.
 */
export function resolveModuleIcon(name) {
  if (!name) return null
  return MODULE_ICON_MAP[name] ?? Puzzle
}
