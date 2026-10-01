import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  signIn,
  getLinkStatus,
  linkToExistingBranch,
  forceClaimBranch,
  runSyncCycle,
  scaffoldAccount,
  registerAndScaffoldPharmacy,
  type RemoteBranch
} from '../lib/sync'
import { queryDb } from '../lib/database'
import { useTranslation, useI18nStore } from '../lib/i18n'
import Logo from '../components/Logo'

type OnboardingStep =
  | 'welcome'
  | 'register-pharmacy'
  | 'set-pin'
  | 'confirm-email'
  | 'link'
  | 'select-branch'
  | 'create-branch'
  | 'create-operator'
  | 'done'

interface OnboardingProps {
  onComplete?: () => void
  relinking?: boolean
}

export default function Onboarding({ onComplete, relinking = false }: OnboardingProps) {
  const { t } = useTranslation()
  const { locale, toggleLocale } = useI18nStore()
  const navigate = useNavigate()

  const [step, setStep] = useState<OnboardingStep>('welcome')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Standalone Registration State (Direct in APK)
  const [pharmacyName, setPharmacyName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [showRegPassword, setShowRegPassword] = useState(false)
  const [regPhone, setRegPhone] = useState('')
  const [managerPin, setManagerPin] = useState('')
  const [regStage, setRegStage] = useState<'account' | 'branch' | 'operator' | 'sync'>('account')

  // Existing Account Sign-in State
  const [signInEmail, setSignInEmail] = useState('')
  const [signInPassword, setSignInPassword] = useState('')
  const [showSignInPassword, setShowSignInPassword] = useState(false)

  // Branches & Terminal Linking State
  const [branches, setBranches] = useState<RemoteBranch[]>([])
  const [linkedBranch, setLinkedBranch] = useState<{ name: string; address: string } | null>(null)
  const [forceClaimBranchId, setForceClaimBranchId] = useState<string | null>(null)

  // Empty Account Fallback State
  const [newBranchName, setNewBranchName] = useState('')
  const [newOperatorPin, setNewOperatorPin] = useState('')

  const inputClass =
    'w-full h-12 px-4 bg-surface-base border border-outline-variant rounded-xl text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-on-surface-variant/50 text-sm'
  const btnClass =
    'w-full h-12 bg-primary text-white rounded-xl font-headline font-semibold flex items-center justify-center gap-2 hover:bg-primary/95 active:scale-[0.98] transition-all disabled:opacity-50 shadow-md shadow-primary/20 text-sm'
  const secondaryBtnClass =
    'w-full h-12 bg-surface border border-outline-variant/80 text-on-surface rounded-xl font-headline font-semibold flex items-center justify-center gap-2 hover:bg-outline-variant/30 active:scale-[0.98] transition-all text-sm'

  async function finishLink() {
    const branchRows = await queryDb("SELECT value FROM app_settings WHERE key = 'branch_id'")
    const branchId = branchRows.length ? JSON.parse(branchRows[0].value) : null
    const operators = branchId
      ? await queryDb('SELECT id FROM operators WHERE branch_id = ?', [branchId])
      : []
    if (operators.length === 0) {
      setStep('create-operator')
      return
    }
    setStep('done')
  }

  // Handle standalone registration directly in APK
  async function handleRegisterStep1(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!pharmacyName.trim()) {
      setError(t('onboarding.pharmacyNameHint'))
      return
    }
    if (!regEmail.trim() || !regPassword) {
      setError('Please provide a valid email and password.')
      return
    }
    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setStep('set-pin')
  }

  async function handleCompleteRegistration(e: React.FormEvent) {
    e.preventDefault()
    if (managerPin.length !== 4) {
      setError('PIN must be exactly 4 digits.')
      return
    }

    setIsLoading(true)
    setError(null)
    setRegStage('account')

    try {
      const res = await registerAndScaffoldPharmacy({
        pharmacyName: pharmacyName.trim(),
        fullName: ownerName.trim() || 'Manager',
        email: regEmail.trim(),
        password: regPassword,
        phone: regPhone.trim() || undefined,
        managerPin,
        onProgress: (stage) => setRegStage(stage),
      })

      if (res.requiresEmailConfirmation) {
        setStep('confirm-email')
        return
      }

      if (!res.success) {
        throw new Error(res.error || 'Failed to setup pharmacy terminal.')
      }

      await finishLink()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register pharmacy terminal.')
      setStep('register-pharmacy')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle sign-in to existing account
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      await signIn(signInEmail.trim(), signInPassword)
      const status = await getLinkStatus()

      if (status.alreadyLinked) {
        if (relinking) {
          onComplete?.()
          return
        }
        await runSyncCycle()
        await finishLink()
        return
      }

      if (status.branches.length === 0) {
        setNewBranchName(pharmacyName || '')
        setStep('create-branch')
        return
      }

      if (status.branches.length === 1) {
        await linkToExistingBranch(status.branches[0].id)
        const sync = await runSyncCycle()
        if (!sync.ok) {
          console.warn('Initial branch sync warning:', sync.message)
        }
        await finishLink()
        return
      }

      setBranches(status.branches)
      setStep('select-branch')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSelectBranch(branchId: string) {
    setIsLoading(true)
    setError(null)
    setForceClaimBranchId(null)
    try {
      await linkToExistingBranch(branchId)
      const sync = await runSyncCycle()
      if (!sync.ok) {
        console.warn('Sync post-select warning:', sync.message)
      }
      await finishLink()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to link this branch'
      setError(msg)
      if (msg.includes('already has an activated POS device')) {
        setForceClaimBranchId(branchId)
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function handleForceClaim() {
    if (!forceClaimBranchId) return
    setIsLoading(true)
    setError(null)
    try {
      await forceClaimBranch(forceClaimBranchId)
      await runSyncCycle()
      await finishLink()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to force-claim this branch')
    } finally {
      setForceClaimBranchId(null)
      setIsLoading(false)
    }
  }

  async function handleCreateBranch(e: React.FormEvent) {
    e.preventDefault()
    setStep('create-operator')
  }

  async function handleCreateOperator(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      const newBranchId = await scaffoldAccount(newBranchName, newOperatorPin, ownerName || 'Manager')
      await linkToExistingBranch(newBranchId)
      await runSyncCycle()
      await finishLink()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to configure terminal.')
      setStep('create-branch')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (step !== 'done') return
    ;(async () => {
      const nameRows = await queryDb("SELECT value FROM app_settings WHERE key = 'centre_name'")
      const addrRows = await queryDb("SELECT value FROM app_settings WHERE key = 'centre_address'")
      setLinkedBranch({
        name: nameRows.length > 0 ? JSON.parse(nameRows[0].value) : 'Unknown pharmacy',
        address: addrRows.length > 0 ? JSON.parse(addrRows[0].value) : '',
      })
    })()
  }, [step])

  function handleDone() {
    if (onComplete) {
      onComplete()
    } else {
      navigate('/login')
    }
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-surface">
      {/* Background Ambience */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center opacity-30 pointer-events-none"
        style={{
          backgroundImage: "url('/pharmacist-1.png')",
          filter: 'blur(16px)',
          transform: 'scale(1.1)',
        }}
      />
      <div className="fixed inset-0 z-0 bg-surface/85 pointer-events-none" />

      {/* Decorative Brand watermark */}
      <div className="fixed bottom-[-10%] left-[-10%] w-[550px] h-[550px] opacity-[0.04] pointer-events-none z-0">
        <img src="/logo.png" alt="" className="w-full h-full object-contain" />
      </div>

      {/* Fixed Header */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 py-4">
        <div className="flex items-center gap-2.5">
          <Logo size="sm" />
          <span className="font-headline text-lg font-bold text-primary tracking-tight">
            Cervos POS
          </span>
        </div>

        {/* Language Switcher Badge */}
        <button
          onClick={toggleLocale}
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-base/90 border border-outline-variant/60 rounded-full text-xs font-semibold text-on-surface hover:bg-surface-container transition-all shadow-sm"
          title={locale === 'en' ? 'Badilisha kwenda Kiswahili' : 'Switch to English'}
        >
          <span className="material-symbols-outlined text-[16px] text-primary">language</span>
          <span>{locale === 'en' ? 'Kiswahili' : 'English'}</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-grow flex items-center justify-center p-4 relative z-10 pt-20 pb-12">
        <div className="relative w-full max-w-[480px]">
          {/* HUD Container & Glassmorphism Card */}
          <div className="bg-surface-base/95 border border-outline-variant/70 shadow-2xl rounded-2xl overflow-hidden backdrop-blur-md">
            {/* Top Color Accent */}
            <div className="h-1.5 w-full bg-gradient-to-r from-primary via-secondary to-accent" />

            <div className="p-7 sm:p-9">
              {/* Error Alert */}
              {error && (
                <div className="mb-5 p-3.5 bg-error/10 border border-error/25 rounded-xl text-error text-xs flex items-start gap-2.5 animate-fadeIn">
                  <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">
                    error
                  </span>
                  <div className="flex-1 font-medium">{error}</div>
                  <button
                    onClick={() => setError(null)}
                    type="button"
                    className="text-error/70 hover:text-error"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              )}

              {/* ──────────────── STEP 1: WELCOME SCREEN ──────────────── */}
              {step === 'welcome' && (
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-5 p-3 bg-primary/10 rounded-2xl flex items-center justify-center shadow-inner">
                    <img src="/logo.png" alt="Cervos" className="w-full h-full object-contain" />
                  </div>
                  <h1 className="font-headline text-2xl font-bold text-on-surface mb-2">
                    {t('onboarding.welcome')}
                  </h1>
                  <p className="text-xs text-on-surface-variant mb-7 leading-relaxed">
                    {t('onboarding.welcomeHint')}
                  </p>

                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => setStep('register-pharmacy')}
                      className={btnClass}
                    >
                      <span className="material-symbols-outlined text-[18px]">add_business</span>
                      {t('onboarding.createAccount')}
                    </button>

                    <button
                      type="button"
                      onClick={() => setStep('link')}
                      className={secondaryBtnClass}
                    >
                      <span className="material-symbols-outlined text-[18px]">login</span>
                      {t('onboarding.signInLink')}
                    </button>
                  </div>

                  <div className="mt-8 pt-6 border-t border-outline-variant/40 flex items-center justify-center gap-2 text-[11px] text-on-surface-variant/70">
                    <span className="material-symbols-outlined text-[14px]">offline_pin</span>
                    <span>Offline-First Architecture &bull; Instant Local Checkout</span>
                  </div>
                </div>
              )}

              {/* ──────────────── STEP 2: STANDALONE REGISTRATION (STEP 1 OF 2) ──────────────── */}
              {step === 'register-pharmacy' && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setStep('welcome')}
                      className="p-1 -ml-1 text-on-surface-variant hover:text-primary transition-colors"
                    >
                      <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                      <h2 className="font-headline text-xl font-bold text-on-surface">
                        {t('onboarding.stepPharmacy')}
                      </h2>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                        Step 1 of 2
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-on-surface-variant mb-5">
                    {t('onboarding.welcomeHint')}
                  </p>

                  <form onSubmit={handleRegisterStep1} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                        {t('onboarding.pharmacyName')} *
                      </label>
                      <input
                        type="text"
                        required
                        value={pharmacyName}
                        onChange={(e) => setPharmacyName(e.target.value)}
                        placeholder={t('onboarding.pharmacyNameHint')}
                        className={inputClass}
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                        {t('onboarding.ownerName')}
                      </label>
                      <input
                        type="text"
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                        placeholder={t('onboarding.ownerNameHint')}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                        {t('onboarding.email')} *
                      </label>
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="pharmacist@example.com"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                        {t('onboarding.password')} *
                      </label>
                      <div className="relative">
                        <input
                          type={showRegPassword ? 'text' : 'password'}
                          required
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          placeholder="Min. 6 characters"
                          className={`${inputClass} pr-11`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegPassword(!showRegPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-1"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {showRegPassword ? 'visibility_off' : 'visibility'}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                        {t('onboarding.phone')}
                      </label>
                      <input
                        type="tel"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder={t('onboarding.phoneHint')}
                        className={inputClass}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={!pharmacyName.trim() || !regEmail.trim() || !regPassword}
                      className={`${btnClass} mt-5`}
                    >
                      <span>{t('onboarding.continue')}</span>
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </button>
                  </form>
                </div>
              )}

              {/* ──────────────── STEP 3: SET OFFLINE MANAGER PIN (STEP 2 OF 2) ──────────────── */}
              {step === 'set-pin' && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => setStep('register-pharmacy')}
                      className="p-1 -ml-1 text-on-surface-variant hover:text-primary transition-colors disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                      <h2 className="font-headline text-xl font-bold text-on-surface">
                        {t('onboarding.managerPin')}
                      </h2>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                        Step 2 of 2
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-on-surface-variant mb-6 leading-relaxed">
                    {t('onboarding.managerPinHint')}
                  </p>

                  {isLoading ? (
                    <div className="py-8 flex flex-col items-center justify-center gap-4 text-center">
                      <span className="material-symbols-outlined text-4xl text-primary animate-spin">
                        progress_activity
                      </span>
                      <div className="space-y-1">
                        <p className="font-headline font-bold text-on-surface text-sm">
                          {t('onboarding.creatingAccount')}
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          {regStage === 'account' && t('onboarding.statusAccount')}
                          {regStage === 'branch' && t('onboarding.statusBranch')}
                          {regStage === 'operator' && t('onboarding.statusOperator')}
                          {regStage === 'sync' && t('onboarding.statusSync')}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleCompleteRegistration} className="space-y-6">
                      <div className="bg-surface p-6 rounded-2xl border border-outline-variant/60 flex flex-col items-center justify-center">
                        <span className="material-symbols-outlined text-3xl text-primary mb-3">
                          pin
                        </span>
                        <input
                          type="password"
                          inputMode="numeric"
                          required
                          maxLength={4}
                          value={managerPin}
                          onChange={(e) =>
                            setManagerPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                          }
                          placeholder="••••"
                          className="w-48 h-14 bg-surface-base border-2 border-primary/40 focus:border-primary rounded-xl text-center text-3xl font-mono tracking-[14px] text-on-surface focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all shadow-inner"
                          autoFocus
                        />
                        <span className="text-[11px] text-on-surface-variant/70 mt-3">
                          Enter 4 numerical digits
                        </span>
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading || managerPin.length !== 4}
                        className={btnClass}
                      >
                        <span className="material-symbols-outlined text-[18px]">check_circle</span>
                        <span>{t('onboarding.createPharmacyBtn')}</span>
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* ──────────────── STEP 4: EMAIL CONFIRMATION SCREEN ──────────────── */}
              {step === 'confirm-email' && (
                <div className="text-center py-4">
                  <div className="w-16 h-16 rounded-2xl bg-secondary/10 flex items-center justify-center mx-auto mb-4 text-secondary shadow-sm">
                    <span className="material-symbols-outlined text-3xl">mark_email_read</span>
                  </div>
                  <h2 className="font-headline text-xl font-bold text-on-surface mb-2">
                    {t('onboarding.emailConfirmTitle')}
                  </h2>
                  <p className="text-xs text-on-surface-variant mb-1">
                    {t('onboarding.emailConfirmBody')}
                  </p>
                  <p className="text-sm font-semibold text-primary mb-4 break-all px-4 py-2 bg-primary/5 rounded-lg border border-primary/10">
                    {regEmail}
                  </p>
                  <p className="text-xs text-on-surface-variant mb-6 leading-relaxed">
                    {t('onboarding.emailConfirmHint')}
                  </p>

                  <button
                    onClick={() => {
                      setSignInEmail(regEmail)
                      setStep('link')
                    }}
                    className={btnClass}
                  >
                    <span className="material-symbols-outlined text-[18px]">login</span>
                    <span>{t('onboarding.tabSignIn')}</span>
                  </button>
                </div>
              )}

              {/* ──────────────── STEP 5: SIGN IN TO EXISTING ACCOUNT ──────────────── */}
              {step === 'link' && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => setStep('welcome')}
                      className="p-1 -ml-1 text-on-surface-variant hover:text-primary transition-colors disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h2 className="font-headline text-xl font-bold text-on-surface">
                      {t('onboarding.linkAdmin')}
                    </h2>
                  </div>

                  <p className="text-xs text-on-surface-variant mb-5">
                    {t('onboarding.linkHint')}
                  </p>

                  <form onSubmit={handleLogin} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                        {t('onboarding.email')}
                      </label>
                      <input
                        type="email"
                        required
                        value={signInEmail}
                        onChange={(e) => setSignInEmail(e.target.value)}
                        placeholder="pharmacist@example.com"
                        className={inputClass}
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                        {t('onboarding.password')}
                      </label>
                      <div className="relative">
                        <input
                          type={showSignInPassword ? 'text' : 'password'}
                          required
                          value={signInPassword}
                          onChange={(e) => setSignInPassword(e.target.value)}
                          placeholder="••••••••"
                          className={`${inputClass} pr-11`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignInPassword(!showSignInPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-1"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {showSignInPassword ? 'visibility_off' : 'visibility'}
                          </span>
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading || !signInEmail.trim() || !signInPassword}
                      className={`${btnClass} mt-5`}
                    >
                      {isLoading ? (
                        <>
                          <span className="material-symbols-outlined animate-spin text-[18px]">
                            progress_activity
                          </span>
                          <span>Signing In...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[18px]">login</span>
                          <span>{t('onboarding.tabSignIn')}</span>
                        </>
                      )}
                    </button>
                  </form>

                  <div className="mt-6 pt-5 border-t border-outline-variant/40 text-center">
                    <button
                      type="button"
                      onClick={() => setStep('register-pharmacy')}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      {t('onboarding.createAccount')}
                    </button>
                  </div>
                </div>
              )}

              {/* ──────────────── STEP 6: SELECT EXISTING BRANCH ──────────────── */}
              {step === 'select-branch' && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => setStep('link')}
                      className="p-1 -ml-1 text-on-surface-variant hover:text-primary transition-colors disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h2 className="font-headline text-xl font-bold text-on-surface">
                      {t('onboarding.selectBranch')}
                    </h2>
                  </div>

                  <p className="text-xs text-on-surface-variant mb-4">
                    {t('onboarding.selectBranchHint')}
                  </p>

                  {forceClaimBranchId && (
                    <div className="p-4 mb-4 bg-warning/10 border border-warning/30 rounded-xl flex flex-col gap-2.5">
                      <div className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-warning text-xl mt-0.5">
                          warning
                        </span>
                        <div>
                          <p className="font-bold text-on-surface text-xs">
                            {t('onboarding.branchActivated')}
                          </p>
                          <p className="text-[11px] text-on-surface-variant mt-0.5">
                            {t('onboarding.branchActivatedHint')}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={handleForceClaim}
                        className="w-full h-10 bg-warning text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-warning/90 transition-all disabled:opacity-60"
                      >
                        <span className="material-symbols-outlined text-[16px]">device_reset</span>
                        {isLoading ? t('onboarding.claiming') : t('onboarding.forceClaim')}
                      </button>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                    {branches.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleSelectBranch(b.id)}
                        className="w-full text-left p-3.5 bg-surface-base border border-outline-variant/70 hover:border-primary hover:bg-primary/5 rounded-xl transition-all disabled:opacity-60 shadow-sm"
                      >
                        <p className="font-headline font-bold text-on-surface text-sm">{b.name}</p>
                        {b.address && (
                          <p className="text-xs text-on-surface-variant mt-0.5">{b.address}</p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ──────────────── STEP 7: FALLBACK CREATE BRANCH IF EMPTY ──────────────── */}
              {step === 'create-branch' && (
                <div>
                  <h2 className="font-headline text-xl font-bold text-on-surface mb-1">
                    {t('onboarding.setupPharmacy')}
                  </h2>
                  <p className="text-xs text-on-surface-variant mb-5">
                    {t('onboarding.setupPharmacyHint')}
                  </p>
                  <form onSubmit={handleCreateBranch} className="space-y-4">
                    <input
                      type="text"
                      required
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      placeholder="e.g. Ahadi City Pharmacy"
                      className={inputClass}
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={isLoading || !newBranchName.trim()}
                      className={btnClass}
                    >
                      {t('onboarding.continue')}
                    </button>
                  </form>
                </div>
              )}

              {/* ──────────────── STEP 8: FALLBACK CREATE OPERATOR IF EMPTY ──────────────── */}
              {step === 'create-operator' && (
                <div>
                  <h2 className="font-headline text-xl font-bold text-on-surface mb-1">
                    {t('onboarding.managerPin')}
                  </h2>
                  <p className="text-xs text-on-surface-variant mb-5">
                    {t('onboarding.managerPinHint')}
                  </p>
                  <form onSubmit={handleCreateOperator} className="space-y-5">
                    <input
                      type="password"
                      inputMode="numeric"
                      required
                      maxLength={4}
                      value={newOperatorPin}
                      onChange={(e) =>
                        setNewOperatorPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                      }
                      placeholder="••••"
                      className="w-full h-14 bg-surface-base border-2 border-primary/40 focus:border-primary rounded-xl text-center text-3xl font-mono tracking-[14px] text-on-surface focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all shadow-inner"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={isLoading || newOperatorPin.length < 4}
                      className={btnClass}
                    >
                      {isLoading ? (
                        <>
                          <span className="material-symbols-outlined animate-spin text-[18px]">
                            progress_activity
                          </span>
                          <span>Configuring...</span>
                        </>
                      ) : (
                        t('common.done')
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* ──────────────── STEP 9: DONE / READY SCREEN ──────────────── */}
              {step === 'done' && (
                <div className="text-center py-2">
                  <div className="w-16 h-16 mx-auto mb-4 bg-secondary/10 rounded-2xl flex items-center justify-center text-secondary shadow-sm">
                    <span className="material-symbols-outlined text-4xl">check_circle</span>
                  </div>
                  <h2 className="font-headline text-2xl font-bold text-on-surface mb-1.5">
                    {t('onboarding.allSet')}
                  </h2>
                  <p className="text-xs text-on-surface-variant mb-6 leading-relaxed">
                    {t('onboarding.allSetHint')}
                  </p>

                  <div className="bg-surface rounded-xl p-4 text-left border border-outline-variant/60 mb-6">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
                      {t('onboarding.branch')}
                    </p>
                    <p className="font-headline font-bold text-on-surface text-base">
                      {linkedBranch?.name ?? pharmacyName ?? 'My Pharmacy'}
                    </p>
                    {linkedBranch?.address && (
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {linkedBranch.address}
                      </p>
                    )}
                  </div>

                  <button onClick={handleDone} className={btnClass}>
                    <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
                    <span>{t('onboarding.goToSignIn')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
