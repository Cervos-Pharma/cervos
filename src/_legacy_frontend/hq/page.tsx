/**
 * @route /hq
 * @access Operators only — validated via HMAC session cookie (hq_sess), NOT Supabase auth.
 * @description Server component that reads the `hq_sess` cookie on every request
 *   and renders the correct view without requiring client-side state:
 *   - Valid cookie  → HQOverviewInner (overview + nav cards)
 *   - Invalid/missing cookie → HQLoginGate (login form)
 *
 * This ensures that a valid 8-hour session persists across page reloads and
 * browser refreshes without re-prompting for the HQ credentials.
 *
 * The login form (HQLoginGate) calls `loginHQ` server action, then
 * `router.refresh()` to re-trigger this server component with the new cookie.
 *
 * @see lib/hq-auth.ts — HMAC session token helpers
 * @environment HQ_SECRET — must be ≥ 32 chars and not the placeholder value for login to work
 */
import { cookies } from "next/headers";
import { HQ_COOKIE_NAME, isValidHQToken } from "@/lib/hq-auth";
import HQLoginGate from "./HQLoginGate";
import HQOverviewInner from "./HQOverviewInner";

export default async function HQPage() {
  const cookieStore = await cookies();
  const isAuthed = isValidHQToken(cookieStore.get(HQ_COOKIE_NAME)?.value);
  return isAuthed ? <HQOverviewInner /> : <HQLoginGate />;
}
