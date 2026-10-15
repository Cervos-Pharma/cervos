/**
 * @route POST /api/support/tickets
 * @route GET  /api/support/tickets
 * @access Desktop POS endpoint — authenticated via the operator's Supabase
 *         session JWT (Authorization: Bearer <token>), NOT web cookies: the
 *         POS keeps its session in the app, not in a browser cookie jar.
 *
 * POST — Submit a support ticket from the POS. Mirrors the web portal's
 *        submitSupportTicket action: same validation limits, same rate-limit
 *        budget (5 per hour), but inserted with the SERVICE client because
 *        support_tickets has no INSERT policy for anonymous/authenticated
 *        users (the web action does the same).
 *
 * GET  — Returns the account's own tickets (public fields only — internal_note
 *        is HQ-only and never leaves the HQ console) so the POS can show
 *        status changes made at HQ.
 *
 * CORS: proxy.ts reflects only the allowlisted POS origins.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";

const LIMITS = {
  subject: 200,
  message: 5000,
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CATEGORIES = ["billing", "technical", "general", "other"] as const;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_MAX = 5;

/** Validate the POS bearer token and resolve its account. */
async function resolveSession(
  req: NextRequest
): Promise<{ authUserId: string; accountId: string; email: string } | null> {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return null;

  const admin = await createServiceClient();
  // Validates the JWT against the auth server (rejects expired/forged tokens).
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;

  const { data: acct } = await admin
    .from("accounts")
    .select("id, email")
    .eq("auth_user_id", data.user.id)
    .single();

  if (!acct) return null;
  return { authUserId: data.user.id, accountId: acct.id, email: acct.email ?? data.user.email ?? "" };
}

export async function POST(req: NextRequest) {
  const session = await resolveSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Same budget as the web portal's per-email rate limit, keyed per account.
  // checkIpRateLimit dedupes by a caller-supplied key string.
  const rl = checkRateLimit(`pos-support:${session.accountId}`, RATE_MAX, RATE_WINDOW_MS);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  let body: { subject?: string; message?: string; category?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const subject = (body.subject ?? "").trim();
  const message = (body.message ?? "").trim();
  const category = (body.category ?? "other").toLowerCase() as (typeof CATEGORIES)[number];

  if (!subject) return NextResponse.json({ error: "Subject is required." }, { status: 400 });
  if (subject.length > LIMITS.subject)
    return NextResponse.json({ error: "Subject must be under 200 characters." }, { status: 400 });
  if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });
  if (message.length > LIMITS.message)
    return NextResponse.json({ error: "Message must be under 5000 characters." }, { status: 400 });
  if (!(CATEGORIES as readonly string[]).includes(category))
    return NextResponse.json({ error: "Invalid category." }, { status: 400 });

  // Contact email: default to the account email; allow the body to override
  // so the POS user can be reached elsewhere (validated like the web form).
  const contact = (body as { contact_email?: string }).contact_email?.trim() || session.email;
  if (!EMAIL_RE.test(contact)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const admin = await createServiceClient();
  const { data, error } = await admin
    .from("support_tickets")
    .insert({
      subject: subject.slice(0, LIMITS.subject),
      message: message.slice(0, LIMITS.message),
      category,
      contact_email: contact.toLowerCase().slice(0, 320),
      account_id: session.accountId,
      status: "open",
      source: "pos",
    })
    .select("id, subject, category, status, created_at")
    .single();

  if (error) {
    console.error("POST /api/support/tickets insert error:", error.message);
    return NextResponse.json({ error: "Could not submit ticket. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ticket: data, error: null });
}

export async function GET(req: NextRequest) {
  const session = await resolveSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await createServiceClient();
  // Public fields only — internal_note never leaves HQ.
  const { data, error } = await admin
    .from("support_tickets")
    .select("id, subject, category, status, created_at, updated_at")
    .eq("account_id", session.accountId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("GET /api/support/tickets error:", error.message);
    return NextResponse.json({ error: "Could not load tickets." }, { status: 500 });
  }

  return NextResponse.json({ tickets: data ?? [], error: null });
}
