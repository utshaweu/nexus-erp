import { Modal, Button, Input } from '@shared/components/ui'

export default function SaveFilterModal({ open, onClose, form, onSubmit, placeholder, description }) {
  return (
    <Modal open={open} onClose={onClose} title="Save Filter" size="sm">
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Input
          label="Filter Name"
          placeholder={placeholder}
          error={form.formState.errors.name?.message}
          {...form.register('name')}
        />
        <p className="text-xs text-slate-500">{description}</p>
        <div className="flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" loading={form.formState.isSubmitting}>Save</Button>
        </div>
      </form>
    </Modal>
  )
}
