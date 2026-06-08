import { PageHeader, Card } from '@shared/components/ui'
export default function PendingApprovals() {
  return (
    <div className="space-y-6">
      <PageHeader title="PendingApprovals" breadcrumb="Approvals / PendingApprovals"/>
      <Card className="p-8 text-center text-slate-500 text-sm">PendingApprovals — ready for Supabase integration.</Card>
    </div>
  )
}
