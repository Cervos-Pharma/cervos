"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import ClaymorphicStageBackdrop from "@/components/ClaymorphicStageBackdrop";
import { authenticateWithPasskey, isPasskeySupported } from "@/lib/security/client-passkey";
import { useWorkspaceTheme } from "@/lib/workspace/theme";
import { useI18n } from "@/lib/i18n/context";

interface GateStateResponse {
  authenticated: boolean;
  browserTrusted: boolean;
  account: {
    id: string;
    email: string;
    fullName: string;
    orgName: string;
    lang: "EN" | "SW";
    securityQuestion: string;
    requireSecurityEveryTime: boolean;
    onboardingDone: boolean;
  };
  centres: Array<{ id: string; name: string; region: string; address: string; isPrimary: boolean }>;
  profiles: Array<{ id: string; centreId: string; displayName: string; role: string }>;
  passkeys: Array<{ credentialId: string; profileId?: string; label: string }>;
}

function GateInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedStage = searchParams.get("stage");
  const { lang: i18nLang, setLang: setI18nLang } = useI18n();
  const { isDark, toggleTheme } = useWorkspaceTheme();

  const [state, setState] = useState<GateStateResponse | null>(null);
  const [stage, setStage] = useState<"security" | "centre" | "profile">("security");
  const [isFading, setIsFading] = useState(false);
  const [langOverride, setLangOverride] = useState<"EN" | "SW" | null>(i18nLang === "SW" ? "SW" : null);

  const [answer, setAnswer] = useState("");
  const [rememberBrowser, setRememberBrowser] = useState(true);
  const [selectedCentreId, setSelectedCentreId] = useState<string>("");
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [canPasskey, setCanPasskey] = useState(false);

  const switchStage = (next: "security" | "centre" | "profile") => {
    setIsFading(true);
    setTimeout(() => {
      setStage(next);
      setIsFading(false);
    }, 200);
  };

  useEffect(() => {
    setCanPasskey(isPasskeySupported());
    fetch("/api/workspace/state")
      .then(async (r) => {
        if (r.status === 401) {
          router.replace("/auth?mode=signin");
          return null;
        }
        return r.json();
      })
      .then((data: GateStateResponse | null) => {
        if (!data?.authenticated) return;
        if (!data.account.onboardingDone) {
          router.replace("/app/onboarding");
          return;
        }
        setState(data);
        setLangOverride(data.account.lang);
        setI18nLang(data.account.lang);
        const firstCentre = data.centres[0]?.id || "";
        setSelectedCentreId(firstCentre);

        const matchingProfiles = data.profiles.filter((p) => p.centreId === firstCentre);
        setSelectedProfileId(matchingProfiles[0]?.id || data.profiles[0]?.id || "");

        const skipSecurity =
          (!data.account.requireSecurityEveryTime || data.browserTrusted) && requestedStage !== "security";
        if (!skipSecurity) {
          setStage("security");
        } else if (data.centres.length > 1 && requestedStage !== "profile") {
          setStage("centre");
        } else {
          setStage("profile");
        }
      })
      .catch(() => setErrorMsg("Unable to load security gate."));
  }, [router, requestedStage]);

  const markJustLoggedIn = () => {
    try {
      window.sessionStorage.setItem("cervos-just-logged-in", "1");
    } catch {
      // Ignore storage block
    }
  };

  const verifySecurity = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/workspace/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_security",
          answer,
          rememberBrowser,
          directUnlock: true,
        }),
      });
      const out = (await res.json()) as { ok?: boolean; redirectTo?: string; error?: string };
      if (!res.ok || !out.ok) {
        setErrorMsg(out.error || "Incorrect security answer.");
        return;
      }
      if (out.redirectTo) {
        markJustLoggedIn();
        router.push(out.redirectTo);
        return;
      }
      if (state && state.centres.length > 1) {
        switchStage("centre");
      } else {
        switchStage("profile");
      }
    } catch {
      setErrorMsg("Network error.");
    } finally {
      setBusy(false);
    }
  };

  const chooseCentre = (centreId: string) => {
    setSelectedCentreId(centreId);
    const matches = state?.profiles.filter((p) => p.centreId === centreId) ?? [];
    setSelectedProfileId(matches[0]?.id || state?.profiles[0]?.id || "");
    setPin("");
    setErrorMsg(null);
    switchStage("profile");
  };

  const unlockWithPin = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/workspace/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unlock_profile",
          centreId: selectedCentreId,
          profileId: selectedProfileId,
          pin,
        }),
      });
      const out = (await res.json()) as { ok?: boolean; redirectTo?: string; error?: string };
      if (!res.ok || !out.ok) {
        setErrorMsg(out.error || "Incorrect PIN.");
        setPin("");
        return;
      }
      markJustLoggedIn();
      router.push(out.redirectTo || "/app");
    } catch {
      setErrorMsg("Network error.");
    } finally {
      setBusy(false);
    }
  };

  const unlockWithPasskey = async () => {
    setErrorMsg(null);
    setBusy(true);
    const res = await authenticateWithPasskey({
      purpose: "unlock",
      profileId: selectedProfileId,
    });
    setBusy(false);
    if (!res.ok) {
      setErrorMsg(res.error || "Biometric unlock could not verify.");
      return;
    }
    markJustLoggedIn();
    router.push(res.redirectTo || "/app");
  };

  const signOutAccount = async () => {
    await fetch("/api/workspace/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "signout" }),
    });
    router.push("/auth?mode=signin");
  };

  const activeLang = langOverride ?? state?.account.lang ?? "EN";
  const isSw = activeLang === "SW";

  if (!state) {
    return (
      <div
        className={`relative min-h-screen flex items-center justify-center p-6 transition-colors ${isDark ? "bg-[#0B0F17] text-slate-300" : "bg-[#F8FAFC] text-[#0F172A]"
          }`}
      >
        <ClaymorphicStageBackdrop isDark={isDark} />
        <div className="relative z-10 text-center space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#1039B9]/25 border-t-[#1039B9] animate-spin mx-auto" />
          <p className="text-xs font-medium text-slate-500">Verifying access gate...</p>
        </div>
      </div>
    );
  }

  const centreProfiles = state.profiles.filter((p) => p.centreId === selectedCentreId);
  const activeCentre = state.centres.find((c) => c.id === selectedCentreId) ?? state.centres[0];

  const surfaceCls = isDark
    ? "bg-[#11161F]/92 border-slate-800 text-slate-100 shadow-2xl"
    : "bg-white/95 border-[#E2E8F0] text-[#0F172A] shadow-xl shadow-slate-900/5";

  const controlBtnCls = isDark
    ? "border-slate-800 bg-[#11161F]/90 text-slate-200 hover:border-slate-700"
    : "border-[#E2E8F0] bg-white/95 text-[#0F172A] hover:bg-slate-50 shadow-2xs";

  const inputCls = isDark
    ? "border-slate-700 bg-slate-900/90 text-white placeholder:text-slate-500 focus:border-[#38BDF8]"
    : "border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] focus:border-[#1039B9] focus:bg-white";

  return (
    <div
      className={`relative min-h-screen flex flex-col justify-between p-4 sm:p-8 transition-colors duration-300 ${isDark ? "bg-[#0B0F17] text-slate-100" : "bg-[#F8FAFC] text-[#0F172A]"
        }`}
    >
      <ClaymorphicStageBackdrop isDark={isDark} />

      {/* Minimal Floating Corner Controls */}
      <div className="relative z-10 max-w-5xl w-full mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-8 h-8 rounded-full overflow-hidden bg-white ring-1 ring-slate-200 shrink-0">
            <Image
              src="/cervos-company-logo-circular.svg"
              alt="Cervos Pharma"
              fill
              className="object-contain p-0.5"
            />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold truncate">{state.account.orgName}</div>
            <div className={`text-[11px] truncate ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {state.account.email}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              const next = isSw ? "EN" : "SW";
              setLangOverride(next);
              setI18nLang(next);
            }}
            className={`min-h-[44px] min-w-[44px] px-3 py-2 rounded-md border text-xs sm:text-[11px] font-bold transition-colors cursor-pointer ${controlBtnCls}`}
          >
            {activeLang}
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Light mode" : "Dark mode"}
            className={`min-h-[44px] min-w-[44px] w-11 h-11 sm:w-10 sm:h-10 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${controlBtnCls}`}
          >
            {isDark ? (
              <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
                />
              </svg>
            ) : (
              <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"
                />
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={signOutAccount}
            className={`min-h-[44px] px-3.5 py-2 rounded-md border text-xs sm:text-[11px] font-semibold transition-colors cursor-pointer ${controlBtnCls}`}
          >
            {isSw ? "Ondoka" : "Sign Out"}
          </button>
        </div>
      </div>

      {/* Crisp Architectural Gate Card (Less Rounded, Focused) */}
      <div
        className={`relative z-10 max-w-md w-full mx-auto my-6 sm:my-8 rounded-lg border backdrop-blur-md p-5 sm:p-8 space-y-5 transition-all duration-200 ${surfaceCls} ${isFading ? "opacity-0 translate-y-1.5" : "opacity-100 translate-y-0"
          }`}
      >
        {errorMsg && (
          <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/30 text-xs text-rose-500 font-medium">
            {errorMsg}
          </div>
        )}

        {stage === "security" && (
          <form onSubmit={verifySecurity} className="space-y-5">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1039B9] mb-1">
                {isSw ? "HATUA YA USALAMA" : "BROWSER SECURITY CHECK"}
              </div>
              <h1
                className="text-xl font-bold leading-snug"
                style={{ fontFamily: "Outfit, Inter, sans-serif" }}
              >
                {state.account.securityQuestion}
              </h1>
            </div>

            <input
              type="text"
              required
              autoFocus
              value={answer}
              onChange={(e) => {
                setAnswer(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder={isSw ? "Jibu lako la usalama" : "Enter security answer"}
              className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-md border text-sm focus:outline-none transition-colors ${inputCls}`}
            />

            {!state.account.requireSecurityEveryTime && (
              <label className={`min-h-[44px] flex items-center gap-2.5 text-xs cursor-pointer ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                <input
                  type="checkbox"
                  checked={rememberBrowser}
                  onChange={(e) => setRememberBrowser(e.target.checked)}
                  className="w-4 h-4 accent-[#1039B9]"
                />
                <span>
                  {isSw
                    ? "Kumbuka kivinjari hiki kwa siku 30"
                    : "Remember this browser for 30 days"}
                </span>
              </label>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-[44px] py-3 rounded-md bg-[#1039B9] hover:bg-[#0D2E94] disabled:opacity-60 text-white text-xs font-semibold cursor-pointer transition-colors"
            >
              {busy ? "..." : isSw ? "Thibitisha & Endelea" : "Verify & Continue"} &rarr;
            </button>
          </form>
        )}

        {stage === "centre" && (
          <div className="space-y-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#006875] mb-1">
                {isSw ? "CHAGUA KITUO" : "SELECT WORKSPACE CENTRE"}
              </div>
              <h1
                className="text-xl font-bold"
                style={{ fontFamily: "Outfit, Inter, sans-serif" }}
              >
                {isSw ? "Unaingia tawi gani leo?" : "Which centre are you signing into?"}
              </h1>
            </div>

            <div className="space-y-2.5">
              {state.centres.map((ctr) => (
                <button
                  key={ctr.id}
                  type="button"
                  onClick={() => chooseCentre(ctr.id)}
                  className={`w-full min-h-[52px] p-3.5 rounded-md border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${isDark
                    ? "border-slate-800 bg-slate-900/70 hover:border-[#38BDF8]"
                    : "border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#1039B9] hover:bg-white"
                    }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold">{ctr.name}</div>
                    <div className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      {ctr.address} &middot; {ctr.region}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-[#1039B9] shrink-0">&rarr;</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {stage === "profile" && (
          <form onSubmit={unlockWithPin} className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1039B9] mb-1">
                  {activeCentre?.name}
                </div>
                <h1
                  className="text-xl font-bold"
                  style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                >
                  {isSw ? "Chagua Wasifu & Weka PIN" : "Select Profile & Enter PIN"}
                </h1>
              </div>
              {state.centres.length > 1 && (
                <button
                  type="button"
                  onClick={() => switchStage("centre")}
                  className="min-h-[44px] px-2.5 py-2 inline-flex items-center text-xs sm:text-[11px] font-semibold text-[#1039B9] hover:underline shrink-0 cursor-pointer"
                >
                  {isSw ? "Badili Tawi" : "Change Centre"}
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {(centreProfiles.length > 0 ? centreProfiles : state.profiles).map((prof) => {
                const selected = selectedProfileId === prof.id;
                return (
                  <button
                    key={prof.id}
                    type="button"
                    onClick={() => {
                      setSelectedProfileId(prof.id);
                      setErrorMsg(null);
                    }}
                    className={`w-full min-h-[48px] p-3.5 rounded-md border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${selected
                      ? isDark
                        ? "border-[#38BDF8] bg-[#1039B9]/20"
                        : "border-[#1039B9] bg-[#EFF6FF]"
                      : isDark
                        ? "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                        : "border-[#E2E8F0] bg-[#F8FAFC] hover:border-slate-300"
                      }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold">{prof.displayName}</div>
                      <div className={`text-[10px] uppercase tracking-wider mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        {prof.role.replace(/_/g, " ")}
                      </div>
                    </div>
                    {selected && <span className="w-2.5 h-2.5 rounded-full bg-[#1039B9] shrink-0" />}
                  </button>
                );
              })}
            </div>

            <div>
              <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {isSw ? "PIN ya Wasifu (Tarakimu 4-6)" : "Profile PIN (4-6 digits)"}
              </label>
              <input
                type="password"
                inputMode="numeric"
                required
                maxLength={6}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, ""));
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="••••"
                className={`w-full min-h-[48px] px-4 py-3 rounded-md border text-center text-lg font-bold tracking-[0.5em] focus:outline-none transition-colors ${inputCls}`}
              />
            </div>

            <button
              type="submit"
              disabled={busy || pin.length < 4}
              className="w-full min-h-[44px] py-3 rounded-md bg-[#1039B9] hover:bg-[#0D2E94] disabled:opacity-55 text-white text-xs font-semibold cursor-pointer transition-colors"
            >
              {busy ? "..." : isSw ? "Fungua Kituo" : "Unlock Workspace"} &rarr;
            </button>

            {canPasskey && state.passkeys.length > 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={unlockWithPasskey}
                className={`w-full min-h-[44px] py-3 rounded-md border text-xs font-semibold cursor-pointer transition-colors ${isDark
                  ? "border-slate-700 hover:border-[#38BDF8] text-[#38BDF8]"
                  : "border-[#E2E8F0] hover:border-[#1039B9] text-[#1039B9]"
                  }`}
              >
                {isSw ? "Fungua kwa Biometria / Passkey" : "Unlock With Biometrics / Passkey"}
              </button>
            )}
          </form>
        )}
      </div>

      <div className="relative z-10 text-center text-[11px] space-y-1">
        {state.account.email === "demo@pharmacy.co.tz" && (
          <div className={isDark ? "text-slate-300" : "text-slate-600"}>
            Preview credentials &middot; Answer: <strong>Kariakoo</strong> &middot; Owner PIN: <strong>8429</strong> &middot; Pharmacist: <strong>5731</strong> &middot; Cashier: <strong>6194</strong>
          </div>
        )}
        <div className={isDark ? "text-slate-500" : "text-slate-400"}>
          Cervos Security Gate &middot; Role-Scoped &amp; Encrypted Session
        </div>
      </div>
    </div>
  );
}

export default function SecurityGatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center text-xs text-slate-500">
          Loading gate...
        </div>
      }
    >
      <GateInner />
    </Suspense>
  );
}
