/**
 * @file hq/HQLoginGate.tsx
 * @description Client component — HQ Console login form.
 * Rendered by `app/hq/page.tsx` (server component) when no valid `hq_sess`
 * cookie is present. Calls `loginHQ` server action on submit; on success
 * Next.js refreshes and the server component re-renders showing the overview.
 *
 * Credentials are verified server-side against the `hq_admins` table
 * (salted scrypt hash — the password is never sent to or stored by the browser).
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginHQ } from "@/lib/actions/hq";
import Toast from "@/components/Toast";
import { useI18n } from "@/lib/i18n/context";

export default function HQLoginGate() {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  /** useState instead of useTransition — React 18 doesn't support async in startTransition */
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" | "info" } | null>(null);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await loginHQ({ email, password });
      if (result.error) {
        setToast({ message: result.error, type: "error" });
        return;
      }
      // Refresh so the server component re-reads the new hq_sess cookie
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-8 relative overflow-hidden">
      {/* Grid watermark */}
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="relative">
          <div className="hud-panel absolute inset-0" />
          <div className="hud-border" />
          <div className="hud-notch-line" />
          <div className="relative z-10 p-10">
            <div className="mb-8">
              <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mb-2">
                Cervos
              </p>
              <h1 className="font-headline-lg text-headline-lg text-ink-deep">{t("hqnet.console")}</h1>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                Restricted access. Sign in with your HQ admin credentials.
              </p>
            </div>
            <form onSubmit={handleAuth} className="flex flex-col gap-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="HQ email"
                autoComplete="username"
                required
                autoFocus
                className="w-full h-12 px-4 bg-surface-base/60 border border-ink-deep/20 text-body-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                required
                className="w-full h-12 px-4 bg-surface-base/60 border border-ink-deep/20 text-body-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-ink-deep text-white font-label-md font-bold hover:opacity-90 active:scale-[0.98] transition-all gaming-snap flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Authenticate
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
