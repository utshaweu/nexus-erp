import { PageHeader, Card } from '@shared/components/ui'
export default function Departments() {
  return (
    <div className="space-y-6">
      <PageHeader title="Departments" breadcrumb="HR / Departments"/>
      <Card className="p-8 text-center text-slate-500 text-sm">Departments — ready for Supabase integration.</Card>
    </div>
  )
}
