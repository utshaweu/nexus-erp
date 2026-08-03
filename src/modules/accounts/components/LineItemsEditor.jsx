import { PlusCircle, Minus } from 'lucide-react'
import { Button } from '@shared/components/ui'

/**
 * Product-driven line items table shared by Invoice and Bill forms —
 * identical shape (product / qty / unit price / tax % / total), just backed
 * by a different product price field (sale_price for invoices, cost_price
 * for bills), passed in via `priceField`.
 */
export default function LineItemsEditor({ fields, register, watch, remove, append, setValue, products, priceField, defaultLine }) {
  const watchedLines = watch('lines') || []

  const handleProductChange = (i, productName) => {
    setValue(`lines.${i}.description`, productName, { shouldValidate: true })
    const product = products.find(p => p.name === productName)
    if (product) {
      setValue(`lines.${i}.unit_price`, Number(product[priceField] || 0), { shouldValidate: true })
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Line Items
        </p>
        <Button type="button" variant="ghost" size="xs" onClick={() => append({ ...defaultLine })} className="gap-1">
          <PlusCircle className="w-3.5 h-3.5" />Add Line
        </Button>
      </div>

      <div className="rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <div className="min-w-[560px]">
            <div className="grid grid-cols-[minmax(160px,1fr)_72px_96px_64px_88px_32px] gap-2 px-3 py-2
                            bg-slate-50 dark:bg-surface-800
                            border-b border-surface-200 dark:border-surface-700">
              {['Product', 'Qty', 'Unit Price', 'Tax %', 'Total', ''].map(h => (
                <span key={h} className="text-xs font-medium text-slate-500 dark:text-slate-400">{h}</span>
              ))}
            </div>

            {fields.map((field, i) => {
              const qty   = Number(watchedLines[i]?.quantity   || 0)
              const price = Number(watchedLines[i]?.unit_price || 0)
              const tax   = Number(watchedLines[i]?.tax_rate   || 0)
              const total = qty * price * (1 + tax / 100)

              return (
                <div
                  key={field.id}
                  className="grid grid-cols-[minmax(160px,1fr)_72px_96px_64px_88px_32px] gap-2 px-3 py-2
                             border-b border-surface-100 dark:border-surface-800 last:border-0 items-center"
                >
                  <select
                    value={watchedLines[i]?.description || ''}
                    onChange={e => handleProductChange(i, e.target.value)}
                    className="text-sm bg-transparent border-b border-surface-200 dark:border-surface-700
                               outline-none text-slate-800 dark:text-slate-200 py-0.5 min-w-0 cursor-pointer
                               dark:bg-surface-900"
                  >
                    <option value="">Select product…</option>
                    {products.map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>

                  <input
                    type="number" min="0" step="0.01" placeholder="1"
                    className="text-sm bg-transparent border-b border-surface-200 dark:border-surface-700
                               outline-none text-right text-slate-800 dark:text-slate-200 py-0.5 w-full"
                    {...register(`lines.${i}.quantity`)}
                  />
                  <input
                    type="number" min="0" step="0.01" placeholder="0.00"
                    className="text-sm bg-transparent border-b border-surface-200 dark:border-surface-700
                               outline-none text-right text-slate-800 dark:text-slate-200 py-0.5 w-full"
                    {...register(`lines.${i}.unit_price`)}
                  />
                  <input
                    type="number" min="0" max="100" step="0.01" placeholder="0"
                    className="text-sm bg-transparent border-b border-surface-200 dark:border-surface-700
                               outline-none text-right text-slate-800 dark:text-slate-200 py-0.5 w-full"
                    {...register(`lines.${i}.tax_rate`)}
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 text-right tabular-nums">
                    ${total.toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={() => fields.length > 1 && remove(i)}
                    disabled={fields.length <= 1}
                    className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-500/10
                               text-slate-400 hover:text-red-500 transition-colors
                               disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
