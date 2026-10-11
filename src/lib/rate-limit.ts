const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

/**
 * Best-effort client-IP extraction for rate-limit keying. Reads the standard
 * proxy headers set by Vercel's edge (x-forwarded-for) and falls back to the
 * direct peer address. Not a security boundary — just a throttle key.
 */
export function clientIpFrom(request: {
  headers: { get(name: string): string | null };
  ip?: string;
}): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? request.ip ?? "unknown";
}

/**
 * Per-IP keyed limiter for public/unauthenticated routes. Defaults are tuned
 * for real user flows (a download page load fires 1–2 requests) so an
 * attacker hammering the endpoint gets cut off long before Supabase quota
 * burns, while normal users never notice.
 */
export function checkIpRateLimit(
  request: Parameters<typeof clientIpFrom>[0],
  scope: string,
  maxRequests = 30,
  windowMs = 60_000
): ReturnType<typeof checkRateLimit> {
  return checkRateLimit(`${scope}:${clientIpFrom(request)}`, maxRequests, windowMs);
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

export function rateLimitResponse(resetAt: number): Response {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return new Response(
    JSON.stringify({ error: "Too many requests. Please try again later." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
      },
    }
  );
}
