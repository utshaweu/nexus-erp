import { PageHeader, Card } from '@shared/components/ui'
export default function Bills() {
  return (
    <div className="space-y-6">
      <PageHeader title="Bills" breadcrumb="Accounts / Bills"/>
      <Card className="p-8 text-center text-slate-500 text-sm">Bills management ready for Supabase integration.</Card>
    </div>
  )
}
