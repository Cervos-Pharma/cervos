import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from '../lib/store'
import { useI18nStore, t } from '../lib/i18n'
import { signOut } from '../lib/sync'
import { LogoMark } from './Logo'
import { useShell } from './Shell'

const baseNavItems = [
  { path: '/', icon: 'dashboard', key: 'nav.dashboard' },
  { path: '/pos', icon: 'point_of_sale', key: 'nav.pos' },
  { path: '/inventory', icon: 'inventory_2', key: 'nav.inventory' },
  { path: '/shifts', icon: 'schedule', key: 'nav.shifts' },
  { path: '/settings', icon: 'settings', key: 'nav.settings' },
  { path: '/alerts', icon: 'notifications', key: 'nav.alerts' },
]

const adminNavItems = [
  { path: '/reports', icon: 'analytics', key: 'nav.reports' },
  { path: '/users', icon: 'group', key: 'nav.users' },
  { path: '/records', icon: 'receipt_long', key: 'nav.records' },
  { path: '/marketplace', icon: 'store', key: 'nav.marketplace' },
  { path: '/orders', icon: 'receipt', key: 'nav.orders' },
  { path: '/subscription', icon: 'credit_card', key: 'nav.subscription' },
]

export default function Sidebar() {
  const { currentOperator, isAdmin, logout } = useAuthStore()
  const locale = useI18nStore((s) => s.locale)
  const navigate = useNavigate()
  const location = useLocation()
  const { sidebarOpen, setSidebarOpen } = useShell()

  // Close the drawer on any route change (tap a link → slide back out).
  useEffect(() => {
    setSidebarOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  // Escape closes the drawer while it is open.
  useEffect(() => {
    if (!sidebarOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sidebarOpen, setSidebarOpen])

  async function handleLogout() {
    // Same real sign-out Settings already does (Supabase session + local
    // operator session) — just made reachable from one click instead of
    // being buried a page deep.
    setSidebarOpen(false)
    await signOut()
    logout()
    navigate('/login')
  }

  const nav = (
    <>
      <div className="h-14 flex items-center px-4 border-b border-outline-variant gap-2 shrink-0">
        <LogoMark className="shrink-0" />
        <span className="font-headline font-black text-lg text-on-surface">
          Cervos
        </span>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto min-h-0 scrollbar-thin [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-outline-variant [&::-webkit-scrollbar-thumb]:rounded-full">
        {baseNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:bg-outline-variant/50'
              }`
            }
          >
            <span className="material-symbols-outlined text-xl">
              {item.icon}
            </span>
            {t(item.key)}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="my-3 border-t border-outline-variant" />
            {adminNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-on-primary'
                      : 'text-on-surface-variant hover:bg-outline-variant/50'
                  }`
                }
              >
                <span className="material-symbols-outlined text-xl">
                  {item.icon}
                </span>
                {t(item.key)}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {currentOperator && (
        <div className="p-3 border-t border-outline-variant shrink-0 bg-surface-base">
          <div className="bg-primary/10 rounded-lg p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-primary truncate">{currentOperator.name}</p>
              <p className="text-xs text-on-surface-variant mt-0.5 capitalize">{currentOperator.role}</p>
            </div>
            <button
              onClick={handleLogout}
              title={t('settings.signOut')}
              className="shrink-0 p-1.5 rounded-md text-primary hover:bg-primary/20 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">logout</span>
            </button>
          </div>
        </div>
      )}
    </>
  )

  return (
    <>
      {/* Backdrop — mobile only, sits below the drawer, click to close.
          Must be a sibling of the aside: position:fixed inside a transformed
          element would be positioned relative to the drawer, not the viewport. */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      <aside
        key={locale}
        className={[
          // Mobile: slide-in overlay drawer, toggled by the TopBar hamburger.
          'fixed lg:static inset-y-0 left-0 z-50 w-64 max-w-[80vw] shrink-0',
          'transform transition-transform duration-200 ease-out',
          sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0',
          'bg-surface-base border-r border-outline-variant flex flex-col overflow-hidden',
        ].join(' ')}
      >
        {nav}
      </aside>
    </>
  )
}
