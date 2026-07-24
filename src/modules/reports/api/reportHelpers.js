import { z } from 'zod'

export const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const startOfMonth = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
export const todayStr = () => new Date().toISOString().slice(0, 10)

export function pctChange(curr, prev) {
  if (prev === 0) return curr > 0 ? 100 : 0
  return Math.round(((curr - prev) / prev) * 100)
}

export function exportCSV(rows, columns, filename) {
  const header = columns.map(c => c.label).join(',')
  const body   = rows.map(row =>
    columns.map(c => {
      const val = typeof c.key === 'function' ? c.key(row) : (row[c.key] ?? '')
      return `"${String(val).replace(/"/g, '""')}"`
    }).join(',')
  )
  const blob = new Blob([[header, ...body].join('\n')], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  Object.assign(document.createElement('a'), { href: url, download: filename }).click()
  URL.revokeObjectURL(url)
}

export const dateRangeSchema = z.object({
  date_from: z.string().min(1, 'From date is required'),
  date_to:   z.string().min(1, 'To date is required'),
}).refine(d => new Date(d.date_to) >= new Date(d.date_from), {
  message: 'To date must be on or after From date',
  path: ['date_to'],
})

export const saveFilterSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60, 'Max 60 characters'),
})
