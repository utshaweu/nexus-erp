import { PageHeader, Card } from '@shared/components/ui'
export default function Journals() {
  return (
    <div className="space-y-6">
      <PageHeader title="Journals" breadcrumb="Accounts / Journals"/>
      <Card className="p-8 text-center text-slate-500 text-sm">Journals management ready for Supabase integration.</Card>
    </div>
  )
}
