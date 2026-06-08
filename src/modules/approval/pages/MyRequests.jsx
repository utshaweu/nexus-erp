import { PageHeader, Card } from '@shared/components/ui'
export default function MyRequests() {
  return (
    <div className="space-y-6">
      <PageHeader title="MyRequests" breadcrumb="Approvals / MyRequests"/>
      <Card className="p-8 text-center text-slate-500 text-sm">MyRequests — ready for Supabase integration.</Card>
    </div>
  )
}
