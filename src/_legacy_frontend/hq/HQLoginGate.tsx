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
    <div className="min-h-screen bg-surface flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-md bg-surface-base border border-outline-variant rounded-2xl p-8 shadow-sm">
        <div className="mb-7">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-surface-container-low border border-outline-variant text-[11px] font-mono uppercase tracking-wider text-on-surface-variant mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span>Cervos Internal</span>
          </div>
          <h1 className="font-headline-lg text-2xl font-bold text-ink-deep">{t("hqnet.console")}</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Restricted access. Sign in with your HQ admin credentials.
          </p>
        </div>

        <form onSubmit={handleAuth} className="flex flex-col gap-3.5">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="HQ email"
            autoComplete="username"
            required
            autoFocus
            className="w-full h-11 px-3.5 rounded-lg bg-surface border border-outline-variant text-sm text-ink-deep focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-colors"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            required
            className="w-full h-11 px-3.5 rounded-lg bg-surface border border-outline-variant text-sm text-ink-deep focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-colors font-mono"
          />
          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full h-11 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-variant transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Authenticate</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </>
            )}
          </button>
        </form>
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
