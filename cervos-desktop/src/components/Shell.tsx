import { createContext, useContext, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

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

  return (
    <SidebarContext.Provider value={{ sidebarOpen, setSidebarOpen }}>
      <div className="h-screen flex bg-surface overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          <TopBar />
          <div className="flex-1 overflow-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarContext.Provider>
  )
}
