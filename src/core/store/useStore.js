import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

/**
 * useStore — Global Zustand store.
 *
 * Core slices are always present.
 * Module slices are dynamically added/removed on install/uninstall.
 *
 * NOTE: tenant data lives in TenantContext (React context), not here,
 * because it must re-render the whole tree when switching tenants.
 * This store handles UI state and auth session only.
 */
const useStore = create(
  devtools(
    persist(
      (set, get) => ({

        // ── Auth ────────────────────────────────────────────
        user:       null,  // Supabase auth.User shape
        session:    null,  // Supabase Session
        setUser:    (user)    => set({ user }),
        setSession: (session) => set({ session }),
        logout:     ()        => set({ user: null, session: null }),

        // ── UI ──────────────────────────────────────────────
        sidebarOpen: true,
        setSidebarOpen: (open) => set({ sidebarOpen: open }),

        theme: 'dark',
        setTheme: (theme) => set({ theme }),

        // ── Notifications ───────────────────────────────────
        notifications: [],

        addNotification: (notif) =>
          set(state => ({
            notifications: [
              {
                id:        Date.now(),
                read:      false,
                createdAt: new Date().toISOString(),
                ...notif,
              },
              ...state.notifications,
            ].slice(0, 50),   // cap at 50
          })),

        markNotificationRead: (id) =>
          set(state => ({
            notifications: state.notifications.map(n =>
              n.id === id ? { ...n, read: true } : n
            ),
          })),

        clearNotifications: () => set({ notifications: [] }),

        // ── Dynamic Module Slices ───────────────────────────
        // Module manifests inject extra state here on install.
        _moduleSlices: {},

        _addSlice: (moduleId, sliceFactory) => {
          const newState = sliceFactory(set, get)
          set(state => ({
            _moduleSlices: { ...state._moduleSlices, [moduleId]: true },
            ...newState,
          }))
        },

        _removeSlice: (moduleId) => {
          set(state => {
            const slices = { ...state._moduleSlices }
            delete slices[moduleId]
            return { _moduleSlices: slices }
          })
        },
      }),

      {
        name: 'erp-ui-store',
        // Only persist UI preferences — never persist auth or module state
        partialize: (state) => ({
          theme:       state.theme,
          sidebarOpen: state.sidebarOpen,
        }),
      }
    ),
    { name: 'NexusERP' }
  )
)

export default useStore
