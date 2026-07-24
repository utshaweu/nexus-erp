import { clsx } from 'clsx'

// A null value shows a FADED ✓/✗ for what it will actually resolve to
// (inherited from the module override or role default), not a neutral
// grey dash — so e.g. denying a module's View visually cascades to its
// feature rows as a faded ✗ instead of looking unchanged.
export default function PermissionCell({ value, roleDefault, onChange, disabled }) {
  const effectiveValue = value ?? roleDefault

  const cycleState = () => {
    if (disabled) return
    if (value === null || value === undefined) onChange(true)
    else if (value === true)  onChange(false)
    else                      onChange(null)
  }

  return (
    <button
      onClick={cycleState}
      disabled={disabled}
      title={
        value === true  ? 'Explicitly ALLOWED (click to deny)'  :
        value === false ? 'Explicitly DENIED (click to reset)'  :
                          `Inherited — resolves to ${effectiveValue ? 'ALLOWED' : 'DENIED'} (click to override)`
      }
      className={clsx(
        'w-8 h-8 rounded-lg flex items-center justify-center transition-all text-xs font-bold',
        disabled && 'opacity-40 cursor-not-allowed',
        !disabled && 'hover:scale-110 cursor-pointer',
        value === true  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400' :
        value === false ? 'bg-red-500/20 border border-red-500/40 text-red-600 dark:text-red-400'               :
        effectiveValue  ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400' :
                          'bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-400'
      )}
    >
      {effectiveValue ? '✓' : '✗'}
    </button>
  )
}
