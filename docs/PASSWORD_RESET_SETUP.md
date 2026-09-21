# Fixing the "forgot password" link going to the landing page

## TL;DR

The app code is correct. The bug is in the **Supabase dashboard** configuration:

- The reset email's link targets `/auth/recovery` (via `/auth/callback?next=/auth/recovery`).
- If that URL is not on the **Redirect URLs allow-list**, Supabase refuses it and silently falls back to your **Site URL** — which is the landing page ("Get started"). That is exactly the behaviour being seen.

## Fix it in the Supabase dashboard (5 minutes)

1. Open https://supabase.com/dashboard → your project → **Authentication → URL Configuration**.
2. **Site URL** — set to your production origin, e.g. `https://cervos.online` (no trailing slash). This is where Supabase sends users when a redirect is not allowed, so make it a real page.
3. **Redirect URLs** — click **Add URL** and add **all** of these:

   | URL | Why |
   | --- | --- |
   | `https://cervos.online/auth/callback?next=/auth/recovery` | Password-reset links in production |
   | `https://cervos.online/auth/callback` | Signup confirmation links in production |
   | `https://cervos.online/**` | Any deep link on the production site |
   | `http://localhost:3000/auth/callback?next=/auth/recovery` | Password-reset links in local dev |
   | `http://localhost:3000/**` | Local dev deep links |

   Wildcards are allowed (`**` covers any path + query). If you prefer a tight allow-list, the two `callback?next=/auth/recovery` entries are the critical ones for the reset flow.
4. Click **Save**.

5. Check the email template: **Authentication → Emails → Templates → Reset Password**. The body must contain:

   ```html
   <a href="{{ .ConfirmationURL }}">Reset your password</a>
   ```

   - `{{ .ConfirmationURL }}` respects the `redirectTo` the app passes and the allow-list above.
   - If someone customized the template with `{{ .SiteURL }}` (or a hard-coded link), every reset lands on the landing page — switch it back to `{{ .ConfirmationURL }}`.
   - Also confirm **"Enable email confirmations"** and the sender identity are configured so emails actually go out.

6. **If you use custom SMTP** (Authentication → Emails → SMTP), send yourself a test reset. Some providers rewrite URLs; verify the final link still points at your domain + `/auth/callback?...`.

## How the flow works after the fix (for reference)

```
/auth (Forgot password tab)
  └─ supabase.auth.resetPasswordForEmail(email, {
       redirectTo: `${origin}/auth/callback?next=/auth/recovery`
     })
        ↓ email
User clicks the link in the email
        ↓
https://<origin>/auth/callback?code=…&next=/auth/recovery   (PKCE code)
        ↓ src/app/auth/callback/route.ts
Supabase code exchange → session cookie
next starts with /auth/recovery → redirect to /auth/recovery
        ↓
/auth/recovery — RecoveryForm: user types a new password → supabase.auth.updateUser({ password })
        ↓
Redirect to /auth to sign in with the new password
```

The route handler already special-cases recovery: if `type=recovery` or `next` starts with `/auth/recovery`, it redirects there **before** the account-provisioning logic, so reset links never create duplicate accounts.

## Recovery page UX (added)

- The expired/invalid-link state now explains that links are single-use and time-limited and offers **"Send reset link"** (→ `/auth?tab=reset`) to request a fresh one, plus the usual back-to-sign-in link.
- `/auth?tab=reset` opens the Forgot-password tab directly, so the retry loop is one tap.

## Verifying the fix

1. In production (after the dashboard change), request a reset for a real account.
2. The email link should land on `/auth/recovery?...` showing **"Set a new password"** with two fields — not the landing page.
3. Set a new password → you should be redirected to `/auth` and able to sign in.
4. If it still bounces to the landing page: open the email → right-click → copy link address → confirm the host is **your domain** (not `…supabase.co`); if it's a `supabase.co` host, the template is using `{{ .SiteURL }}` instead of `{{ .ConfirmationURL }}`.
