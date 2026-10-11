import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkIpRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  // Token-guessing resistance: lookup is keyed on a guessable URL param, so
  // throttle per IP tighter than normal public routes.
  const rl = checkIpRateLimit(request, "invite-lookup", 10, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const { data: invite, error } = await supabase
    .from("supplier_invites")
    .select(`
      id,
      status,
      token_expires_at,
      quote_requests!left(company_name)
    `)
    .eq("invite_token", token)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!invite) {
    return NextResponse.json({ error: "Invalid invite token" }, { status: 404 });
  }

  if (invite.status === "accepted") {
    return NextResponse.json({ error: "Invite already used" }, { status: 400 });
  }

  if (invite.status === "expired" || new Date(invite.token_expires_at) < new Date()) {
    return NextResponse.json({ error: "Invite has expired" }, { status: 400 });
  }

  if (invite.status === "cancelled") {
    return NextResponse.json({ error: "Invite has been cancelled" }, { status: 400 });
  }

  const companyName = (invite.quote_requests as { company_name?: string } | null)?.company_name ?? "Your Company";

  return NextResponse.json({
    data: {
      id: invite.id,
      companyName,
      status: invite.status,
    },
  });
}
