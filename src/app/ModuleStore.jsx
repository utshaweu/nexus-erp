import { useState } from 'react'
import { Search, ChevronRight, X, Lock, LayoutGrid, Network, Workflow } from 'lucide-react'
import { clsx } from 'clsx'
import { useModule } from '@shared/hooks/useModule'
import { useTenant } from '@core/tenant/TenantContext'
import ModuleCard from './components/ModuleCard'
import FeatureOrganogram from './components/FeatureOrganogram'
import ApprovalWorkflowMap from './components/ApprovalWorkflowMap'

export default function ModuleStore() {
  const { allModules, installedModules, canManage } = useModule()
  const { tenantName }  = useTenant()
  const [search, setSearch]     = useState('')
  const [category, setCategory] = useState('All')
  const [view, setView]         = useState('grid') // 'grid' | 'map' | 'workflow'

  const categories = ['All', ...new Set(allModules.map(m => m.category))]

  const matches = (m) => {
    const matchSearch = (
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.description.toLowerCase().includes(search.toLowerCase())
    )
    const matchCat = category === 'All' || m.category === category
    return matchSearch && matchCat
  }

  const filtered         = allModules.filter(matches)
  const filteredInstalled = installedModules.filter(matches)

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-slate-100">App Store</h1>
        <p className="text-sm text-slate-500 mt-1">
          {tenantName
            ? `Modules for ${tenantName} — ${installedModules.length} of ${allModules.length} installed`
            : `${installedModules.length} of ${allModules.length} modules installed`}
        </p>
        {!canManage && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
            <Lock className="w-3 h-3" />
            You need admin permission to install or uninstall modules
          </p>
        )}

        {/* Progress bar */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-surface-200 dark:bg-surface-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400 transition-all duration-500"
              style={{ width: `${(installedModules.length / allModules.length) * 100}%` }}
            />
          </div>
          <span className="text-xs text-slate-500 font-mono whitespace-nowrap">
            {installedModules.length}/{allModules.length}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-2 max-w-xs px-3 py-1.5 rounded-lg
                        bg-surface-100 dark:bg-surface-800
                        border border-surface-200 dark:border-surface-700">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search modules..."
            className="bg-transparent text-sm flex-1 outline-none
                       text-slate-700 dark:text-slate-300
                       placeholder:text-slate-400 dark:placeholder:text-slate-600"
          />
          {search && (
            <button onClick={() => setSearch('')}>
              <X className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                category === cat
                  ? 'bg-brand-100 dark:bg-brand-600/20 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-600/30'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-surface-100 dark:hover:bg-surface-800 border border-transparent'
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 ml-auto p-1 rounded-lg
                        bg-surface-100 dark:bg-surface-800
                        border border-surface-200 dark:border-surface-700">
          <button
            onClick={() => setView('grid')}
            title="Grid view"
            className={clsx(
              'p-1.5 rounded-md transition-all',
              view === 'grid'
                ? 'bg-white dark:bg-surface-700 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            )}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView('map')}
            title="Feature organogram"
            className={clsx(
              'p-1.5 rounded-md transition-all',
              view === 'map'
                ? 'bg-white dark:bg-surface-700 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            )}
          >
            <Network className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView('workflow')}
            title="Approval workflow map"
            className={clsx(
              'p-1.5 rounded-md transition-all',
              view === 'workflow'
                ? 'bg-white dark:bg-surface-700 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            )}
          >
            <Workflow className="w-4 h-4" />
          </button>
        </div>
      </div>

      {view === 'grid' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(m => <ModuleCard key={m.id} manifest={m} />)}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16">
              <p className="text-slate-500">No modules match your search.</p>
            </div>
          )}
        </>
      )}

      {view === 'map' && <FeatureOrganogram modules={filteredInstalled} />}

      {view === 'workflow' && <ApprovalWorkflowMap />}
    </div>
  )
}
