import { PageHeader, Card } from '@shared/components/ui'
export default function Maintenance() {
  return (
    <div className="space-y-6">
      <PageHeader title="Maintenance" breadcrumb="Assets / Maintenance"/>
      <Card className="p-8 text-center text-slate-500 text-sm">Maintenance — ready for Supabase integration.</Card>
    </div>
  )
}
