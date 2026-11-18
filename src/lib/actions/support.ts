/**
 * @file lib/actions/support.ts
 * @description Server actions for the support ticket system.
 *
 * Public actions (no auth required):
 *   - submitSupportTicket — inserts a new ticket; rate-limited 5/hour per email+IP
 *   - getMyTickets        — returns tickets for the currently signed-in user
 *
 * HQ-only actions (require valid hq_sess cookie):
 *   - getSupportTickets      — all tickets, newest-first
 *   - getOpenSupportCount    — count of status = 'open' (sidebar badge)
 *   - updateTicketStatus     — change status on a ticket
 *   - addTicketNote          — set/replace the internal_note field
 *
 * Supabase tables touched:
 *   - support_tickets — insert / select / update
 *   - accounts        — select (to resolve account_id from auth user)
 *
 * @environment NEXT_PUBLIC_SUPABASE_URL
 * @environment NEXT_PUBLIC_SUPABASE_ANON_KEY
 * @environment SUPABASE_SERVICE_ROLE_KEY
 */
"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { cookies, headers } from "next/headers";
import {
  HQ_COOKIE_NAME,
  isValidHQToken,
} from "@/lib/hq-auth";
import {
  createWorkspaceSupportTicket,
  flushWorkspaceDb,
  getWorkspaceDb,
  saveWorkspaceDb,
  warmDbFromSupabase,
} from "@/lib/workspace/store";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TicketCategory = "billing" | "technical" | "general" | "other";
export type TicketStatus = "open" | "in_progress" | "resolved";

/** Full ticket row — includes HQ-only fields (internal_note). Used only in HQ actions. */
export interface SupportTicket {
  id: string;
  account_id: string | null;
  subject: string;
  message: string;
  category: TicketCategory;
  contact_email: string;
  status: TicketStatus;
  internal_note: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

/**
 * User-facing ticket — safe to serialize to the browser.
 * NEVER includes internal_note or any other HQ-only field.
 */
export interface PublicTicket {
  id: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  created_at: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const LIMITS = {
  subject: { max: 200 },
  message: { max: 5000 },
  email:   { max: 320 },
  note:    { max: 5000 },
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const VALID_CATEGORIES: TicketCategory[] = ["billing", "technical", "general", "other"];
const VALID_STATUSES: TicketStatus[]     = ["open", "in_progress", "resolved"];

// ─── Rate limiter ─────────────────────────────────────────────────────────────
// In-process; resets on server restart. Good enough for low-traffic abuse prevention.

const RATE_WINDOW_MS   = 60 * 60 * 1000; // 1 hour
const RATE_MAX_SUBMIT  = 5;

const emailRateMap = new Map<string, number[]>();
const ipRateMap    = new Map<string, number[]>();

function checkRateLimit(key: string, map: Map<string, number[]>, max: number): boolean {
  const now    = Date.now();
  const window = map.get(key) ?? [];
  const recent = window.filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= max) return false;
  map.set(key, [...recent, now]);
  return true;
}

// ─── HQ auth helper ──────────────────────────────────────────────────────────

async function assertHQAuth(): Promise<{ error: string | null }> {
  const cookieStore = await cookies();
  const token = cookieStore.get(HQ_COOKIE_NAME)?.value;
  if (!isValidHQToken(token)) return { error: "Unauthorized" };
  return { error: null };
}

// ─── Public actions ──────────────────────────────────────────────────────────

/**
 * Submits a new support ticket (publicly accessible — no auth required).
 *
 * Validation pipeline:
 *  1. Field validation (required, length, email format, category)
 *  2. Rate limit by email: 5/hour
 *  3. Rate limit by IP:    5/hour
 *  4. If logged in, resolve account_id; pre-fill email if not provided
 *  5. Insert into support_tickets
 *
 * @returns `{ error }` — null on success, message string on failure
 */
export async function submitSupportTicket(opts: {
  subject: string;
  message: string;
  category: TicketCategory;
  contactEmail: string;
}): Promise<{ error: string | null }> {
  // 1. Field validation
  if (!opts.subject?.trim())                return { error: "Subject is required." };
  if (opts.subject.trim().length > LIMITS.subject.max) return { error: `Subject must be under ${LIMITS.subject.max} characters.` };
  if (!opts.message?.trim())                return { error: "Message is required." };
  if (opts.message.trim().length > LIMITS.message.max) return { error: `Message must be under ${LIMITS.message.max} characters.` };
  if (!opts.contactEmail?.trim())           return { error: "Contact email is required." };
  if (!EMAIL_RE.test(opts.contactEmail.trim())) return { error: "Please enter a valid email address." };
  if (opts.contactEmail.trim().length > LIMITS.email.max) return { error: "Email address is too long." };
  if (!VALID_CATEGORIES.includes(opts.category)) return { error: "Invalid category." };

  const email = opts.contactEmail.trim().toLowerCase();

  // 2. Rate limit by email
  if (!checkRateLimit(email, emailRateMap, RATE_MAX_SUBMIT)) {
    return { error: "Too many requests. Please wait before submitting again, or email hq@cervos.online directly." };
  }

  // 3. Rate limit by IP
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (ip !== "unknown" && !checkRateLimit(ip, ipRateMap, RATE_MAX_SUBMIT)) {
    return { error: "Too many requests from this connection. Please try again later." };
  }

  // 4. Resolve account_id if logged in
  let accountId: string | null = null;
  let userEmail = email;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      if (user.email) userEmail = user.email.toLowerCase();
      const { data: acct } = await supabase
        .from("accounts")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();
      accountId = acct?.id ?? null;
    }
  } catch {
    // Offline or cookie-less submission still persists into workspace DB
  }

  // 5. Persist cleanly into workspace DB (so HQ Support Desk always receives every ticket)
  await warmDbFromSupabase();
  const db = getWorkspaceDb();
  const created = createWorkspaceSupportTicket(db, {
    accountId,
    contactEmail: email.slice(0, LIMITS.email.max) || userEmail,
    subject: opts.subject.trim().slice(0, LIMITS.subject.max),
    message: opts.message.trim().slice(0, LIMITS.message.max),
    category: opts.category,
    source: "web",
  });
  saveWorkspaceDb(db);
  await flushWorkspaceDb();

  // 6. Mirror into Supabase support_tickets when configured (non-fatal if offline/mock)
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const svc = await createServiceClient();
      await svc.from("support_tickets").insert({
        id: created.id,
        subject: created.subject,
        message: created.message,
        category: created.category,
        contact_email: created.contactEmail,
        account_id: created.accountId,
        status: "open",
        source: "web",
      });
    } catch {
      // Primary ticket already recorded inside workspace DB
    }
  }

  return { error: null };
}

/**
 * Returns the user-facing (safe) view of tickets submitted by the currently
 * signed-in user (matched via account_id).
 *
 * IMPORTANT: only the columns declared in PublicTicket are selected — internal_note
 * and other HQ-only fields are never fetched and therefore never serialized to the
 * browser as React client-component props.
 *
 * Returns [] if unauthenticated or no account found.
 */
export async function getMyTickets(): Promise<PublicTicket[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: acct } = await supabase
    .from("accounts")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!acct) return [];

  const svc = await createServiceClient();
  // Explicit column list — never select internal_note or any HQ-only field here.
  const { data } = await svc
    .from("support_tickets")
    .select("id, subject, category, status, created_at")
    .eq("account_id", acct.id)
    .order("created_at", { ascending: false });

  return (data as PublicTicket[]) ?? [];
}

// ─── HQ actions ──────────────────────────────────────────────────────────────

/**
 * Returns all support tickets, newest-first.
 * Requires a valid HQ session.
 */
export async function getSupportTickets(): Promise<{
  data: SupportTicket[] | null;
  error: string | null;
}> {
  const auth = await assertHQAuth();
  if (auth.error) return { data: null, error: auth.error };

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data: data as SupportTicket[], error: null };
}

/**
 * Returns the count of open (status = 'open') tickets.
 * Requires a valid HQ session.
 * Falls back to 0 on error (used for sidebar badge — non-critical).
 */
export async function getOpenSupportCount(): Promise<number> {
  const auth = await assertHQAuth();
  if (auth.error) return 0;

  const supabase = await createServiceClient();
  const { count } = await supabase
    .from("support_tickets")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");

  return count ?? 0;
}

/**
 * Updates the status of a support ticket.
 * Requires a valid HQ session.
 *
 * @param ticketId - UUID of the support_tickets row
 * @param status   - New status: 'open' | 'in_progress' | 'resolved'
 */
export async function updateTicketStatus(
  ticketId: string,
  status: TicketStatus
): Promise<{ error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { error: auth.error };

  if (!ticketId || typeof ticketId !== "string") return { error: "Invalid ticket ID." };
  if (!VALID_STATUSES.includes(status)) return { error: "Invalid status." };

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("support_tickets")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", ticketId);

  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Sets (or replaces) the internal note on a support ticket.
 * Notes are visible only in the HQ Console.
 * Requires a valid HQ session.
 *
 * @param ticketId - UUID of the support_tickets row
 * @param note     - Note text (empty string clears the note)
 */
export async function addTicketNote(
  ticketId: string,
  note: string
): Promise<{ error: string | null }> {
  const auth = await assertHQAuth();
  if (auth.error) return { error: auth.error };

  if (!ticketId || typeof ticketId !== "string") return { error: "Invalid ticket ID." };
  if (typeof note !== "string") return { error: "Invalid note." };
  if (note.trim().length > LIMITS.note.max) return { error: `Note must be under ${LIMITS.note.max} characters.` };

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("support_tickets")
    .update({
      internal_note: note.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketId);

  if (error) return { error: error.message };
  return { error: null };
}
