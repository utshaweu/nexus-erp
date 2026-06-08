import { Link } from 'react-router-dom'
import { Home, Store } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="font-display font-bold text-8xl text-surface-800 mb-4">404</div>
      <h1 className="font-display font-bold text-xl text-slate-200 mb-2">Page Not Found</h1>
      <p className="text-slate-500 text-sm mb-8 max-w-xs">
        This page doesn't exist or the module that provides it isn't installed.
      </p>
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-800 hover:bg-surface-700 text-slate-300 text-sm font-medium border border-surface-700 transition-colors"
        >
          <Home className="w-4 h-4" />
          Dashboard
        </Link>
        <Link
          to="/apps"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-colors"
        >
          <Store className="w-4 h-4" />
          App Store
        </Link>
      </div>
    </div>
  )
}
