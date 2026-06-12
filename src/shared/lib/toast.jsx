import { toast as hotToast } from 'react-hot-toast'
import { AlertTriangle, Info } from 'lucide-react'

// Thin wrapper around react-hot-toast.
// Adds warning and info variants (missing from the library) via a custom icon.
// All variants inherit the Toaster's configured styles (background, border, radius).
//
// Usage:
//   import toast from '@shared/lib/toast'
//   toast.success('Saved!')
//   toast.error('Something went wrong.')
//   toast.warning('Low stock level.')
//   toast.info('New update available.')
//   toast.loading('Saving...')
//   toast.promise(apiCall(), { loading: '...', success: 'Done', error: 'Failed' })
//   toast.dismiss(id)

const toast = {
  success: (message, opts) =>
    hotToast.success(message, opts),

  error: (message, opts) =>
    hotToast.error(message, opts),

  warning: (message, opts) =>
    hotToast(message, {
      icon: <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />,
      duration: 4000,
      ...opts,
    }),

  info: (message, opts) =>
    hotToast(message, {
      icon: <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />,
      duration: 4000,
      ...opts,
    }),

  loading: (message, opts) =>
    hotToast.loading(message, opts),

  promise: (promise, messages, opts) =>
    hotToast.promise(promise, messages, opts),

  dismiss: (id) => hotToast.dismiss(id),
}

export default toast
