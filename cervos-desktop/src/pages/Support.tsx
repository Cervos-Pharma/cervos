import { useState, useEffect, useCallback } from 'react'
import { queryDb, executeDb } from '../lib/database'
import { useTranslation } from '../lib/i18n'
import { submitSupportTicket, refreshTicketStatuses, flushPendingTickets, LocalTicket } from '../lib/support'
import { useAuthStore } from '../lib/store'

/**
 * Support & Feedback page — bilingual FAQs (EN/SW) and a ticket system that
 * drops straight into the same HQ support inbox the web portal feeds
 * (support_tickets → /hq/support), so admins deal with POS and web tickets
 * in one place.
 */
export default function Support() {
  const { t } = useTranslation()
  const { isAuthenticated } = useAuthStore()
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [tickets, setTickets] = useState<LocalTicket[]>([])
  const [category, setCategory] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const FAQ_KEYS = [
    'support.faq1', 'support.faq2', 'support.faq3', 'support.faq4',
    'support.faq5', 'support.faq6', 'support.faq7', 'support.faq8',
  ]

  const load = useCallback(async () => {
    await flushPendingTickets()
    await refreshTicketStatuses()
    const rows = (await queryDb(
      'SELECT * FROM support_tickets ORDER BY created_at DESC LIMIT 50'
    )) as LocalTicket[]
    setTickets(rows)
  }, [])

  useEffect(() => {
    if (isAuthenticated) load()
  }, [isAuthenticated, load])

  if (!isAuthenticated) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (sending) return
    setNotice(null)
    setSending(true)
    try {
      const res = await submitSupportTicket({ subject, message, category })
      if (res.error) {
        setNotice(t('support.errorGeneric'))
      } else if (res.offline) {
        setNotice(t('support.queuedOffline'))
        setSubject(''); setMessage(''); setCategory('')
      } else {
        setNotice(t('support.sentOk'))
        setSubject(''); setMessage(''); setCategory('')
      }
      await load()
    } finally {
      setSending(false)
    }
  }

  async function deleteDraftIfRejected(t: LocalTicket) {
    if (t.remote === 2) {
      await executeDb('DELETE FROM support_tickets WHERE id = ?', [t.id])
      await load()
    }
  }

  const statusChip = (status: string, remote: number): { label: string; cls: string } => {
    if (remote === 0) return { label: t('support.statusPending'), cls: 'bg-warning/10 text-warning' }
    if (remote === 2) return { label: t('support.statusRejected'), cls: 'bg-error/10 text-error' }
    if (status === 'in_progress') return { label: t('support.statusInProgress'), cls: 'bg-primary/10 text-primary' }
    if (status === 'resolved') return { label: t('support.statusResolved'), cls: 'bg-secondary/10 text-secondary' }
    return { label: t('support.statusOpen'), cls: 'bg-outline-variant/40 text-on-surface-variant' }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="font-headline text-2xl font-black text-on-surface mb-2">
        {t('support.title')}
      </h1>
      <p className="text-sm text-on-surface-variant mb-8">{t('support.subtitle')}</p>

      {/* ─── FAQ ─────────────────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="font-headline text-lg font-bold text-on-surface mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">quiz</span>
          {t('support.faqTitle')}
        </h2>
        <div className="space-y-2">
          {FAQ_KEYS.map((key, i) => (
            <div key={key} className="border border-outline-variant rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-outline-variant/20 transition-colors"
              >
                <span className="font-semibold text-on-surface text-sm">{t(`${key}.q`)}</span>
                <span className={`material-symbols-outlined text-on-surface-variant transition-transform ${openFaq === i ? 'rotate-180' : ''}`}>
                  expand_more
                </span>
              </button>
              {openFaq === i && (
                <div className="px-4 pb-4 text-sm text-on-surface-variant whitespace-pre-line">
                  {t(`${key}.a`)}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ─── Submit a ticket ─────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="font-headline text-lg font-bold text-on-surface mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">support_agent</span>
          {t('support.newTicket')}
        </h2>
        <form onSubmit={handleSubmit} className="bg-surface-base border border-outline-variant rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-1.5">
              {t('support.category')}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg border border-outline-variant bg-surface-base text-on-surface focus:border-primary outline-none"
            >
              <option value="">{t('support.chooseCategory')}</option>
              <option value="technical">{t('support.catTechnical')}</option>
              <option value="billing">{t('support.catBilling')}</option>
              <option value="general">{t('support.catGeneral')}</option>
              <option value="other">{t('support.catOther')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-1.5">
              {t('support.subjectLabel')}
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              required
              placeholder={t('support.subjectPlaceholder')}
              className="w-full px-3 py-2.5 rounded-lg border border-outline-variant bg-surface-base text-on-surface focus:border-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-1.5">
              {t('support.messageLabel')}
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={5000}
              rows={5}
              required
              placeholder={t('support.messagePlaceholder')}
              className="w-full px-3 py-2.5 rounded-lg border border-outline-variant bg-surface-base text-on-surface focus:border-primary outline-none resize-y"
            />
          </div>
          {notice && (
            <div className={`text-sm rounded-lg px-3 py-2 ${
              notice === t('support.errorGeneric')
                ? 'bg-error/10 text-error'
                : 'bg-secondary/10 text-secondary'
            }`}>
              {notice}
            </div>
          )}
          <button
            type="submit"
            disabled={sending || !category || !subject.trim() || !message.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-on-primary font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {sending ? (
              <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-lg">send</span>
            )}
            {t('support.submit')}
          </button>
        </form>
      </section>

      {/* ─── My tickets ──────────────────────────────────────────────────── */}
      {tickets.length > 0 && (
        <section>
          <h2 className="font-headline text-lg font-bold text-on-surface mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">history</span>
            {t('support.myTickets')}
          </h2>
          <div className="space-y-2">
            {tickets.map((tk) => {
              const chip = statusChip(tk.status, tk.remote)
              return (
                <div key={tk.id} className="border border-outline-variant rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-on-surface text-sm truncate">{tk.subject}</p>
                      <p className="text-xs text-on-surface-variant mt-1">
                        {t(`support.cat${tk.category.charAt(0).toUpperCase()}${tk.category.slice(1)}`)} · {new Date(tk.created_at).toLocaleString()}
                      </p>
                      <p className="text-sm text-on-surface-variant mt-2 line-clamp-2">{tk.message}</p>
                    </div>
                    <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${chip.cls}`}>
                      {chip.label}
                    </span>
                  </div>
                  {tk.remote === 2 && (
                    <button
                      type="button"
                      onClick={() => deleteDraftIfRejected(tk)}
                      className="mt-2 text-xs text-error underline"
                    >
                      {t('support.removeRejected')}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
