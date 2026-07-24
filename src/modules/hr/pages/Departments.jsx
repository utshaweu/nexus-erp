import { useState } from 'react'
import { PageHeader } from '@shared/components/ui'
import DepartmentsTab from '../components/DepartmentsTab'
import PositionsTab from '../components/PositionsTab'

const TABS = ['Departments', 'Positions']

export default function Departments() {
  const [activeTab, setActiveTab] = useState('Departments')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments & Positions"
        subtitle="Manage organizational structure and job roles"
        breadcrumb="HR / Departments"
      />

      <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-surface-800 w-fit">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-white dark:bg-surface-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Departments' ? <DepartmentsTab /> : <PositionsTab />}
    </div>
  )
}
