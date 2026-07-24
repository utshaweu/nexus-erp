import { useState } from 'react'
import { Copy, CheckCircle2 } from 'lucide-react'

export default function CopyButton({ code }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 font-mono text-xs px-2 py-0.5 rounded bg-surface-100 hover:bg-surface-200 text-slate-700 dark:bg-surface-700 dark:hover:bg-surface-600 dark:text-slate-300 transition-colors"
      title="Copy coupon code"
    >
      {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3 h-3" />}
      {code}
    </button>
  )
}
