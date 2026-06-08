import { PageHeader, Card } from '@shared/components/ui'
export default function Invoices() {
  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" breadcrumb="Accounts / Invoices"/>
      <Card className="p-8 text-center text-slate-500 text-sm">Invoices management ready for Supabase integration.</Card>
    </div>
  )
}
