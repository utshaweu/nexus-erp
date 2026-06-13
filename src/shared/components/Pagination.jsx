import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@shared/components/ui'

/**
 * Pagination
 * ──────────
 * Generic page-navigation bar. Renders nothing when there is only one page.
 *
 * Props
 *   page         – current 1-based page number
 *   totalPages   – total number of pages  (Math.ceil(total / pageSize))
 *   onPageChange – called with the new page number when the user navigates
 *   total        – total item count (used for the "x–y of z" label)
 *   pageSize     – items per page   (used for the "x–y of z" label)
 *   label        – optional noun appended to the count, e.g. "vendors"
 *   className    – extra classes applied to the wrapper div
 *
 * Usage (inside a Card — adds a top border):
 *   <Pagination
 *     page={page} totalPages={totalPages} onPageChange={setPage}
 *     total={total} pageSize={PAGE_SIZE}
 *     className="border-t border-surface-200 dark:border-surface-800"
 *   />
 *
 * Usage (outside a Card — no border):
 *   <Pagination
 *     page={page} totalPages={totalPages} onPageChange={setPage}
 *     total={total} pageSize={PAGE_SIZE}
 *   />
 */
export default function Pagination({
  page,
  totalPages,
  onPageChange,
  total,
  pageSize,
  label     = '',
  className = '',
}) {
  if (totalPages <= 1) return null

  const from = (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, total)
  const suffix = label ? ` ${label}` : ''

  // Show up to 5 page numbers centred around the current page
  const pageNums = Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
    const start = Math.max(1, Math.min(page - 2, totalPages - 4))
    return start + i
  }).filter(p => p <= totalPages)

  return (
    <div className={`flex items-center justify-between px-4 py-3 ${className}`}>
      <span className="text-xs text-slate-500">
        {from}–{to} of {total}{suffix}
      </span>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="xs"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>

        {pageNums.map(p => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`w-7 h-7 rounded-md text-xs font-medium transition-all ${
              p === page
                ? 'bg-brand-600/20 text-brand-300 border border-brand-600/30'
                : 'text-slate-500 hover:text-slate-200'
            }`}
          >
            {p}
          </button>
        ))}

        <Button
          variant="ghost"
          size="xs"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}
