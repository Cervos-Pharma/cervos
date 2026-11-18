"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import WorkspaceShell, { type WorkspaceNavItem } from "@/components/WorkspaceShell";
import CertificateDropzone from "@/components/CertificateDropzone";
import { evaluatePinStrength } from "@/lib/security/client-validators";
import { enrollPasskeyForAccount, isPasskeySupported } from "@/lib/security/client-passkey";
import { IconCheck, IconLock } from "@/components/LandingIcons";
import { useWorkspaceTheme } from "@/lib/workspace/theme";
import { useI18n } from "@/lib/i18n/context";
import { matchesSearch } from "@/lib/search";

interface SettingsState {
  authenticated: boolean;
  account: {
    id: string;
    email: string;
    fullName: string;
    orgName: string;
    lang: "EN" | "SW";
    verificationStatus: "skipped" | "verified";
    networkUnlocked: boolean;
    requireSecurityEveryTime: boolean;
    securityQuestion: string;
    certificates: Array<{ id: string; docType: string; licenseNumber: string; fileName: string }>;
    customization?: {
      brandLogoUrl?: string;
      brandAccent?: string;
      fontScale?: "compact" | "standard" | "large";
      layoutType?: "balanced" | "focus" | "executive";
      themePref?: "light" | "dark" | "system";
    };
  };
  centres: Array<{ id: string; name: string; region: string; address: string; phone: string }>;
  profiles: Array<{ id: string; centreId: string; displayName: string; role: string; isMasterAdmin: boolean }>;
  passkeys: Array<{ credentialId: string; label: string; createdAt: string }>;
  activeProfile: {
    id: string;
    displayName: string;
    role: string;
    isMasterAdmin: boolean;
    profilePrefs?: {
      fontScale?: "compact" | "standard" | "large";
      themePref?: "light" | "dark" | "system";
      preferredLang?: "EN" | "SW";
    };
  } | null;
}

const BRAND_SWATCHES = [
  { hex: "#1039B9", label: "Royal" },
  { hex: "#059669", label: "Emerald" },
  { hex: "#006875", label: "Teal" },
  { hex: "#C2410C", label: "Amber" },
  { hex: "#475569", label: "Slate" },
];

function WorkspaceSettingsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setLang: setI18nLang } = useI18n();
  const { theme, isDark, setTheme, toggleTheme } = useWorkspaceTheme();

  const initialTab = searchParams.get("tab") === "org" ? "org" : "user";
  const [settingsScope, setSettingsScope] = useState<"user" | "org">(initialTab);
  const [state, setState] = useState<SettingsState | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savingAction, setSavingAction] = useState<string | null>(null);
  const [enrollingPasskey, setEnrollingPasskey] = useState(false);

  // User Personal Profile Form State
  const [myDisplayName, setMyDisplayName] = useState("");
  const [myFontScale, setMyFontScale] = useState<"compact" | "standard" | "large">("standard");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [passkeyLabel, setPasskeyLabel] = useState("My Laptop / Phone Biometrics");
  const [canPasskey, setCanPasskey] = useState(false);

  // Organization Settings State
  const [ctrName, setCtrName] = useState("");
  const [ctrAddress, setCtrAddress] = useState("");
  const [ctrPhone, setCtrPhone] = useState("");

  const [profName, setProfName] = useState("");
  const [profRole, setProfRole] = useState("superintendent_pharmacist");
  const [profCentreId, setProfCentreId] = useState("");
  const [profPin, setProfPin] = useState("");

  const [docType, setDocType] = useState("Pharmacy Operating Permit");
  const [licenseNum, setLicenseNum] = useState("");
  const [certFileName, setCertFileName] = useState("");

  const [brandAccent, setBrandAccent] = useState("#1039B9");
  const [orgFontScale, setOrgFontScale] = useState<"compact" | "standard" | "large">("standard");
  const [layoutType, setLayoutType] = useState<"balanced" | "focus" | "executive">("balanced");
  const [themePref, setThemePref] = useState<"light" | "dark" | "system">("light");

  useEffect(() => {
    const paramTab = searchParams.get("tab");
    if (paramTab === "org" || paramTab === "user") {
      setSettingsScope(paramTab);
    }
  }, [searchParams]);

  const loadState = async () => {
    const r = await fetch("/api/workspace/state");
    if (r.status === 401) {
      router.replace("/auth?mode=signin");
      return;
    }
    const data = (await r.json()) as SettingsState;
    if (!data.activeProfile) {
      router.replace("/app/gate?stage=profile");
      return;
    }
    setState(data);
    setI18nLang(data.account.lang);
    setMyDisplayName(data.activeProfile.displayName);
    setMyFontScale(
      data.activeProfile.profilePrefs?.fontScale || data.account.customization?.fontScale || "standard"
    );
    setProfCentreId((prev) => prev || data.centres[0]?.id || "");
    if (data.account.customization) {
      setBrandAccent(data.account.customization.brandAccent || "#1039B9");
      setOrgFontScale(data.account.customization.fontScale || "standard");
      setLayoutType(data.account.customization.layoutType || "balanced");
      setThemePref(data.account.customization.themePref || "light");
    }
  };

  useEffect(() => {
    setCanPasskey(isPasskeySupported());
    loadState();
  }, []);

  const toggleLang = async () => {
    if (!state) return;
    const nextLang = state.account.lang === "SW" ? "EN" : "SW";
    setI18nLang(nextLang);
    setState({ ...state, account: { ...state.account, lang: nextLang } });
    await fetch("/api/workspace/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_lang", lang: nextLang }),
    });
  };

  const lockProfile = async () => {
    await fetch("/api/workspace/gate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lock_profile" }),
    });
    router.push("/app/gate?stage=profile");
  };

  const signOutOrg = async () => {
    await fetch("/api/workspace/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "signout" }),
    });
    router.push("/auth?mode=signin");
  };

  const postAction = async (payload: Record<string, unknown>, successText: string) => {
    const actName = String(payload.action || "saving");
    setSavingAction(actName);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/workspace/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const out = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !out.ok) {
        setErrorMsg(out.error || "Update failed.");
        return false;
      }
      setStatusMsg(successText);
      await loadState();
      return true;
    } finally {
      setSavingAction(null);
    }
  };

  const handleSaveUserProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (newPin && newPin !== confirmNewPin) {
      setErrorMsg("New PIN confirmation does not match.");
      return;
    }
    const ok = await postAction(
      {
        action: "update_profile_settings",
        displayName: myDisplayName,
        fontScale: myFontScale,
        currentPin: newPin ? currentPin : undefined,
        newPin: newPin || undefined,
      },
      newPin ? "Personal profile & PIN updated cleanly." : "Personal profile settings updated."
    );
    if (ok) {
      setCurrentPin("");
      setNewPin("");
      setConfirmNewPin("");
    }
  };

  const handleAddCentre = async (e: FormEvent) => {
    e.preventDefault();
    if (await postAction({ action: "add_centre", name: ctrName, address: ctrAddress, phone: ctrPhone }, "New centre added cleanly.")) {
      setCtrName("");
      setCtrAddress("");
      setCtrPhone("");
    }
  };

  const handleAddProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (
      await postAction(
        {
          action: "add_profile",
          displayName: profName,
          role: profRole,
          centreId: profCentreId,
          pin: profPin,
        },
        "Staff profile and PIN created."
      )
    ) {
      setProfName("");
      setProfPin("");
    }
  };

  const handleUploadCerts = async (e: FormEvent) => {
    e.preventDefault();
    if (
      await postAction(
        {
          action: "upload_certificates",
          docType,
          licenseNumber: licenseNum,
          fileName: certFileName,
        },
        "Certificates saved. Network access is now unlocked."
      )
    ) {
      setLicenseNum("");
      setCertFileName("");
    }
  };

  const handleEnrollPasskey = async () => {
    if (!state) return;
    setEnrollingPasskey(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const res = await enrollPasskeyForAccount({
        userName: state.account.email,
        displayName: state.activeProfile?.displayName || state.account.fullName,
        label: passkeyLabel,
        profileId: state.activeProfile?.id,
      });
      if (!res.ok) {
        setErrorMsg(res.error || "Passkey enrollment failed.");
        return;
      }
      setStatusMsg("Passkey / device biometrics linked to your profile.");
      await loadState();
    } finally {
      setEnrollingPasskey(false);
    }
  };

  const handleLogoFileChange = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml" || file.size > 320 * 1024) {
      setErrorMsg("Please choose a PNG or JPG image under 320 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === "string") {
        await postAction(
          { action: "update_customization", brandLogoUrl: reader.result },
          "Organization logo updated."
        );
      }
    };
    reader.readAsDataURL(file);
  };

  if (!state || !state.activeProfile) {
    return (
      <div className={`min-h-screen p-6 sm:p-10 ${isDark ? "bg-[#090C12]" : "bg-[#F5F6F8]"}`}>
        <div className="max-w-4xl mx-auto space-y-5">
          <div className={`h-9 w-56 rounded-full animate-pulse ${isDark ? "bg-slate-800" : "bg-white border border-[#EAECF0]"}`} />
          <div className={`h-52 rounded-[24px] animate-pulse ${isDark ? "bg-slate-900 border border-slate-800" : "bg-white border border-[#EAECF0]"}`} />
        </div>
      </div>
    );
  }

  const isSw = state.account.lang === "SW";
  const accent = settingsScope === "org" ? brandAccent : (state.account.customization?.brandAccent || brandAccent);
  const liveFontScale = settingsScope === "org" ? orgFontScale : myFontScale;
  const isManagerRole =
    state.activeProfile.isMasterAdmin ||
    state.activeProfile.role === "pharmacy_owner" ||
    state.activeProfile.role === "supplier_admin";

  const newPinCheck = newPin ? evaluatePinStrength(newPin) : null;
  const staffPinCheck = evaluatePinStrength(profPin);

  const navItems: WorkspaceNavItem[] = [
    { id: "home", label: isSw ? "Muhtasari" : "Overview", href: "/app" },
    {
      id: "user_settings",
      label: isSw ? "Wasifu Wangu" : "My Settings",
      active: settingsScope === "user",
      onClick: () => setSettingsScope("user"),
    },
    ...(isManagerRole
      ? [
          {
            id: "settings",
            label: isSw ? "Mipangilio ya Shirika" : "Org Settings",
            active: settingsScope === "org",
            onClick: () => setSettingsScope("org"),
          },
        ]
      : []),
    { id: "download", label: isSw ? "Pakua Programu" : "Get App", href: "/app/download" },
  ];

  const cardSurface = isDark
    ? "bg-[#11161F]/95 border-slate-800/90 text-slate-100 shadow-lg"
    : "bg-white border-[#EAECF0] text-[#111317] shadow-[0_6px_28px_rgba(15,23,42,0.035)]";

  const inputCls = isDark
    ? "bg-slate-900/90 border-slate-700 text-slate-100 focus:border-[#38BDF8]"
    : "bg-[#F8FAFC] border-[#E2E8F0] text-[#111317] focus:border-[#1039B9] focus:bg-white";

  const mutedCls = isDark ? "text-slate-400" : "text-slate-500";

  return (
    <WorkspaceShell
      orgName={state.account.orgName}
      centreName={state.centres[0]?.name || "Primary Centre"}
      profileName={state.activeProfile.displayName}
      profileRole={state.activeProfile.role}
      brandLogoUrl={state.account.customization?.brandLogoUrl}
      brandAccent={accent}
      fontScale={liveFontScale}
      lang={state.account.lang}
      onToggleLang={toggleLang}
      theme={theme}
      onToggleTheme={toggleTheme}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      navItems={navItems}
      onLockProfile={lockProfile}
      onSignOut={signOutOrg}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Clear Scope Switcher: Personal User Settings vs Organization Settings */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className={`text-[11px] font-medium ${mutedCls}`}>
              {state.activeProfile.displayName} &middot; {state.activeProfile.role.replace(/_/g, " ")}
            </div>
            <h1 className="text-2xl sm:text-3xl font-normal tracking-tight" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
              {settingsScope === "user"
                ? isSw
                  ? "Mipangilio ya Mtumiaji"
                  : "User Profile Settings"
                : isSw
                  ? "Mipangilio ya Shirika & Tawi"
                  : "Organization Settings"}
            </h1>
          </div>

          <div
            className={`inline-flex p-1 rounded-full border ${
              isDark ? "bg-[#11161F] border-slate-800" : "bg-white border-[#EAECF0] shadow-2xs"
            }`}
          >
            <button
              type="button"
              onClick={() => setSettingsScope("user")}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                settingsScope === "user"
                  ? "text-white shadow-xs"
                  : mutedCls
              }`}
              style={settingsScope === "user" ? { backgroundColor: accent } : undefined}
            >
              {isSw ? "Wasifu Wangu (User)" : "My User Settings"}
            </button>
            <button
              type="button"
              onClick={() => setSettingsScope("org")}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                settingsScope === "org"
                  ? "text-white shadow-xs"
                  : mutedCls
              }`}
              style={settingsScope === "org" ? { backgroundColor: accent } : undefined}
            >
              {!isManagerRole && <IconLock className="w-3 h-3 text-amber-500" />}
              <span>{isSw ? "Shirika (Org)" : "Organization Settings"}</span>
            </button>
          </div>
        </div>

        {statusMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-xs font-semibold text-emerald-500 flex items-center gap-2">
            <IconCheck className="w-4 h-4" />
            <span>{statusMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-xs font-semibold text-rose-500">
            {errorMsg}
          </div>
        )}

        {/* ================================================================ */}
        {/* USER SETTINGS SCOPE (Personal Name, PIN Rotation, Font & Bio)    */}
        {/* ================================================================ */}
        {settingsScope === "user" && (
          <div className="space-y-5 animate-stage-pop">
            <section className={`rounded-[24px] border p-6 space-y-5 ${cardSurface}`}>
              <div>
                <h2 className="text-base font-semibold">
                  {isSw ? "Utambulisho Wako & PIN ya Kufungua" : "Personal Identity & Unlock PIN"}
                </h2>
                <p className={`text-xs mt-0.5 ${mutedCls}`}>
                  {isSw
                    ? "Mabadiliko haya yanahusu wasifu wako binafsi pekee, si kampuni nzima."
                    : "Applies only to your active staff profile and device experience."}
                </p>
              </div>

              <form onSubmit={handleSaveUserProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                      {isSw ? "Jina Lako Kwenye Kituo" : "Your Display Name"}
                    </label>
                    <input
                      type="text"
                      required
                      value={myDisplayName}
                      onChange={(e) => setMyDisplayName(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none ${inputCls}`}
                    />
                  </div>

                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                      {isSw ? "Ukubwa wa Maandishi Yako" : "Personal Font Scale"}
                    </label>
                    <select
                      value={myFontScale}
                      onChange={(e) => setMyFontScale(e.target.value as "compact" | "standard" | "large")}
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none ${inputCls}`}
                    >
                      <option value="compact">Compact</option>
                      <option value="standard">Standard</option>
                      <option value="large">Large / Comfortable</option>
                    </select>
                  </div>
                </div>

                <div className={`pt-4 border-t grid grid-cols-1 sm:grid-cols-3 gap-4 ${isDark ? "border-slate-800" : "border-slate-100"}`}>
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                      {isSw ? "PIN ya Sasa (Hiari)" : "Current PIN (to rotate)"}
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={currentPin}
                      onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="••••"
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-xs tracking-widest focus:outline-none ${inputCls}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                      {isSw ? "PIN Mpya (Tarakimu 4-6)" : "New PIN (4-6 digits)"}
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="e.g. 7492"
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-xs tracking-widest focus:outline-none ${inputCls}`}
                    />
                    {newPinCheck && (
                      <p className={`mt-1 text-[10px] font-medium ${newPinCheck.ok ? "text-emerald-600" : "text-rose-500"}`}>
                        {newPinCheck.ok ? "Strong numeric PIN" : isSw ? newPinCheck.errorSw : newPinCheck.errorEn}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                      {isSw ? "Thibitisha PIN Mpya" : "Confirm New PIN"}
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={confirmNewPin}
                      onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="••••"
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-xs tracking-widest focus:outline-none ${inputCls}`}
                    />
                    {newPin && confirmNewPin && newPin !== confirmNewPin && (
                      <p className="mt-1 text-[10px] font-medium text-rose-500">PINs do not match.</p>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingAction === "update_profile_settings" || Boolean(newPin && (!newPinCheck?.ok || newPin !== confirmNewPin))}
                  className="px-5 py-2.5 rounded-full text-white text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  style={{ backgroundColor: accent }}
                >
                  {savingAction === "update_profile_settings" && (
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  )}
                  <span>
                    {savingAction === "update_profile_settings"
                      ? isSw ? "Inahifadhi..." : "Saving..."
                      : isSw ? "Hifadhi Mipangilio Yangu" : "Save My Profile Settings"}
                  </span>
                </button>
              </form>
            </section>

            {/* Personal Device Passkeys / Biometrics */}
            <section className={`rounded-[24px] border p-6 space-y-4 ${cardSurface}`}>
              <div>
                <h2 className="text-base font-semibold">
                  {isSw ? "Biometria & Passkey za Kifaa Changu" : "My Biometrics & Device Passkeys"}
                </h2>
                <p className={`text-xs mt-0.5 ${mutedCls}`}>
                  Unlock your station profile faster with fingerprint or Face ID on this browser.
                </p>
              </div>
              {canPasskey && (
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    value={passkeyLabel}
                    onChange={(e) => setPasskeyLabel(e.target.value)}
                    className={`px-3.5 py-2.5 rounded-xl border text-xs flex-1 min-w-[200px] focus:outline-none ${inputCls}`}
                  />
                  <button
                    type="button"
                    disabled={enrollingPasskey}
                    onClick={handleEnrollPasskey}
                    className="px-5 py-2.5 rounded-full text-white text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                    style={{ backgroundColor: accent }}
                  >
                    {enrollingPasskey && (
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    )}
                    <span>{enrollingPasskey ? "Registering..." : "+ Register My Passkey"}</span>
                  </button>
                </div>
              )}

              {state.passkeys.length > 0 && (
                <div className="space-y-2">
                  {state.passkeys.map((pk) => (
                    <div
                      key={pk.credentialId}
                      className={`p-3 rounded-xl border text-xs font-medium ${
                        isDark ? "bg-slate-900/70 border-slate-800" : "bg-[#F8FAFC] border-[#E2E8F0]"
                      }`}
                    >
                      Passkey Active: <strong>{pk.label}</strong>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ================================================================ */}
        {/* ORGANIZATION SETTINGS SCOPE (Admin / Owner Restricted)           */}
        {/* ================================================================ */}
        {settingsScope === "org" && !isManagerRole && (
          <div className={`rounded-[24px] border p-8 text-center space-y-4 animate-stage-pop ${cardSurface}`}>
            <div className="w-12 h-12 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center mx-auto">
              <IconLock className="w-5 h-5" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h2 className="text-base font-semibold">
                {isSw ? "Mipangilio ya Shirika Imefungwa kwa Msimamizi" : "Organization Settings Require Owner Access"}
              </h2>
              <p className={`text-xs ${mutedCls}`}>
                Company branding, regulatory permits, centres, staff PIN provisioning, and gate policies can only be edited by an Owner or Master PIN profile.
              </p>
            </div>
            <button
              type="button"
              onClick={lockProfile}
              className="px-5 py-2.5 rounded-full text-white text-xs font-semibold cursor-pointer"
              style={{ backgroundColor: accent }}
            >
              {isSw ? "Badili kwenda Wasifu wa Mmiliki" : "Switch to Owner Profile"} &rarr;
            </button>
          </div>
        )}

        {settingsScope === "org" && isManagerRole && (
          <div className="space-y-5 animate-stage-pop">
            {/* Organization Brand Studio */}
            <section id="brand" className={`scroll-mt-8 rounded-[24px] border p-6 space-y-5 ${cardSurface}`}>
              <div>
                <h2 className="text-base font-semibold">Organization Brand Studio</h2>
                <p className={`text-xs mt-0.5 ${mutedCls}`}>
                  Set the shared company logo, accent swatch, default font scale, theme mode, and workspace layout across your centers.
                </p>
              </div>

              <div
                className={`rounded-2xl border p-4 flex flex-wrap items-center justify-between gap-4 ${
                  isDark ? "bg-slate-900/60 border-slate-800" : "bg-[#F8FAFC] border-[#E2E8F0]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative w-11 h-11 rounded-xl border border-slate-200 bg-white overflow-hidden shrink-0">
                    <Image
                      src={state.account.customization?.brandLogoUrl || "/cervos-company-logo-circular.svg"}
                      alt="Company Logo"
                      fill
                      className="object-contain p-1"
                      unoptimized={Boolean(state.account.customization?.brandLogoUrl)}
                    />
                  </div>
                  <div>
                    <div className="text-xs font-bold">Organization Crest / Logo</div>
                    <div className={`text-[11px] ${mutedCls}`}>PNG or JPG up to 320 KB</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label
                    className={`px-4 py-2 rounded-full border text-xs font-semibold cursor-pointer ${
                      isDark ? "border-slate-700 bg-slate-800 text-white" : "border-[#E2E8F0] bg-white text-[#111317]"
                    }`}
                  >
                    Upload Logo
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={(e) => handleLogoFileChange(e.target.files?.[0])}
                    />
                  </label>
                  {state.account.customization?.brandLogoUrl && (
                    <button
                      type="button"
                      onClick={() => postAction({ action: "update_customization", clearLogo: true }, "Reset to Cervos crest.")}
                      className="text-xs font-semibold text-rose-500 hover:underline cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Org Accent Color
                  </label>
                  <div className="flex gap-2">
                    {BRAND_SWATCHES.map((s) => (
                      <button
                        key={s.hex}
                        type="button"
                        title={s.label}
                        onClick={() => setBrandAccent(s.hex)}
                        className={`w-7 h-7 rounded-full border-2 cursor-pointer transition-transform ${
                          brandAccent === s.hex ? "scale-110 border-[#111317] dark:border-white" : "border-transparent"
                        }`}
                        style={{ backgroundColor: s.hex }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Default Font Scale
                  </label>
                  <select
                    value={orgFontScale}
                    onChange={(e) => setOrgFontScale(e.target.value as "compact" | "standard" | "large")}
                    className={`w-full px-3 py-2 rounded-xl border text-xs ${inputCls}`}
                  >
                    <option value="compact">Compact</option>
                    <option value="standard">Standard</option>
                    <option value="large">Large</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Dashboard Layout
                  </label>
                  <select
                    value={layoutType}
                    onChange={(e) => setLayoutType(e.target.value as "balanced" | "focus" | "executive")}
                    className={`w-full px-3 py-2 rounded-xl border text-xs ${inputCls}`}
                  >
                    <option value="balanced">Balanced Bento</option>
                    <option value="focus">Focus Counter</option>
                    <option value="executive">Executive Grid</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Org Theme Default
                  </label>
                  <select
                    value={themePref}
                    onChange={(e) => {
                      const val = e.target.value as "light" | "dark" | "system";
                      setThemePref(val);
                      const resolved =
                        val === "system" && typeof window !== "undefined"
                          ? window.matchMedia("(prefers-color-scheme: dark)").matches
                            ? "dark"
                            : "light"
                          : val;
                      if (resolved === "light" || resolved === "dark") {
                        setTheme(resolved);
                        try {
                          localStorage.setItem("cervos-ws-theme", resolved);
                        } catch {
                          // Ignore
                        }
                      }
                    }}
                    className={`w-full px-3 py-2 rounded-xl border text-xs ${inputCls}`}
                  >
                    <option value="light">Light Default</option>
                    <option value="dark">Dark Studio</option>
                    <option value="system">System Match</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                disabled={savingAction === "update_customization"}
                onClick={() =>
                  postAction(
                    { action: "update_customization", brandAccent, fontScale: orgFontScale, layoutType, themePref },
                    "Organization branding & layout updated."
                  )
                }
                className="px-5 py-2.5 rounded-full text-white text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                style={{ backgroundColor: brandAccent }}
              >
                {savingAction === "update_customization" && (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                )}
                <span>{savingAction === "update_customization" ? "Saving..." : "Save Organization Brand"}</span>
              </button>
            </section>

            {/* Regulatory Certificates */}
            <section id="certificates" className={`scroll-mt-8 rounded-[24px] border p-6 space-y-5 ${cardSurface}`}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold">Regulatory Certificates &amp; Network Access</h2>
                  <p className={`text-xs mt-0.5 ${mutedCls}`}>
                    {state.account.networkUnlocked
                      ? "Verified for live Cervos network discovery and wholesale orders."
                      : "Skipped during setup. Upload your license to unlock network access."}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-[11px] font-bold shrink-0 ${
                    state.account.networkUnlocked
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-amber-500/15 text-amber-500"
                  }`}
                >
                  {state.account.networkUnlocked ? "Network Unlocked" : "Network Locked"}
                </span>
              </div>

              {state.account.certificates.length > 0 && (
                <div className="space-y-2">
                  {state.account.certificates.map((c) => (
                    <div
                      key={c.id}
                      className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                        isDark ? "bg-slate-900/70 border-slate-800" : "bg-[#F8FAFC] border-[#E2E8F0]"
                      }`}
                    >
                      <div>
                        <span className="font-bold">{c.docType}</span> &middot; {c.licenseNumber}
                      </div>
                      <span className="text-slate-400">{c.fileName}</span>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleUploadCerts} className="space-y-4 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className={`px-3.5 py-2.5 rounded-xl border text-xs ${inputCls}`}
                  >
                    <option value="Pharmacy Operating Permit">Pharmacy Permit</option>
                    <option value="Wholesale Distribution Permit">Wholesale Permit</option>
                    <option value="Clinic Registration Certificate">Clinic Certificate</option>
                  </select>
                  <input
                    type="text"
                    required
                    value={licenseNum}
                    onChange={(e) => setLicenseNum(e.target.value)}
                    placeholder="Permit / License Number"
                    className={`px-3.5 py-2.5 rounded-xl border text-xs ${inputCls}`}
                  />
                </div>

                <CertificateDropzone
                  fileName={certFileName}
                  onFileSelect={setCertFileName}
                  isDark={isDark}
                  isSw={isSw}
                />

                <button
                  type="submit"
                  disabled={savingAction === "upload_certificates" || !licenseNum.trim() || !certFileName.trim()}
                  className="px-5 py-2.5 rounded-full text-white text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  style={{ backgroundColor: accent }}
                >
                  {savingAction === "upload_certificates" && (
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  )}
                  <span>{savingAction === "upload_certificates" ? "Uploading..." : "Upload & Unlock Network Access"}</span>
                </button>
              </form>
            </section>

            {/* Organization Gate Security Policies */}
            <section className={`rounded-[24px] border p-6 space-y-4 ${cardSurface}`}>
              <h2 className="text-base font-semibold">Organization Gate Policies</h2>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={state.account.requireSecurityEveryTime}
                    onChange={(e) =>
                      postAction(
                        { action: "update_security", requireSecurityEveryTime: e.target.checked },
                        "Organization security gate policy updated."
                      )
                    }
                    className="accent-[#1039B9]"
                  />
                  <span>Always require organization security question on every online sign-in</span>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    postAction(
                      { action: "update_security", revokeTrustedBrowsers: true },
                      "Remembered browser tokens revoked across organization."
                    )
                  }
                  className="text-xs font-semibold text-rose-500 hover:underline cursor-pointer"
                >
                  Forget All Trusted Browsers
                </button>
              </div>
            </section>

            {/* Centres & Office Locations */}
            <section id="centres" className={`scroll-mt-8 rounded-[24px] border p-6 space-y-5 ${cardSurface}`}>
              <h2 className="text-base font-semibold">Centres &amp; Office Locations ({state.centres.filter((c) => matchesSearch(searchQuery, c.name, c.region, c.address, c.phone)).length})</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {state.centres
                  .filter((c) => matchesSearch(searchQuery, c.name, c.region, c.address, c.phone))
                  .map((c) => (
                  <div
                    key={c.id}
                    className={`p-3.5 rounded-2xl border text-xs ${
                      isDark ? "bg-slate-900/70 border-slate-800" : "bg-[#F8FAFC] border-[#E2E8F0]"
                    }`}
                  >
                    <div className="font-bold">{c.name}</div>
                    <div className={`mt-0.5 ${mutedCls}`}>
                      {c.address} &middot; {c.region}
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleAddCentre} className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <input
                  type="text"
                  required
                  value={ctrName}
                  onChange={(e) => setCtrName(e.target.value)}
                  placeholder="New Centre Name"
                  className={`px-3.5 py-2.5 rounded-xl border text-xs ${inputCls}`}
                />
                <input
                  type="text"
                  required
                  value={ctrAddress}
                  onChange={(e) => setCtrAddress(e.target.value)}
                  placeholder="Street / District"
                  className={`px-3.5 py-2.5 rounded-xl border text-xs ${inputCls}`}
                />
                <input
                  type="text"
                  value={ctrPhone}
                  onChange={(e) => setCtrPhone(e.target.value)}
                  placeholder="Phone (+255...)"
                  className={`px-3.5 py-2.5 rounded-xl border text-xs ${inputCls}`}
                />
                <button
                  type="submit"
                  disabled={savingAction === "add_centre"}
                  className="sm:col-span-3 justify-self-start px-5 py-2.5 rounded-full text-white text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  style={{ backgroundColor: accent }}
                >
                  {savingAction === "add_centre" && (
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  )}
                  <span>{savingAction === "add_centre" ? "Adding..." : "+ Add Centre"}</span>
                </button>
              </form>
            </section>

            {/* Staff Profiles & Role PIN Provisioning */}
            <section id="staff" className={`scroll-mt-8 rounded-[24px] border p-6 space-y-5 ${cardSurface}`}>
              <h2 className="text-base font-semibold">Staff Profiles &amp; Role PINs ({state.profiles.filter((p) => matchesSearch(searchQuery, p.displayName, p.role, state.centres.find((c) => c.id === p.centreId)?.name)).length})</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {state.profiles
                  .filter((p) =>
                    matchesSearch(
                      searchQuery,
                      p.displayName,
                      p.role,
                      state.centres.find((c) => c.id === p.centreId)?.name
                    )
                  )
                  .map((p) => (
                  <div
                    key={p.id}
                    className={`p-3.5 rounded-2xl border text-xs flex justify-between items-center ${
                      isDark ? "bg-slate-900/70 border-slate-800" : "bg-[#F8FAFC] border-[#E2E8F0]"
                    }`}
                  >
                    <div>
                      <div className="font-bold">{p.displayName}</div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400">
                        {p.role.replace(/_/g, " ")}
                      </div>
                    </div>
                    {p.isMasterAdmin && <span className="text-[10px] font-bold" style={{ color: accent }}>MASTER</span>}
                  </div>
                ))}
              </div>
              <form onSubmit={handleAddProfile} className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1 items-start">
                <input
                  type="text"
                  required
                  value={profName}
                  onChange={(e) => setProfName(e.target.value)}
                  placeholder="Staff Name"
                  className={`px-3.5 py-2.5 rounded-xl border text-xs ${inputCls}`}
                />
                <select
                  value={profRole}
                  onChange={(e) => setProfRole(e.target.value)}
                  className={`px-3.5 py-2.5 rounded-xl border text-xs ${inputCls}`}
                >
                  <option value="superintendent_pharmacist">Pharmacist</option>
                  <option value="pos_cashier">Counter Cashier</option>
                  <option value="pharmacy_owner">Branch Admin / Owner</option>
                  <option value="warehouse_dispatcher">Warehouse Dispatcher</option>
                </select>
                <select
                  value={profCentreId}
                  onChange={(e) => setProfCentreId(e.target.value)}
                  className={`px-3.5 py-2.5 rounded-xl border text-xs ${inputCls}`}
                >
                  {state.centres.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <div className="space-y-1">
                  <input
                    type="password"
                    inputMode="numeric"
                    required
                    maxLength={6}
                    value={profPin}
                    onChange={(e) => setProfPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="4-6 Digit PIN"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs ${inputCls}`}
                  />
                  {profPin.length > 0 && (
                    <p className={`text-[10px] font-medium ${staffPinCheck.ok ? "text-emerald-600" : "text-rose-500"}`}>
                      {staffPinCheck.ok ? "PIN OK" : staffPinCheck.errorEn}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={savingAction === "add_profile" || !staffPinCheck.ok}
                  className="sm:col-span-4 justify-self-start px-5 py-2.5 rounded-full text-white text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  style={{ backgroundColor: accent }}
                >
                  {savingAction === "add_profile" && (
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  )}
                  <span>{savingAction === "add_profile" ? "Adding..." : "+ Add Staff Profile"}</span>
                </button>
              </form>
            </section>
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}

export default function WorkspaceSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center text-xs text-slate-400">
          Loading settings...
        </div>
      }
    >
      <WorkspaceSettingsInner />
    </Suspense>
  );
}
