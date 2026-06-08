import { PageHeader, Card } from '@shared/components/ui'
export default function Categories() {
  return (
    <div className="space-y-6">
      <PageHeader title="Categories" breadcrumb="Assets / Categories"/>
      <Card className="p-8 text-center text-slate-500 text-sm">Categories — ready for Supabase integration.</Card>
    </div>
  )
}
