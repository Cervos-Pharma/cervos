"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { IconLock, IconShield } from "@/components/LandingIcons";
import { useWorkspaceTheme } from "@/lib/workspace/theme";

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
  const { isDark } = useWorkspaceTheme();

  const [authTab, setAuthTab] = useState<"credentials" | "secret">("credentials");
  const [operatorName, setOperatorName] = useState("Ops Unit 01");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secret, setSecret] = useState("");
  const [challengePin, setChallengePin] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cardCls = isDark
    ? "bg-[#11161F] border-slate-800 text-slate-100"
    : "bg-white border-[#EAECF0] text-[#111317]";
  const inputCls = isDark
    ? "bg-[#090C12] border-slate-700 text-slate-100 placeholder:text-slate-500"
    : "bg-[#F8FAFC] border-[#CBD5E1] text-[#111317] placeholder:text-slate-400";
  const mutedCls = isDark ? "text-slate-400" : "text-[#64748B]";

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
          operatorName: operatorName.trim() || "Ops Clearance Unit",
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
          operatorName: operatorName.trim() || "Ops Sandbox Desk",
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
    <div
      className={`min-h-screen flex items-center justify-center px-4 py-10 ${
        isDark ? "bg-[#090C12] text-slate-100" : "bg-[#F8FAFC] text-[#111317]"
      }`}
    >
      <div className={`w-full max-w-md rounded-[24px] border p-7 shadow-sm space-y-6 ${cardCls}`}>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 text-[#1039B9] dark:text-[#38BDF8] text-[10px] font-bold uppercase tracking-widest">
              <IconShield className="w-3.5 h-3.5" />
              CV-OPS Node v9
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 text-[10px] font-mono font-bold">
              GATE OK
            </span>
          </div>
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ fontFamily: "Outfit, Inter, sans-serif" }}
          >
            Operations Clearance
          </h1>
          <p className={`text-xs leading-relaxed ${mutedCls}`}>
            Isolated command session. Separate credentials and dedicated cookie jar with zero tenant workspace overlap.
          </p>
        </div>

        {!secretConfigured && !mockMode && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-700 dark:text-amber-300">
            Server notice: <span className="font-mono font-semibold">HQ_SECRET</span> is missing or below 32 characters.
          </div>
        )}

        {errorMsg && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs font-medium text-red-600 dark:text-red-300">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-500/10 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setAuthTab("credentials");
              setErrorMsg(null);
            }}
            className={`py-2 rounded-lg transition-colors cursor-pointer ${
              authTab === "credentials" ? "bg-[#1039B9] text-white shadow-xs" : `${mutedCls} hover:text-current`
            }`}
          >
            Operator Account
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthTab("secret");
              setErrorMsg(null);
            }}
            className={`py-2 rounded-lg transition-colors cursor-pointer ${
              authTab === "secret" ? "bg-[#1039B9] text-white shadow-xs" : `${mutedCls} hover:text-current`
            }`}
          >
            Clearance Key
          </button>
        </div>

        {authTab === "credentials" ? (
          <form onSubmit={handleCredentialsAuth} className="space-y-3.5">
            <div className="space-y-1">
              <label className={`block text-[10px] font-bold uppercase tracking-wider ${mutedCls}`}>
                Ops Operator Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@domain"
                required
                autoFocus
                className={`w-full h-11 px-3.5 rounded-xl border text-sm focus:outline-none focus:border-[#1039B9] ${inputCls}`}
              />
            </div>

            <div className="space-y-1">
              <label className={`block text-[10px] font-bold uppercase tracking-wider ${mutedCls}`}>
                Passphrase
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter operator password"
                required
                className={`w-full h-11 px-3.5 rounded-xl border text-sm font-mono focus:outline-none focus:border-[#1039B9] ${inputCls}`}
              />
            </div>

            {challengeRequired && (
              <div className="space-y-1">
                <label className={`block text-[10px] font-bold uppercase tracking-wider ${mutedCls}`}>
                  Secondary Verification Code
                </label>
                <input
                  type="password"
                  value={challengePin}
                  onChange={(e) => setChallengePin(e.target.value)}
                  placeholder="Enter operator verification code"
                  required
                  className={`w-full h-11 px-3.5 rounded-xl border text-sm font-mono focus:outline-none focus:border-[#1039B9] ${inputCls}`}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full h-11 rounded-xl bg-[#1039B9] hover:bg-[#0d2e94] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              <IconLock className="w-4 h-4" />
              <span>{busy ? "Verifying Clearance..." : "Enter Operations Console"}</span>
            </button>
          </form>
        ) : (
        <form onSubmit={handleSecretAuth} className="space-y-3.5">
          <div className="space-y-1">
            <label className={`block text-[10px] font-bold uppercase tracking-wider ${mutedCls}`}>
              Operator Callsign
            </label>
            <input
              type="text"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              placeholder="Ops Unit 01"
              maxLength={80}
              className={`w-full h-11 px-3.5 rounded-xl border text-sm focus:outline-none focus:border-[#1039B9] ${inputCls}`}
            />
          </div>

          <div className="space-y-1">
            <label className={`block text-[10px] font-bold uppercase tracking-wider ${mutedCls}`}>
              Clearance Passphrase
            </label>
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Enter clearance key (32+ chars)"
              required={!mockMode}
              autoFocus
              className={`w-full h-11 px-3.5 rounded-xl border text-sm font-mono focus:outline-none focus:border-[#1039B9] ${inputCls}`}
            />
          </div>

          {challengeRequired && (
            <div className="space-y-1">
              <label className={`block text-[10px] font-bold uppercase tracking-wider ${mutedCls}`}>
                Secondary Verification Code
              </label>
              <input
                type="password"
                value={challengePin}
                onChange={(e) => setChallengePin(e.target.value)}
                placeholder="Enter operator verification code"
                required
                className={`w-full h-11 px-3.5 rounded-xl border text-sm font-mono focus:outline-none focus:border-[#1039B9] ${inputCls}`}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full h-11 rounded-xl bg-[#1039B9] hover:bg-[#0d2e94] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            <IconLock className="w-4 h-4" />
            <span>{busy ? "Verifying Clearance..." : "Enter Operations Console"}</span>
          </button>
        </form>
        )}

        {mockMode && (
          <div className="pt-3 border-t border-slate-500/15 space-y-2">
            <button
              type="button"
              onClick={handleDemoEnter}
              disabled={busy}
              className="w-full h-10 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-500/15 transition-colors cursor-pointer"
            >
              Initialize Sandbox Clearance (Mock Active)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
