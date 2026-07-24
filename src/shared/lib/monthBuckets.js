/**
 * Trailing N month buckets ending at the current month, oldest first.
 * Each bucket carries both `m`/`year` (numeric match) and `key` (`YYYY-MM`
 * string match) so callers can index however they prefer, plus whatever
 * numeric fields they want pre-zeroed via `extraFields`.
 */
export function buildMonthBuckets(n = 6, extraFields = {}) {
  const now = new Date()
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1)
    return {
      month: d.toLocaleString('default', { month: 'short' }),
      year:  d.getFullYear(),
      m:     d.getMonth() + 1,
      key:   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      ...extraFields,
    }
  })
}
