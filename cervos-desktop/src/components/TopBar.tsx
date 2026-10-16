import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { useI18nStore, t } from '../lib/i18n'
import Logo from './Logo'
import { useShell } from './Shell'

export default function TopBar() {
  const navigate = useNavigate()
  const { currentOperator, logout } = useAuthStore()
  const { setSidebarOpen, sidebarOpen } = useShell()

  async function handleLock() {
    logout()
    navigate('/login')
  }

  const { locale, toggleLocale } = useI18nStore()

  return (
    <header className="h-14 bg-surface-base border-b border-outline-variant/60 flex items-center justify-between px-4 sm:px-6 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        {/* Hamburger — opens the slide-in drawer on narrow screens (below lg) */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle navigation"
          className="lg:hidden p-2 -ml-2 rounded-lg text-on-surface-variant hover:bg-outline-variant/50 transition-colors"
        >
          <span className="material-symbols-outlined text-xl">
            {sidebarOpen ? 'close' : 'menu'}
          </span>
        </button>
        <Logo size="sm" />
        <span className="font-headline font-semibold text-on-surface hidden sm:block">Cervos POS</span>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <button
          onClick={toggleLocale}
          title={locale === 'en' ? t('topbar.switch_sw') : t('topbar.switch_en')}
          className="p-2 rounded-lg hover:bg-outline-variant/50 transition-colors"
        >
          <span className="material-symbols-outlined text-xl text-on-surface-variant">
            language
          </span>
        </button>

        {currentOperator && (
          <button
            onClick={handleLock}
            title={t('common.lock')}
            className="p-2 rounded-lg hover:bg-outline-variant/50 transition-colors"
          >
            <span className="material-symbols-outlined text-xl text-on-surface-variant">
              lock
            </span>
          </button>
        )}
      </div>
    </header>
  )
}
