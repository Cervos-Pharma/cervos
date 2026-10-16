import { createContext, useContext, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

/**
 * On Android (APK) the webview draws edge-to-edge, so content can sit under
 * the status bar / camera cutout — where taps are swallowed by the system.
 * Pad the shell's top with the device safe-area inset (0 on desktop web).
 */
const safeAreaTop = 'env(safe-area-inset-top, 0px)'

/**
 * Shared UI state for the POS shell. `sidebarOpen` drives the mobile
 * slide-in drawer (below lg). Desktop (lg+) always shows the fixed sidebar
 * and ignores this state.
 */
interface ShellContextValue {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export const SidebarContext = createContext<ShellContextValue>({
  sidebarOpen: false,
  setSidebarOpen: () => {},
})

// eslint-disable-next-line react-refresh/only-export-components
export function useShell() {
  return useContext(SidebarContext)
}

export default function Shell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // Re-keying the content wrapper on each route makes the .page-enter
  // animation replay — a light fade/slide that stops route changes feeling
  // like an abrupt swap.
  const location = useLocation()

  return (
    <SidebarContext.Provider value={{ sidebarOpen, setSidebarOpen }}>
      <div
        className="h-screen flex flex-col bg-surface overflow-hidden"
        style={{ paddingTop: safeAreaTop }}
      >
        <div className="flex flex-1 min-h-0">
          <Sidebar />
          <main className="flex-1 flex flex-col overflow-hidden min-w-0">
            <TopBar />
            <div key={location.pathname} className="page-enter flex-1 overflow-auto">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  )
}
