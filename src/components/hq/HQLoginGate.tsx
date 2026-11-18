"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconLock, IconShield } from "@/components/LandingIcons";
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
      setErrorMsg("Network fault during operator clearance.");
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
        setErrorMsg(out.error || "Worker onboarding failed.");
        return;
      }
      router.refresh();
    } catch {
      setErrorMsg("Network fault completing HQ worker onboarding.");
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
      setErrorMsg("Network fault during clearance handshake.");
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
        setErrorMsg("Sandbox clearance could not be initialized.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 py-8 ${t.canvasCls}`}>
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Wing: Sovereign Cervos Brand & Command Showcase */}
        <div className={`lg:col-span-5 p-6 sm:p-7 flex flex-col justify-between gap-6 ${t.panelCls}`}>
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl p-1.5 flex items-center justify-center ${t.pillCls}`}>
                  <img
                    src={
                      isDark
                        ? CERVOS_HQ_ASSETS.companyLogoCircularDark
                        : CERVOS_HQ_ASSETS.companyLogoCircular
                    }
                    alt="Cervos Pharma Emblem"
                    className="w-full h-full object-contain rounded-xl"
                  />
                </div>
                <div>
                  <img
                    src={CERVOS_HQ_ASSETS.companyLogoTransparent}
                    alt="Cervos Pharma"
                    className={`h-5 w-auto object-contain ${isDark ? "brightness-0 invert" : ""}`}
                  />
                  <div className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${t.mutedCls}`}>
                    Sovereign Operations Terminal
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

            {/* Tactile Visual Asset Showcase Frame */}
            <div className={`p-2.5 ${t.wellCls}`}>
              <div className="relative rounded-2xl overflow-hidden aspect-[16/10]">
                <img
                  src={CERVOS_HQ_ASSETS.hardwareDesktop}
                  alt="Cervos Command Terminal Desktop View"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent flex items-end p-4">
                  <div className="text-white space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider">
                      <IconShield className="w-3 h-3 text-sky-300" />
                      Multi-Operator HQ Clearance
                    </div>
                    <p className="text-xs text-slate-200 leading-snug">
                      Live East Africa fleet telemetry, Kasri escrow governance, Support Desk, and Dispatch editorial in one isolated gate.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-2.5">
                {[
                  { src: CERVOS_HQ_ASSETS.peopleCounter, label: "Dispensary" },
                  { src: CERVOS_HQ_ASSETS.peopleStockroom, label: "FEFO Audits" },
                  { src: CERVOS_HQ_ASSETS.fleetVan, label: "Corridors" },
                ].map((thumb) => (
                  <div key={thumb.label} className="relative rounded-xl overflow-hidden aspect-[4/3]">
                    <img
                      src={thumb.src}
                      alt={thumb.label}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-slate-950/70 px-2 py-1 text-[10px] font-semibold text-white">
                      {thumb.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={`p-4 space-y-2 ${t.wellCls}`}>
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span>Role-Scoped Sessions</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 font-mono text-[10px]">
                GATE VERIFIED
              </span>
            </div>
            <p className={`text-[11px] leading-relaxed ${t.mutedCls}`}>
              Invited HQ workers activate via single-use Master code, set a personal passphrase &amp; security PIN, and enter their role-scoped desk directly.
            </p>
          </div>
        </div>

        {/* Right Wing: Claymorphic Clearance Dock */}
        <div className={`lg:col-span-7 p-6 sm:p-8 flex flex-col justify-center space-y-5 ${t.panelCls}`}>
          <div className="space-y-1.5">
            <h1
              className="text-2xl sm:text-3xl font-semibold tracking-tight"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              HQ Operations Clearance
            </h1>
            <p className={`text-xs leading-relaxed ${t.mutedCls}`}>
              Choose your clearance lane. Strict HMAC session isolation with zero overlap into tenant pharmacy cookies.
            </p>
          </div>

          {!secretConfigured && !mockMode && (
            <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
              Server notice: <span className="font-mono font-semibold">HQ_SECRET</span> is missing or below 32 characters.
            </div>
          )}

          {errorMsg && (
            <div className="rounded-2xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-xs font-medium text-red-600 dark:text-red-300">
              {errorMsg}
            </div>
          )}

          {/* Soft Neumorphic Well Segmented Lane Switcher */}
          <div className={`grid grid-cols-3 gap-1.5 p-1.5 text-xs font-semibold ${t.wellCls}`}>
            {[
              { id: "credentials", label: "Worker Sign In" },
              { id: "claim", label: "Claim Invite" },
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
                  className={`py-2.5 px-2 rounded-xl transition-all cursor-pointer ${
                    active ? t.primaryBtnCls : `${t.mutedCls} hover:text-current`
                  }`}
                >
                  {lane.label}
                </button>
              );
            })}
          </div>

          {authTab === "credentials" && (
            <form onSubmit={handleCredentialsAuth} className="space-y-4">
              <div className="space-y-1.5">
                <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.mutedCls}`}>
                  HQ Work Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="amina.ops@cervos.online"
                  required
                  autoFocus
                  className={`w-full h-11 px-4 rounded-2xl text-sm ${t.inputCls}`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.mutedCls}`}>
                    Personal Passphrase
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter operator password"
                    required
                    className={`w-full h-11 px-4 rounded-2xl text-sm font-mono ${t.inputCls}`}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.mutedCls}`}>
                    Personal Security PIN
                  </label>
                  <input
                    type="password"
                    value={workerPin}
                    onChange={(e) => setWorkerPin(e.target.value)}
                    placeholder="4-6 digit PIN"
                    maxLength={6}
                    className={`w-full h-11 px-4 rounded-2xl text-sm font-mono ${t.inputCls}`}
                  />
                </div>
              </div>

              {challengeRequired && (
                <div className="space-y-1.5">
                  <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.mutedCls}`}>
                    Hardware Gate Verification Code
                  </label>
                  <input
                    type="password"
                    value={challengePin}
                    onChange={(e) => setChallengePin(e.target.value)}
                    placeholder="Enter secondary operator code"
                    required
                    className={`w-full h-11 px-4 rounded-2xl text-sm font-mono ${t.inputCls}`}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className={`w-full h-12 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer ${t.primaryBtnCls}`}
              >
                {busy ? (
                  <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <IconLock className="w-4 h-4" />
                )}
                <span>{busy ? "Verifying Worker Clearance..." : "Enter HQ Desk"}</span>
              </button>
            </form>
          )}

          {authTab === "claim" && (
            <form onSubmit={handleClaimInvite} className="space-y-4">
              <div className={`p-3.5 text-xs ${t.wellCls}`}>
                Invited by HQ Master? Enter your work email and one-time <span className="font-mono font-semibold">CVHQ-...</span> onboarding code to create your personal password &amp; PIN.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.mutedCls}`}>
                    Invited Work Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="worker@cervos.online"
                    required
                    className={`w-full h-11 px-4 rounded-2xl text-sm ${t.inputCls}`}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.mutedCls}`}>
                    Master Invite Code
                  </label>
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="CVHQ-XXXXXX-XXXX"
                    required
                    className={`w-full h-11 px-4 rounded-2xl text-sm font-mono uppercase ${t.inputCls}`}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.mutedCls}`}>
                    Set Permanent Password (8+ chars)
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Choose strong password"
                    required
                    minLength={8}
                    className={`w-full h-11 px-4 rounded-2xl text-sm font-mono ${t.inputCls}`}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.mutedCls}`}>
                    Set 4-6 Digit Security PIN
                  </label>
                  <input
                    type="password"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    placeholder="e.g. 4829"
                    required
                    minLength={4}
                    maxLength={6}
                    className={`w-full h-11 px-4 rounded-2xl text-sm font-mono ${t.inputCls}`}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={busy}
                className={`w-full h-12 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer ${t.primaryBtnCls}`}
              >
                {busy && (
                  <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                )}
                <span>{busy ? "Activating HQ Worker..." : "Activate Worker & Enter HQ"}</span>
              </button>
            </form>
          )}

          {authTab === "secret" && (
            <form onSubmit={handleSecretAuth} className="space-y-4">
              <div className="space-y-1.5">
                <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.mutedCls}`}>
                  Master Callsign
                </label>
                <input
                  type="text"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  placeholder="HQ Master Desk"
                  maxLength={80}
                  className={`w-full h-11 px-4 rounded-2xl text-sm ${t.inputCls}`}
                />
              </div>

              <div className="space-y-1.5">
                <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.mutedCls}`}>
                  Master Clearance Key (HQ_SECRET)
                </label>
                <input
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="Enter root clearance key (32+ chars)"
                  required={!mockMode}
                  autoFocus
                  className={`w-full h-11 px-4 rounded-2xl text-sm font-mono ${t.inputCls}`}
                />
              </div>

              {challengeRequired && (
                <div className="space-y-1.5">
                  <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.mutedCls}`}>
                    Secondary Verification Code
                  </label>
                  <input
                    type="password"
                    value={challengePin}
                    onChange={(e) => setChallengePin(e.target.value)}
                    placeholder="Enter operator verification code"
                    required
                    className={`w-full h-11 px-4 rounded-2xl text-sm font-mono ${t.inputCls}`}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className={`w-full h-12 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer ${t.primaryBtnCls}`}
              >
                {busy ? (
                  <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <IconLock className="w-4 h-4" />
                )}
                <span>{busy ? "Verifying Master Key..." : "Authenticate as HQ Master"}</span>
              </button>
            </form>
          )}

          {mockMode && (
            <div className="pt-3 border-t border-slate-500/15">
              <button
                type="button"
                onClick={handleDemoEnter}
                disabled={busy}
                className="w-full h-11 rounded-2xl border border-emerald-500/40 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-500/20 inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {busy && (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                )}
                <span>Initialize HQ Master Sandbox (Mock Active)</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
