/**
 * @file lib/support.ts
 * @description POS-side support ticket plumbing.
 *
 * Tickets are created OFFLINE-FIRST: validated, written to the local
 * `support_tickets` mirror immediately, then uploaded to the web portal's
 * `/api/support/tickets` endpoint (which inserts with the service key because
 * the cloud table has no INSERT policy for non-HQ clients — verified live:
 * direct anon-token inserts 403).
 *
 * Rows that fail to upload (offline) stay `remote = 0` and are retried by
 * `flushPendingTickets()` on the next Support page open / app boot.
 *
 * Status changes made at HQ come back via `refreshTicketStatuses()` (GET).
 */
import { queryDb, executeDb, generateId, nowIso } from './database'
import { getAccessToken, getSupabase } from './sync'

export type TicketCategory = 'billing' | 'technical' | 'general' | 'other'

export interface LocalTicket {
  id: string
  account_id: string | null
  subject: string
  message: string
  category: string
  status: string
  contact_email: string | null
  source: string
  created_at: string
  updated_at: string | null
  remote: number
}

const LIMITS = {
  subject: 200,
  message: 5000,
} as const

const VALID_CATEGORIES: TicketCategory[] = ['billing', 'technical', 'general', 'other']

export const WEB_URL: string =
  (import.meta as any).env?.VITE_WEB_URL || 'https://cervos.online'

/**
 * Get the current Supabase session's access token (for Bearer auth on the
 * web API). Returns null when signed out or offline-expired.
 */
async function bearerToken(): Promise<string | null> {
  try {
    const token = await getAccessToken()
    return token || null
  } catch {
    return null
  }
}

function validateTicket(subject: string, message: string, category: string): string | null {
  if (!subject.trim()) return 'subject'
  if (subject.trim().length > LIMITS.subject) return 'subjectLong'
  if (!message.trim()) return 'message'
  if (message.trim().length > LIMITS.message) return 'messageLong'
  if (!VALID_CATEGORIES.includes(category as TicketCategory)) return 'category'
  return null
}

/**
 * Create a ticket. Writes locally FIRST (works offline), then uploads.
 * Returns `{ error: string | null, offline: boolean }` — `offline: true`
 * means the ticket is safely stored and will be uploaded on a later flush.
 */
export async function submitSupportTicket(opts: {
  subject: string
  message: string
  category: string
}): Promise<{ error: string | null; offline: boolean }> {
  const subject = opts.subject.trim()
  const message = opts.message.trim()
  const invalid = validateTicket(subject, message, opts.category)
  if (invalid) return { error: `support.error.${invalid}`, offline: false }

  const id = generateId()
  const now = nowIso()
  const accountId = await getAccountId()
  await executeDb(
    `INSERT INTO support_tickets (id, account_id, subject, message, category, status, contact_email, source, created_at, updated_at, remote)
     VALUES (?,?,?,?,?,?,?,?,?,?,0)`,
    [id, accountId, subject, message, opts.category, 'open', await getContactEmail(), 'pos', now, now]
  )

  return uploadOne(id)
}

/** Upload one pending local ticket. Marks remote=1 + fills server id metadata on success. */
async function uploadOne(localId: string): Promise<{ error: string | null; offline: boolean }> {
  const rows = (await queryDb('SELECT * FROM support_tickets WHERE id = ?', [localId])) as LocalTicket[]
  const row = rows[0]
  if (!row) return { error: 'support.error.notFound', offline: false }

  const token = await bearerToken()
  if (!token) return { error: null, offline: true } // signed out — retry later

  try {
    const res = await fetch(`${WEB_URL}/api/support/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        subject: row.subject,
        message: row.message,
        category: row.category,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      // 4xx validation / quota errors are permanent for this submission —
      // don't retry forever, but keep the ticket visible locally.
      await executeDb('UPDATE support_tickets SET remote = 2 WHERE id = ?', [localId])
      return { error: typeof data?.error === 'string' ? 'support.error.rejected' : 'support.error.rejected', offline: false }
    }
    // Success: adopt the SERVER's ticket id so later status changes made at
    // HQ (matched by id in refreshTicketStatuses) land on this local row.
    // SQLite allows updating a TEXT primary key; the local id was a scratch
    // placeholder only the local table knew about.
    const server = data?.ticket
    if (server?.id && server.id !== localId) {
      await executeDb(
        `UPDATE support_tickets SET id = ?, remote = 1, status = ?, created_at = ?, updated_at = ? WHERE id = ?`,
        [server.id, server.status ?? 'open', server.created_at ?? row.created_at, server.created_at ?? nowIso(), localId]
      )
    } else if (server?.id) {
      await executeDb('UPDATE support_tickets SET remote = 1 WHERE id = ?', [localId])
    }
    return { error: null, offline: false }
  } catch {
    // Network failure — ticket stays remote=0, flushed on a later cycle.
    return { error: null, offline: true }
  }
}

/** Retry every still-pending (remote=0) ticket upload. */
export async function flushPendingTickets(): Promise<number> {
  const pending = (await queryDb(
    'SELECT id FROM support_tickets WHERE remote = 0 ORDER BY created_at ASC LIMIT 10'
  )) as { id: string }[]
  let uploaded = 0
  for (const p of pending) {
    const r = await uploadOne(p.id)
    if (!r.offline && !r.error) uploaded++
  }
  return uploaded
}

/**
 * Pull status changes made at HQ for the account's tickets and mirror them
 * into the local table. Local rows that were never uploaded keep their own
 * status ('open') until they flush.
 */
export async function refreshTicketStatuses(): Promise<void> {
  const token = await bearerToken()
  if (!token) return
  try {
    const res = await fetch(`${WEB_URL}/api/support/tickets`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return
    const data = await res.json()
    for (const t of data?.tickets ?? []) {
      await executeDb(
        `UPDATE support_tickets SET status = ?, updated_at = ? WHERE id = ? AND remote = 1`,
        [t.status, t.updated_at ?? t.created_at, t.id]
      )
    }
  } catch {
    /* offline — statuses refresh next time */
  }
}

async function getAccountId(): Promise<string | null> {
  const rows = await queryDb("SELECT value FROM app_settings WHERE key = 'account_id'")
  try {
    return rows.length ? JSON.parse(rows[0].value) : null
  } catch {
    return null
  }
}

async function getContactEmail(): Promise<string | null> {
  try {
    const { data } = await getSupabase().auth.getUser()
    if (data?.user?.email) return data.user.email
  } catch {
    /* fall through */
  }
  return null
}
