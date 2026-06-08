import { PageHeader, Card } from '@shared/components/ui'
export default function Employees() {
  return (
    <div className="space-y-6">
      <PageHeader title="Employees" breadcrumb="HR / Employees"/>
      <Card className="p-8 text-center text-slate-500 text-sm">Employees — ready for Supabase integration.</Card>
    </div>
  )
}
