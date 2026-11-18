"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconLock } from "@/components/LandingIcons";
import { CERVOS_HQ_ASSETS, hqSurfaceTokens } from "./hqSurface";

interface HQLoginGateProps {
  gateSlug: string;
  mockMode: boolean;
  secretConfigured: boolean;
  challengeRequired?: boolean;
}

export default function HQLoginGate({
  gateSlug,
  mockMode,
  secretConfigured,
  challengeRequired = false,
}: HQLoginGateProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isDark, setIsDark] = useState(false);

  const [authTab, setAuthTab] = useState<"credentials" | "claim" | "secret">("credentials");
  const [operatorName, setOperatorName] = useState("HQ Master Desk");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workerPin, setWorkerPin] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [secret, setSecret] = useState("");
  const [challengePin, setChallengePin] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("cv-ops-theme");
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    setIsDark(saved ? saved === "dark" : prefersDark);

    const inviteParam = searchParams.get("invite")?.trim();
    const emailParam = searchParams.get("email")?.trim();
    if (inviteParam) {
      setAuthTab("claim");
      setInviteCode(inviteParam);
    }
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      window.localStorage.setItem("cv-ops-theme", next ? "dark" : "light");
      return next;
    });
  };

  const t = hqSurfaceTokens(isDark);

  const handleCredentialsAuth = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/ops-v9k4m/session", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Ops-Gate": gateSlug },
        body: JSON.stringify({
          action: "login_credentials",
          gateSlug,
          email: email.trim(),
          password,
          workerPin: workerPin.trim() || undefined,
          challengePin: challengePin.trim() || undefined,
        }),
      });
      const out = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !out.ok) {
        setErrorMsg(out.error || "Operator clearance failed.");
        return;
      }
      router.refresh();
    } catch {
      setErrorMsg("Network fault during operator sign-in.");
    } finally {
      setBusy(false);
    }
  };

  const handleClaimInvite = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/ops-v9k4m/session", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Ops-Gate": gateSlug },
        body: JSON.stringify({
          action: "claim_worker_invite",
          gateSlug,
          email: email.trim(),
          inviteCode: inviteCode.trim(),
          password,
          pin: confirmPin.trim(),
        }),
      });
      const out = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !out.ok) {
        setErrorMsg(out.error || "Invite activation failed.");
        return;
      }
      router.refresh();
    } catch {
      setErrorMsg("Network fault completing operator activation.");
    } finally {
      setBusy(false);
    }
  };

  const handleSecretAuth = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/ops-v9k4m/session", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Ops-Gate": gateSlug },
        body: JSON.stringify({
          action: "login",
          gateSlug,
          secret,
          challengePin: challengePin.trim() || undefined,
          operatorName: operatorName.trim() || "HQ Master Desk",
        }),
      });
      const out = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !out.ok) {
        setErrorMsg(out.error || "Clearance verification failed.");
        return;
      }
      router.refresh();
    } catch {
      setErrorMsg("Network fault verifying clearance key.");
    } finally {
      setBusy(false);
    }
  };

  const handleDemoEnter = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/ops-v9k4m/session", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Ops-Gate": gateSlug },
        body: JSON.stringify({
          action: "demo_enter",
          gateSlug,
          operatorName: operatorName.trim() || "HQ Master Sandbox",
        }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        setErrorMsg("Sandbox session could not be initialized.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 py-10 ${t.canvasCls}`}>
      <div className={`w-full max-w-[460px] p-6 sm:p-8 space-y-6 ${t.panelCls}`}>
        {/* Grounded Internal Brand Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl p-1.5 flex items-center justify-center ${t.pillCls}`}>
              <img
                src={
                  isDark
                    ? CERVOS_HQ_ASSETS.companyLogoCircularDark
                    : CERVOS_HQ_ASSETS.companyLogoCircular
                }
                alt="Cervos HQ"
                className="w-full h-full object-contain rounded-lg"
              />
            </div>
            <div>
              <img
                src={CERVOS_HQ_ASSETS.companyLogoTransparent}
                alt="Cervos"
                className={`h-4 w-auto object-contain ${isDark ? "brightness-0 invert" : ""}`}
              />
              <div className={`text-[10px] font-mono uppercase tracking-wider mt-0.5 ${t.mutedCls}`}>
                HQ Gate &middot; Isolated Session
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer ${t.pillCls}`}
          >
            {isDark ? "Light" : "Dark"}
          </button>
        </div>

        <div className="space-y-1">
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ fontFamily: "Outfit, Inter, sans-serif" }}
          >
            Operations Access
          </h1>
          <p className={`text-xs leading-relaxed ${t.mutedCls}`}>
            Internal command sign-in for HQ specialists and Master clearance.
          </p>
        </div>

        {!secretConfigured && !mockMode && (
          <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-300">
            Notice: <span className="font-mono font-semibold">HQ_SECRET</span> is missing or under 32 characters.
          </div>
        )}

        {errorMsg && (
          <div className="rounded-2xl border border-rose-500/35 bg-rose-500/10 px-4 py-2.5 text-xs font-medium text-rose-600 dark:text-rose-300">
            {errorMsg}
          </div>
        )}

        {/* Neumorphic Lane Switcher */}
        <div className={`grid grid-cols-3 gap-1.5 p-1.5 text-xs font-semibold ${t.wellCls}`}>
          {[
            { id: "credentials", label: "Operator" },
            { id: "claim", label: "Activate Invite" },
            { id: "secret", label: "Master Key" },
          ].map((lane) => {
            const active = authTab === lane.id;
            return (
              <button
                key={lane.id}
                type="button"
                onClick={() => {
                  setAuthTab(lane.id as "credentials" | "claim" | "secret");
                  setErrorMsg(null);
                }}
                className={`py-2 px-2 rounded-xl transition-all cursor-pointer ${
                  active ? t.primaryBtnCls : `${t.mutedCls} hover:text-current`
                }`}
              >
                {lane.label}
              </button>
            );
          })}
        </div>

        {authTab === "credentials" && (
          <form onSubmit={handleCredentialsAuth} className="space-y-3.5">
            <div className="space-y-1">
              <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.mutedCls}`}>
                Operator Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@cervos.online"
                required
                autoFocus
                className={`w-full h-11 px-3.5 rounded-2xl text-sm ${t.inputCls}`}
              />
            </div>

            <div className="space-y-1">
              <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.mutedCls}`}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                className={`w-full h-11 px-3.5 rounded-2xl text-sm font-mono ${t.inputCls}`}
              />
            </div>

            <div className="space-y-1">
              <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.mutedCls}`}>
                Personal PIN (Invited Staff)
              </label>
              <input
                type="password"
                value={workerPin}
                onChange={(e) => setWorkerPin(e.target.value)}
                placeholder="4-6 digit PIN if assigned"
                maxLength={6}
                className={`w-full h-11 px-3.5 rounded-2xl text-sm font-mono ${t.inputCls}`}
              />
            </div>

            {challengeRequired && (
              <div className="space-y-1">
                <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.mutedCls}`}>
                  Gate Pin
                </label>
                <input
                  type="password"
                  value={challengePin}
                  onChange={(e) => setChallengePin(e.target.value)}
                  placeholder="Secondary verification code"
                  required
                  className={`w-full h-11 px-3.5 rounded-2xl text-sm font-mono ${t.inputCls}`}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className={`w-full h-11 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer ${t.primaryBtnCls}`}
            >
              {busy ? (
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <IconLock className="w-4 h-4" />
              )}
              <span>{busy ? "Signing In..." : "Sign In"}</span>
            </button>
          </form>
        )}

        {authTab === "claim" && (
          <form onSubmit={handleClaimInvite} className="space-y-3.5">
            <div className="space-y-1">
              <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.mutedCls}`}>
                Work Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="worker@cervos.online"
                required
                className={`w-full h-11 px-3.5 rounded-2xl text-sm ${t.inputCls}`}
              />
            </div>
            <div className="space-y-1">
              <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.mutedCls}`}>
                Invite Code
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="CVHQ-XXXXXX-XXXX"
                required
                className={`w-full h-11 px-3.5 rounded-2xl text-sm font-mono uppercase ${t.inputCls}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.mutedCls}`}>
                  New Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8+ chars"
                  required
                  minLength={8}
                  className={`w-full h-11 px-3.5 rounded-2xl text-sm font-mono ${t.inputCls}`}
                />
              </div>
              <div className="space-y-1">
                <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.mutedCls}`}>
                  Set PIN
                </label>
                <input
                  type="password"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  placeholder="4-6 digits"
                  required
                  minLength={4}
                  maxLength={6}
                  className={`w-full h-11 px-3.5 rounded-2xl text-sm font-mono ${t.inputCls}`}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={busy}
              className={`w-full h-11 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer ${t.primaryBtnCls}`}
            >
              {busy && (
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              )}
              <span>{busy ? "Activating..." : "Activate Account"}</span>
            </button>
          </form>
        )}

        {authTab === "secret" && (
          <form onSubmit={handleSecretAuth} className="space-y-3.5">
            <div className="space-y-1">
              <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.mutedCls}`}>
                Operator Label
              </label>
              <input
                type="text"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                placeholder="HQ Master Desk"
                maxLength={80}
                className={`w-full h-11 px-3.5 rounded-2xl text-sm ${t.inputCls}`}
              />
            </div>

            <div className="space-y-1">
              <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.mutedCls}`}>
                Master Key (HQ_SECRET)
              </label>
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Enter 32+ character key"
                required={!mockMode}
                autoFocus
                className={`w-full h-11 px-3.5 rounded-2xl text-sm font-mono ${t.inputCls}`}
              />
            </div>

            {challengeRequired && (
              <div className="space-y-1">
                <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.mutedCls}`}>
                  Gate Pin
                </label>
                <input
                  type="password"
                  value={challengePin}
                  onChange={(e) => setChallengePin(e.target.value)}
                  placeholder="Secondary verification code"
                  required
                  className={`w-full h-11 px-3.5 rounded-2xl text-sm font-mono ${t.inputCls}`}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className={`w-full h-11 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer ${t.primaryBtnCls}`}
            >
              {busy ? (
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <IconLock className="w-4 h-4" />
              )}
              <span>{busy ? "Verifying..." : "Verify Master Key"}</span>
            </button>
          </form>
        )}

        {mockMode && (
          <div className="pt-2 border-t border-slate-500/15">
            <button
              type="button"
              onClick={handleDemoEnter}
              disabled={busy}
              className="w-full h-10 rounded-2xl border border-emerald-500/40 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-500/20 inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              {busy && (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
              )}
              <span>Enter Sandbox (Mock Active)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
