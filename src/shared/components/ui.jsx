import { clsx } from 'clsx'
import { forwardRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, X } from 'lucide-react'

// ─── Button ────────────────────────────────────────────────────────────────
const buttonVariants = {
  primary:   'bg-brand-600 hover:bg-brand-500 text-white shadow-sm',
  secondary: 'bg-surface-100 hover:bg-surface-200 text-slate-700 border border-surface-200 dark:bg-surface-800 dark:hover:bg-surface-700 dark:text-slate-200 dark:border-surface-700',
  ghost:     'hover:bg-surface-100 text-slate-600 hover:text-slate-900 dark:hover:bg-surface-800 dark:text-slate-400 dark:hover:text-slate-200',
  danger:    'bg-red-600 hover:bg-red-500 text-white',
  success:   'bg-emerald-600 hover:bg-emerald-500 text-white',
  outline:   'border border-surface-200 hover:border-brand-500 text-slate-600 hover:text-slate-900 dark:border-surface-700 dark:text-slate-300 dark:hover:text-white',
}

const buttonSizes = {
  xs: 'px-2.5 py-1 text-xs',
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
}

export const Button = forwardRef(({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  children,
  ...props
}, ref) => (
  <button
    ref={ref}
    disabled={disabled || loading}
    className={clsx(
      'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150',
      'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2',
      'focus:ring-offset-white dark:focus:ring-offset-surface-900',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      buttonVariants[variant],
      buttonSizes[size],
      className
    )}
    {...props}
  >
    {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
    {children}
  </button>
))
Button.displayName = 'Button'

// ─── Badge ─────────────────────────────────────────────────────────────────
const badgeColors = {
  default: 'bg-surface-200 text-slate-600 dark:bg-surface-700 dark:text-slate-300',
  blue:    'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20',
  green:   'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20',
  yellow:  'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/20',
  red:     'bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/20',
  purple:  'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-500/15 dark:text-purple-400 dark:border-purple-500/20',
  cyan:    'bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-400 dark:border-cyan-500/20',
  orange:  'bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/20',
}

export function Badge({ color = 'default', className = '', children }) {
  return (
    <span className={clsx(
      'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
      badgeColors[color],
      className
    )}>
      {children}
    </span>
  )
}

// ─── Card ──────────────────────────────────────────────────────────────────
export function Card({ className = '', children, ...props }) {
  return (
    <div
      className={clsx(
        'rounded-xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900/50 backdrop-blur-sm',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className = '', children }) {
  return <div className={clsx('px-6 pt-5 pb-4', className)}>{children}</div>
}

export function CardTitle({ className = '', children }) {
  return <h3 className={clsx('font-display text-base font-semibold text-slate-900 dark:text-slate-100', className)}>{children}</h3>
}

export function CardContent({ className = '', children }) {
  return <div className={clsx('px-6 pb-5', className)}>{children}</div>
}

// ─── Stat Card ─────────────────────────────────────────────────────────────
export function StatCard({ label, value, change, icon: Icon, color = '#6366f1', loading = false }) {
  const isPositive = change >= 0
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">{label}</p>
          {loading
            ? <div className="mt-2 h-8 w-24 bg-surface-200 dark:bg-surface-800 rounded animate-pulse" />
            : <p className="mt-1.5 text-2xl font-display font-bold text-slate-900 dark:text-slate-100">{value}</p>
          }
          {change !== undefined && (
            <p className={clsx('mt-1 text-xs font-medium', isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
              {isPositive ? '↑' : '↓'} {Math.abs(change)}% vs last month
            </p>
          )}
        </div>
        <div
          className="p-2.5 rounded-lg"
          style={{ backgroundColor: `${color}20`, border: `1px solid ${color}30` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
    </Card>
  )
}

// ─── Input ─────────────────────────────────────────────────────────────────
export const Input = forwardRef(({ label, error, className = '', ...props }, ref) => (
  <div className="flex flex-col gap-1.5">
    {label && (
      <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        {label}
      </label>
    )}
    <input
      ref={ref}
      className={clsx(
        'w-full px-3 py-2 rounded-lg text-sm',
        'text-slate-900 dark:text-slate-200',
        'placeholder:text-slate-400 dark:placeholder:text-slate-600',
        'bg-white dark:bg-surface-900',
        'border border-surface-200 dark:border-surface-700',
        'hover:border-surface-300 dark:hover:border-surface-600',
        'focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500',
        'transition-colors',
        error && 'border-red-500 focus:ring-red-500',
        className
      )}
      {...props}
    />
    {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
  </div>
))
Input.displayName = 'Input'

// ─── Select ────────────────────────────────────────────────────────────────
export const Select = forwardRef(({ label, error, className = '', children, ...props }, ref) => (
  <div className="flex flex-col gap-1.5">
    {label && (
      <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        {label}
      </label>
    )}
    <select
      ref={ref}
      className={clsx(
        'w-full px-3 py-2 rounded-lg text-sm',
        'text-slate-900 dark:text-slate-200',
        'bg-white dark:bg-surface-900',
        'border border-surface-200 dark:border-surface-700',
        'focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500',
        'transition-colors',
        className
      )}
      {...props}
    >
      {children}
    </select>
    {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
  </div>
))
Select.displayName = 'Select'

// ─── Table ─────────────────────────────────────────────────────────────────
export function Table({ children, className = '' }) {
  return (
    <div className={clsx('w-full overflow-auto', className)}>
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}

export function Thead({ children }) {
  return (
    <thead>
      <tr className="border-b border-surface-200 dark:border-surface-800">
        {children}
      </tr>
    </thead>
  )
}

export function Th({ children, className = '' }) {
  return (
    <th className={clsx(
      'px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-widest',
      className
    )}>
      {children}
    </th>
  )
}

export function Tbody({ children }) {
  return <tbody className="divide-y divide-surface-200 dark:divide-surface-800/70">{children}</tbody>
}

export function Tr({ children, className = '', onClick }) {
  return (
    <tr
      onClick={onClick}
      className={clsx(
        'transition-colors',
        onClick && 'cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800/40',
        className
      )}
    >
      {children}
    </tr>
  )
}

export function Td({ children, className = '' }) {
  return (
    <td className={clsx('px-4 py-3.5 text-slate-700 dark:text-slate-300', className)}>
      {children}
    </td>
  )
}

// ─── Empty State ───────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="p-4 rounded-2xl bg-surface-100 dark:bg-surface-800 mb-4">
        <Icon className="w-8 h-8 text-slate-400 dark:text-slate-500" />
      </div>
      <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 max-w-xs mb-4">{description}</p>
      {action}
    </div>
  )
}

// ─── Loading Spinner ───────────────────────────────────────────────────────
export function Spinner({ className = '' }) {
  return <Loader2 className={clsx('animate-spin text-brand-500 dark:text-brand-400', className)} />
}

// ─── Page Header ───────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, actions, breadcrumb }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        {breadcrumb && (
          <p className="text-xs text-slate-500 mb-1">{breadcrumb}</p>
        )}
        <h1 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

// ─── Modal ─────────────────────────────────────────────────────────────────
const MODAL_SIZES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export function Modal({ open, onClose, title, children, size = 'md' }) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      // One frame delay so CSS transition picks up the initial state
      const t = setTimeout(() => setVisible(true), 10)
      return () => clearTimeout(t)
    } else {
      setVisible(false)
      // Keep mounted until exit animation finishes
      const t = setTimeout(() => setMounted(false), 200)
      return () => clearTimeout(t)
    }
  }, [open])

  if (!mounted) return null

  return createPortal(
    <div
      className={clsx(
        'fixed inset-0 z-[9999] flex items-center justify-center p-4',
        'bg-black/50',
        'transition-opacity duration-200',
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none',
      )}
      onClick={onClose}
    >
      {/* Panel */}
      <div
        onClick={e => e.stopPropagation()}
        className={clsx(
          'relative w-full rounded-2xl shadow-xl',
          'bg-white dark:bg-surface-900',
          'border border-surface-200 dark:border-surface-800',
          'transition-all duration-200',
          MODAL_SIZES[size],
          visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2',
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200 dark:border-surface-800">
          <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors
                       hover:bg-surface-100 dark:hover:bg-surface-800
                       text-slate-400 dark:text-slate-500
                       hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
