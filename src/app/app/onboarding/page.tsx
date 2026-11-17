"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import ClaymorphicStageBackdrop from "@/components/ClaymorphicStageBackdrop";
import CertificateDropzone from "@/components/CertificateDropzone";
import { IconCheck } from "@/components/LandingIcons";
import {
  evaluatePinStrength,
  hasClientInjectionRisk,
  validatePhoneInline,
} from "@/lib/security/client-validators";
import { useWorkspaceTheme } from "@/lib/workspace/theme";
import { useI18n } from "@/lib/i18n/context";

interface HydratedAccount {
  id: string;
  email: string;
  fullName: string;
  roleType: string;
  orgName: string;
  region: string;
  lang: "EN" | "SW";
  onboardingDone: boolean;
}

const ACCENT_SWATCHES = [
  { hex: "#1039B9", label: "Cervos Royal" },
  { hex: "#059669", label: "Emerald Dispensary" },
  { hex: "#006875", label: "Clinical Teal" },
  { hex: "#C2410C", label: "Warm Amber" },
  { hex: "#475569", label: "Slate Mono" },
];

const SECURITY_PRESETS = [
  {
    id: "branch",
    en: "What street or neighborhood did your first branch open in?",
    sw: "Tawi lako la kwanza lilifunguliwa mtaa au kitongoji gani?",
  },
  {
    id: "supplier",
    en: "What was the name of your first trusted pharmacy supplier?",
    sw: "Msambazaji wako wa kwanza wa dawa aliitwa nani?",
  },
  {
    id: "city",
    en: "In which city or town was the founder born?",
    sw: "Mwanzilishi alizaliwa mji au jiji lipi?",
  },
] as const;

export default function WorkspaceOnboardingPage() {
  const router = useRouter();
  const { lang: i18nLang, setLang: setI18nLang } = useI18n();
  const { isDark, setTheme, toggleTheme } = useWorkspaceTheme();

  const [loading, setLoading] = useState(true);
  const [showCalmIntro, setShowCalmIntro] = useState(true);
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [isFading, setIsFading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Track field interaction so inline hints stay helpful rather than noisy on blank forms
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (field: string) => setTouched((p) => (p[field] ? p : { ...p, [field]: true }));

  // Step 1: Pre-filled Identity + Centre Location
  const [fullName, setFullName] = useState("");
  const [langPreset, setLangPreset] = useState<"EN" | "SW">(i18nLang === "SW" ? "SW" : "EN");
  const [roleType, setRoleType] = useState("pharmacy");
  const [email, setEmail] = useState("");
  const [centreName, setCentreName] = useState("");
  const [region, setRegion] = useState("Dar es Salaam");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  // Step 2: Mandatory Security Question + Master Admin PIN
  const [securityPresetId, setSecurityPresetId] = useState<"branch" | "supplier" | "city" | "custom">("branch");
  const [customSecurityQuestion, setCustomSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [masterPin, setMasterPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [rememberBrowser, setRememberBrowser] = useState(true);
  const [requireEveryTime, setRequireEveryTime] = useState(false);

  // Step 3: Brand Studio & Workspace Personalization (Builds ownership & loyalty)
  const [brandLogoUrl, setBrandLogoUrl] = useState<string>("");
  const [brandLogoName, setBrandLogoName] = useState<string>("");
  const [brandAccent, setBrandAccent] = useState<string>("#1039B9");
  const [fontScale, setFontScale] = useState<"compact" | "standard" | "large">("standard");
  const [layoutType, setLayoutType] = useState<"balanced" | "focus" | "executive">("balanced");
  const [themePref, setThemePref] = useState<"light" | "dark" | "system">("light");

  // Step 4: Skippable Regulatory Certificates
  const [docType, setDocType] = useState("Pharmacy Operating Permit");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [certificateFileName, setCertificateFileName] = useState("");

  const isSw = langPreset === "SW";

  useEffect(() => {
    let active = true;
    fetch("/api/workspace/state")
      .then(async (r) => {
        if (r.status === 401) {
          router.replace("/auth?mode=signup");
          return null;
        }
        return r.json();
      })
      .then((data: { account?: HydratedAccount } | null) => {
        if (!active || !data?.account) return;
        const a = data.account;
        if (a.onboardingDone) {
          router.replace("/app");
          return;
        }
        setFullName(a.fullName);
        const resolvedLang = a.lang === "SW" ? "SW" : "EN";
        setLangPreset(resolvedLang);
        setI18nLang(resolvedLang);
        setRoleType(a.roleType);
        setEmail(a.email);
        setCentreName(a.orgName);
        setRegion(a.region || "Dar es Salaam");
        if (a.roleType === "supplier") setDocType("Wholesale Distribution Permit");
        if (a.roleType === "dispensary") setDocType("Clinic Registration Certificate");
        setLoading(false);
      })
      .catch(() => setLoading(false));

    return () => {
      active = false;
    };
  }, [router]);

  // Serene gentle pause above skeleton/loader before unveiling Step 1
  useEffect(() => {
    if (loading || !showCalmIntro) return;
    const timer = setTimeout(() => {
      setShowCalmIntro(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, [loading, showCalmIntro]);

  const transitionToStep = (next: 1 | 2 | 3 | 4 | 5) => {
    setErrorMsg(null);
    setIsFading(true);
    setTimeout(() => {
      setStep(next);
      setIsFading(false);
    }, 220);
  };

  // Real-time field evaluations
  const nameValid = fullName.trim().length >= 2 && !hasClientInjectionRisk(fullName);
  const centreValid = centreName.trim().length >= 2 && !hasClientInjectionRisk(centreName);
  const addressValid = address.trim().length >= 3 && !hasClientInjectionRisk(address);
  const phoneCheck = validatePhoneInline(phone);
  const step1Ready = nameValid && centreValid && addressValid && phoneCheck.ok;

  const activePreset = SECURITY_PRESETS.find((p) => p.id === securityPresetId);
  const resolvedSecurityQuestion =
    securityPresetId === "custom"
      ? customSecurityQuestion.trim()
      : activePreset
        ? isSw
          ? activePreset.sw
          : activePreset.en
        : SECURITY_PRESETS[0].en;

  const questionValid =
    resolvedSecurityQuestion.length >= 6 && !hasClientInjectionRisk(resolvedSecurityQuestion);
  const answerValid = securityAnswer.trim().length >= 2 && !hasClientInjectionRisk(securityAnswer);
  const pinCheck = evaluatePinStrength(masterPin);
  const pinConfirmMatches = confirmPin.length > 0 && confirmPin === masterPin;
  const step2Ready = questionValid && answerValid && pinCheck.ok && pinConfirmMatches;

  const handleLogoUpload = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
      setErrorMsg(isSw ? "Pakia picha ya PNG au JPG." : "Please upload a PNG, JPG, or WEBP company logo.");
      return;
    }
    if (file.size > 320 * 1024) {
      setErrorMsg(isSw ? "Picha iwe chini ya KB 320." : "Keep logo image under 320 KB for instant offline sync.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setBrandLogoUrl(reader.result);
        setBrandLogoName(file.name);
        setErrorMsg(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const applyThemeChoice = (pref: "light" | "dark" | "system") => {
    setThemePref(pref);
    if (pref === "system") {
      try {
        localStorage.removeItem("cervos-ws-theme");
      } catch {
        // Ignore
      }
      const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
      setTheme(prefersDark ? "dark" : "light");
    } else {
      setTheme(pref);
      try {
        localStorage.setItem("cervos-ws-theme", pref);
      } catch {
        // Ignore
      }
    }
  };

  const submitOnboarding = async (skipCompliance: boolean) => {
    setErrorMsg(null);
    if (!skipCompliance && (licenseNumber.trim().length < 3 || certificateFileName.trim().length < 3)) {
      setErrorMsg(
        isSw
          ? "Weka namba ya leseni na pakia cheti, au chagua Ruka Kwa Sasa."
          : "Enter your license number and select a file, or click Skip for now."
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/workspace/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          lang: langPreset,
          centreName,
          region,
          address,
          phone,
          securityQuestion: resolvedSecurityQuestion,
          securityAnswer,
          masterPin,
          rememberBrowser,
          requireSecurityEveryTime: requireEveryTime,
          skipCompliance,
          docType,
          licenseNumber,
          certificateFileName,
          customization: {
            brandLogoUrl: brandLogoUrl || undefined,
            brandAccent,
            fontScale,
            layoutType,
            themePref,
          },
        }),
      });
      const data = (await res.json()) as { ok?: boolean; redirectTo?: string; error?: string };
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || "Unable to finish setup.");
        return;
      }
      try {
        window.sessionStorage.setItem("cervos-just-logged-in", "1");
      } catch {
        // Ignore
      }
      transitionToStep(5);
    } catch {
      setErrorMsg("Network error. Please retry.");
    } finally {
      setSubmitting(false);
    }
  };

  const pageCls = isDark ? "bg-[#0B0F17] text-slate-100" : "bg-[#F8FAFC] text-[#0F172A]";
  const cardCls = isDark
    ? "bg-[#11161F]/92 border-slate-800 text-slate-100 shadow-2xl"
    : "bg-white/95 border-[#E2E8F0] text-[#0F172A] shadow-xl shadow-slate-900/5";
  const inputBase = isDark
    ? "bg-slate-900/90 border-slate-700 text-white placeholder:text-slate-500 focus:border-[#38BDF8]"
    : "bg-[#F8FAFC] border-[#E2E8F0] text-[#0F172A] focus:border-[#1039B9] focus:bg-white";
  const mutedCls = isDark ? "text-slate-400" : "text-slate-500";

  // Calm Intro / Skeleton Pre-Roll Before Unveiling Onboarding Form
  if (loading || showCalmIntro) {
    return (
      <div className={`relative min-h-screen flex flex-col items-center justify-center p-6 transition-colors ${pageCls}`}>
        <ClaymorphicStageBackdrop isDark={isDark} />

        <div className="relative z-10 max-w-md w-full space-y-5 animate-stage-pop">
          {/* Calm Pop-up Message Above Loader */}
          <div className={`rounded-lg border backdrop-blur-md p-5 text-center space-y-2 ${cardCls}`}>
            <div className="w-10 h-10 rounded-full overflow-hidden ring-1 ring-slate-200 bg-white mx-auto relative">
              <Image
                src="/cervos-company-logo-circular.svg"
                alt="Cervos Pharma"
                fill
                className="object-contain p-1"
              />
            </div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: brandAccent }}>
              {isSw ? "MAANDALIZI YA KITUO" : "WORKSPACE SETUP"}
            </div>
            <h1 className="text-lg font-bold" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
              {isSw
                ? "Kabla hatujaanza, tuandae mahali pako pa kazi."
                : "Before we open inside, let's set up your workplace."}
            </h1>
            <p className={`text-xs ${mutedCls}`}>
              {isSw
                ? "Hatua chache za utulivu zitabinafsisha muonekano, ulinzi na lugha yako."
                : "A calm, guided moment to set your location, PIN lock, and your own brand feel."}
            </p>
          </div>

          {/* Sleek Skeleton Preview + Smooth Progress Loader */}
          <div className={`rounded-lg border p-5 space-y-3 ${cardCls}`}>
            <div className="flex items-center justify-between">
              <span className={`h-2.5 w-28 rounded animate-pulse ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
              <span className={`h-2.5 w-14 rounded animate-pulse ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className={`h-9 rounded-md animate-pulse ${isDark ? "bg-slate-800/80" : "bg-slate-100"}`} />
              <div className={`h-9 rounded-md animate-pulse ${isDark ? "bg-slate-800/80" : "bg-slate-100"}`} />
            </div>
            <div className="h-1 w-full rounded-full overflow-hidden bg-slate-200/50">
              <div
                className="h-full w-2/3 rounded-full animate-pulse transition-all duration-700"
                style={{ backgroundColor: brandAccent }}
              />
            </div>
            {!loading && (
              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => setShowCalmIntro(false)}
                  className="text-[11px] font-semibold hover:underline cursor-pointer"
                  style={{ color: brandAccent }}
                >
                  {isSw ? "Anza mara moja" : "Continue now"} &rarr;
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative min-h-screen flex flex-col justify-between p-5 sm:p-8 transition-colors duration-300 ${pageCls}`}>
      <ClaymorphicStageBackdrop isDark={isDark} />

      {/* Quiet Floating Corner Controls (No Top Header Bar) */}
      <div className="relative z-10 max-w-5xl w-full mx-auto flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="relative w-8 h-8 rounded-full overflow-hidden ring-1 ring-slate-200 bg-white">
            <Image
              src={brandLogoUrl || "/cervos-company-logo-circular.svg"}
              alt={centreName || "Cervos Pharma"}
              fill
              className="object-contain p-0.5"
              unoptimized={Boolean(brandLogoUrl)}
            />
          </div>
          <span className="text-xs font-bold tracking-tight" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
            {centreName || "Cervos Pharma"}
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <div
            className={`flex items-center rounded-md border p-0.5 text-[11px] font-bold ${
              isDark ? "bg-[#11161F]/90 border-slate-800" : "bg-white border-[#E2E8F0] shadow-2xs"
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setLangPreset("EN");
                setI18nLang("EN");
              }}
              className={`px-2 py-0.5 rounded cursor-pointer ${
                !isSw ? "bg-[#1039B9] text-white" : mutedCls
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => {
                setLangPreset("SW");
                setI18nLang("SW");
              }}
              className={`px-2 py-0.5 rounded cursor-pointer ${
                isSw ? "bg-[#1039B9] text-white" : mutedCls
              }`}
            >
              SW
            </button>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className={`w-8 h-8 rounded-md border flex items-center justify-center cursor-pointer ${
              isDark
                ? "border-slate-800 bg-[#11161F]/90 text-amber-300"
                : "border-[#E2E8F0] bg-white text-[#0F172A] shadow-2xs"
            }`}
          >
            {isDark ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
                />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Centered Auth-Aligned Crisp Onboarding Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center py-8">
        <div className="max-w-2xl w-full mx-auto space-y-5">
          {/* Calm Segmented Step Indicator */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 1, label: isSw ? "1. Kituo" : "1. Workplace" },
              { id: 2, label: isSw ? "2. Ulinzi & PIN" : "2. Security & PIN" },
              { id: 3, label: isSw ? "3. Muonekano" : "3. Brand Studio" },
              { id: 4, label: isSw ? "4. Leseni (Hiari)" : "4. Permits" },
            ].map((item) => (
              <div
                key={item.id}
                className={`rounded-md border px-3 py-2 text-[11px] font-semibold transition-all ${
                  step === item.id
                    ? "text-white border-transparent shadow-xs"
                    : step > item.id
                      ? isDark
                        ? "bg-emerald-950/40 text-emerald-300 border-emerald-800/60"
                        : "bg-emerald-50 text-[#00542C] border-emerald-200"
                      : isDark
                        ? "bg-[#11161F]/80 text-slate-400 border-slate-800"
                        : "bg-white/80 text-slate-500 border-[#E2E8F0]"
                }`}
                style={step === item.id ? { backgroundColor: brandAccent } : undefined}
              >
                {item.label}
              </div>
            ))}
          </div>

          <div
            className={`rounded-lg border backdrop-blur-md p-6 sm:p-8 space-y-6 transition-all duration-200 ${cardCls} ${
              isFading ? "opacity-0 translate-y-1.5" : "opacity-100 translate-y-0"
            }`}
          >
            {errorMsg && (
              <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/30 text-xs text-rose-500 font-medium">
                {errorMsg}
              </div>
            )}

            {/* STEP 1: WORKPLACE & LIVE FIELD VALIDATION */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color: brandAccent }}>
                    {isSw ? "HATUA YA 01 · KUTOKA USAJILI" : "STEP 01 · CARRIED FROM SIGNUP"}
                  </div>
                  <h1 className="text-2xl font-bold" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                    {isSw ? "Hakiki Wasifu na Mahali pa Kituo" : "Confirm Identity & Office Location"}
                  </h1>
                </div>

                <div
                  className={`grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-md border p-4 ${
                    isDark ? "bg-slate-900/60 border-slate-800" : "bg-[#F8FAFC] border-[#E2E8F0]"
                  }`}
                >
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                      {isSw ? "Jina Kamili" : "Full Name"}
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        touch("fullName");
                      }}
                      className={`w-full px-3 py-2 rounded-md border text-xs font-semibold focus:outline-none ${inputBase}`}
                    />
                    {touched.fullName && !nameValid && (
                      <p className="mt-1 text-[11px] text-rose-500 font-medium">
                        {isSw ? "Weka jina halali (herufi 2+)." : "Enter at least 2 valid characters."}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                      {isSw ? "Aina & Lugha" : "Account Type & Language"}
                    </label>
                    <div
                      className={`flex items-center justify-between px-3 py-2 rounded-md border text-xs font-semibold ${
                        isDark ? "bg-slate-900 border-slate-700" : "bg-white border-[#E2E8F0]"
                      }`}
                    >
                      <span className="capitalize">{roleType}</span>
                      <span style={{ color: brandAccent }}>{langPreset}</span>
                    </div>
                  </div>
                  <div className={`sm:col-span-2 text-[11px] ${mutedCls}`}>{email}</div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                      {isSw ? "Jina la Kituo / Tawi Kuu *" : "Primary Office / Branch Name *"}
                    </label>
                    <input
                      type="text"
                      value={centreName}
                      onChange={(e) => {
                        setCentreName(e.target.value);
                        touch("centreName");
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-md border text-xs focus:outline-none ${inputBase}`}
                    />
                    {touched.centreName && !centreValid && (
                      <p className="mt-1 text-[11px] text-rose-500 font-medium">
                        {isSw ? "Jina la kituo linahitajika." : "Valid branch name is required."}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                      {isSw ? "Mkoa" : "Region"}
                    </label>
                    <input
                      type="text"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-md border text-xs focus:outline-none ${inputBase}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                      {isSw ? "Anwani ya Mtaa *" : "Street / Ward Location *"}
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => {
                        setAddress(e.target.value);
                        touch("address");
                      }}
                      placeholder="e.g. Msimbazi Street, Plot 14"
                      className={`w-full px-3.5 py-2.5 rounded-md border text-xs focus:outline-none ${inputBase}`}
                    />
                    {touched.address && !addressValid && (
                      <p className="mt-1 text-[11px] text-rose-500 font-medium">
                        {isSw ? "Weka anwani kamili (angalau herufi 3)." : "Provide street or ward details (3+ chars)."}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                      {isSw ? "Simu ya Kituo *" : "Office Phone *"}
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        touch("phone");
                      }}
                      placeholder="+255 7XX XXX XXX"
                      className={`w-full px-3.5 py-2.5 rounded-md border text-xs focus:outline-none ${inputBase}`}
                    />
                    {touched.phone && !phoneCheck.ok && (
                      <p className="mt-1 text-[11px] text-rose-500 font-medium">
                        {isSw ? phoneCheck.errorSw : phoneCheck.errorEn}
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    disabled={!step1Ready}
                    onClick={() => transitionToStep(2)}
                    className="px-6 py-2.5 rounded-md disabled:opacity-45 text-white text-xs font-semibold cursor-pointer transition-all"
                    style={{ backgroundColor: brandAccent }}
                  >
                    {isSw ? "Endelea Usalama" : "Continue to Security & PIN"} &rarr;
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: SECURITY & LIVE PIN PATTERN VALIDATION */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color: brandAccent }}>
                    {isSw ? "HATUA YA 02 · ULINZI" : "STEP 02 · BROWSER GATE & PIN"}
                  </div>
                  <h1 className="text-2xl font-bold" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                    {isSw ? "Weka Swali la Usalama na PIN Kuu" : "Set Security Question & Master PIN"}
                  </h1>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                      {isSw ? "Swali la Usalama" : "Security Verification Question"}
                    </label>
                    <select
                      value={securityPresetId}
                      onChange={(e) => {
                        setSecurityPresetId(e.target.value as "branch" | "supplier" | "city" | "custom");
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-md border text-xs focus:outline-none ${inputBase}`}
                    >
                      {SECURITY_PRESETS.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {isSw ? preset.sw : preset.en}
                        </option>
                      ))}
                      <option value="custom">
                        {isSw ? "Nyingine (Andika swali lako binafsi)" : "Custom (Write your own security question)"}
                      </option>
                    </select>
                  </div>

                  {securityPresetId === "custom" && (
                    <div>
                      <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                        {isSw ? "Swali Lako Binafsi *" : "Your Custom Security Question *"}
                      </label>
                      <input
                        type="text"
                        value={customSecurityQuestion}
                        onChange={(e) => {
                          setCustomSecurityQuestion(e.target.value);
                          touch("customQuestion");
                        }}
                        placeholder={
                          isSw
                            ? "Mfano: Shule yako ya kwanza ilikuwa inaitwaje?"
                            : "e.g. What was the name of your first neighborhood clinic?"
                        }
                        className={`w-full px-3.5 py-2.5 rounded-md border text-xs focus:outline-none ${inputBase}`}
                      />
                      {touched.customQuestion && !questionValid && (
                        <p className="mt-1 text-[11px] text-rose-500 font-medium">
                          {isSw
                            ? "Andika swali lenye angalau herufi 6 halali."
                            : "Write a clear question (at least 6 valid characters)."}
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                      {isSw ? "Jibu Lako *" : "Your Answer *"}
                    </label>
                    <input
                      type="text"
                      value={securityAnswer}
                      onChange={(e) => {
                        setSecurityAnswer(e.target.value);
                        touch("securityAnswer");
                      }}
                      placeholder={isSw ? "Andika jibu utakalokumbuka" : "Enter a memorable answer"}
                      className={`w-full px-3.5 py-2.5 rounded-md border text-xs focus:outline-none ${inputBase}`}
                    />
                    {touched.securityAnswer && !answerValid && (
                      <p className="mt-1 text-[11px] text-rose-500 font-medium">
                        {isSw ? "Weka jibu lenye herufi 2 au zaidi." : "Enter at least 2 safe characters."}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                        {isSw ? "Unda PIN Kuu (Tarakimu 4-6) *" : "Master Admin PIN (4-6 digits) *"}
                      </label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        value={masterPin}
                        onChange={(e) => {
                          setMasterPin(e.target.value.replace(/\D/g, ""));
                          touch("masterPin");
                        }}
                        placeholder="e.g. 8429"
                        className={`w-full px-3.5 py-2.5 rounded-md border text-xs tracking-widest focus:outline-none ${
                          touched.masterPin && !pinCheck.ok
                            ? "border-rose-500 focus:border-rose-500"
                            : pinCheck.ok
                              ? "border-emerald-500 focus:border-emerald-600"
                              : inputBase
                        }`}
                      />
                      {/* Immediate Inline PIN Feedback */}
                      {masterPin.length > 0 && (
                        <p
                          className={`mt-1 text-[11px] font-medium ${
                            pinCheck.ok ? "text-emerald-600" : "text-rose-500"
                          }`}
                        >
                          {pinCheck.ok
                            ? isSw
                              ? "PIN imara na salama."
                              : "Strong numeric PIN."
                            : isSw
                              ? pinCheck.errorSw
                              : pinCheck.errorEn}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                        {isSw ? "Thibitisha PIN *" : "Confirm Master PIN *"}
                      </label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        value={confirmPin}
                        onChange={(e) => {
                          setConfirmPin(e.target.value.replace(/\D/g, ""));
                          touch("confirmPin");
                        }}
                        placeholder="••••"
                        className={`w-full px-3.5 py-2.5 rounded-md border text-xs tracking-widest focus:outline-none ${
                          confirmPin.length > 0 && !pinConfirmMatches
                            ? "border-rose-500 focus:border-rose-500"
                            : pinConfirmMatches && pinCheck.ok
                              ? "border-emerald-500 focus:border-emerald-600"
                              : inputBase
                        }`}
                      />
                      {confirmPin.length > 0 && (
                        <p
                          className={`mt-1 text-[11px] font-medium ${
                            pinConfirmMatches ? "text-emerald-600" : "text-rose-500"
                          }`}
                        >
                          {pinConfirmMatches
                            ? isSw
                              ? "PIN zinalingana."
                              : "PINs match."
                            : isSw
                              ? "PIN hazilingani."
                              : "PIN confirmation does not match."}
                        </p>
                      )}
                    </div>
                  </div>

                  <label className={`flex items-center gap-2.5 text-xs pt-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    <input
                      type="checkbox"
                      checked={rememberBrowser}
                      onChange={(e) => setRememberBrowser(e.target.checked)}
                      className="accent-[#1039B9]"
                    />
                    <span>
                      {isSw
                        ? "Kumbuka kivinjari hiki kwa siku 30"
                        : "Remember this browser for 30 days"}
                    </span>
                  </label>

                  <label className={`flex items-center gap-2.5 text-xs ${mutedCls}`}>
                    <input
                      type="checkbox"
                      checked={requireEveryTime}
                      onChange={(e) => setRequireEveryTime(e.target.checked)}
                      className="accent-[#1039B9]"
                    />
                    <span>
                      {isSw
                        ? "Daima uliza swali la usalama kila wakati wa kuingia"
                        : "Strict mode: require security question on every online login"}
                    </span>
                  </label>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => transitionToStep(1)}
                    className={`px-4 py-2.5 rounded-md border text-xs font-semibold cursor-pointer ${
                      isDark ? "border-slate-700 hover:bg-slate-800" : "border-[#E2E8F0] hover:bg-slate-50"
                    }`}
                  >
                    &larr; {isSw ? "Nyuma" : "Back"}
                  </button>
                  <button
                    type="button"
                    disabled={!step2Ready}
                    onClick={() => transitionToStep(3)}
                    className="px-6 py-2.5 rounded-md disabled:opacity-45 text-white text-xs font-semibold cursor-pointer transition-all"
                    style={{ backgroundColor: brandAccent }}
                  >
                    {isSw ? "Endelea Muonekano" : "Customize Brand Studio"} &rarr;
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: BRAND PERSONALIZATION & LOYALTY STUDIO */}
            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color: brandAccent }}>
                    {isSw ? "HATUA YA 03 · NEMBO & MUONEKANO WAKO" : "STEP 03 · MAKE IT YOURS"}
                  </div>
                  <h1 className="text-2xl font-bold" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                    {isSw ? "Binafsisha Kituo Chako" : "Personalize Your Workspace"}
                  </h1>
                  <p className={`text-xs mt-1 ${mutedCls}`}>
                    {isSw
                      ? "Weka nembo ya kampuni yako, rangi kuu, ukubwa wa maandishi, na mpangilio wa dashibodi."
                      : "Upload your business logo and pick your signature accent, typography size, theme, and layout."}
                  </p>
                </div>

                {/* Company Logo Upload */}
                <div
                  className={`rounded-md border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isDark ? "bg-slate-900/60 border-slate-800" : "bg-[#F8FAFC] border-[#E2E8F0]"
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="relative w-12 h-12 rounded-md border border-slate-200 bg-white overflow-hidden shrink-0">
                      <Image
                        src={brandLogoUrl || "/cervos-company-logo-circular.svg"}
                        alt="Workspace Logo Preview"
                        fill
                        className="object-contain p-1"
                        unoptimized={Boolean(brandLogoUrl)}
                      />
                    </div>
                    <div>
                      <div className="text-xs font-bold">
                        {isSw ? "Nembo ya Biashara Yako" : "Company / Pharmacy Logo"}
                      </div>
                      <div className={`text-[11px] ${mutedCls}`}>
                        {brandLogoName || (isSw ? "PNG au JPG (si lazima)" : "Optional · Appears on your sidebar & receipts")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <label
                      className={`px-3.5 py-2 rounded-md border text-xs font-semibold cursor-pointer transition-colors ${
                        isDark
                          ? "border-slate-700 bg-slate-800 hover:bg-slate-700 text-white"
                          : "border-[#E2E8F0] bg-white hover:bg-slate-50 text-[#0F172A]"
                      }`}
                    >
                      {isSw ? "Chagua Nembo" : "Upload Logo"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        onChange={(e) => handleLogoUpload(e.target.files?.[0])}
                      />
                    </label>
                    {brandLogoUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setBrandLogoUrl("");
                          setBrandLogoName("");
                        }}
                        className="text-xs font-semibold text-rose-500 hover:underline cursor-pointer px-1"
                      >
                        {isSw ? "Ondoa" : "Reset"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Color Accent Swatches */}
                <div className="space-y-2">
                  <div className={`text-[11px] font-bold uppercase tracking-wider ${mutedCls}`}>
                    {isSw ? "Rangi Kuu ya Kituo" : "Signature Accent Color"}
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {ACCENT_SWATCHES.map((swatch) => {
                      const active = brandAccent === swatch.hex;
                      return (
                        <button
                          key={swatch.hex}
                          type="button"
                          onClick={() => setBrandAccent(swatch.hex)}
                          className={`px-3 py-2 rounded-md border text-xs font-semibold inline-flex items-center gap-2 cursor-pointer transition-all ${
                            active
                              ? isDark
                                ? "border-white bg-slate-800"
                                : "border-[#0F172A] bg-white shadow-2xs"
                              : isDark
                                ? "border-slate-800 bg-slate-900/50 text-slate-300"
                                : "border-[#E2E8F0] bg-[#F8FAFC] text-slate-600"
                          }`}
                        >
                          <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: swatch.hex }} />
                          <span>{swatch.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Font Size + Theme + Dashboard Layout */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <div className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${mutedCls}`}>
                      {isSw ? "Ukubwa wa Maandishi" : "Font Scale"}
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {(["compact", "standard", "large"] as const).map((fs) => (
                        <button
                          key={fs}
                          type="button"
                          onClick={() => setFontScale(fs)}
                          className={`py-2 rounded-md border text-[11px] font-semibold capitalize cursor-pointer ${
                            fontScale === fs
                              ? "text-white border-transparent"
                              : isDark
                                ? "border-slate-800 bg-slate-900/50 text-slate-400"
                                : "border-[#E2E8F0] bg-[#F8FAFC] text-slate-600"
                          }`}
                          style={fontScale === fs ? { backgroundColor: brandAccent } : undefined}
                        >
                          {fs}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${mutedCls}`}>
                      {isSw ? "Mandhari" : "Theme"}
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {(["light", "dark", "system"] as const).map((tp) => (
                        <button
                          key={tp}
                          type="button"
                          onClick={() => applyThemeChoice(tp)}
                          className={`py-2 rounded-md border text-[11px] font-semibold capitalize cursor-pointer ${
                            themePref === tp
                              ? "text-white border-transparent"
                              : isDark
                                ? "border-slate-800 bg-slate-900/50 text-slate-400"
                                : "border-[#E2E8F0] bg-[#F8FAFC] text-slate-600"
                          }`}
                          style={themePref === tp ? { backgroundColor: brandAccent } : undefined}
                        >
                          {tp}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${mutedCls}`}>
                      {isSw ? "Mpangilio" : "Dashboard Layout"}
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {(["balanced", "focus", "executive"] as const).map((lt) => (
                        <button
                          key={lt}
                          type="button"
                          onClick={() => setLayoutType(lt)}
                          className={`py-2 rounded-md border text-[11px] font-semibold capitalize cursor-pointer ${
                            layoutType === lt
                              ? "text-white border-transparent"
                              : isDark
                                ? "border-slate-800 bg-slate-900/50 text-slate-400"
                                : "border-[#E2E8F0] bg-[#F8FAFC] text-slate-600"
                          }`}
                          style={layoutType === lt ? { backgroundColor: brandAccent } : undefined}
                        >
                          {lt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => transitionToStep(2)}
                    className={`px-4 py-2.5 rounded-md border text-xs font-semibold cursor-pointer ${
                      isDark ? "border-slate-700 hover:bg-slate-800" : "border-[#E2E8F0] hover:bg-slate-50"
                    }`}
                  >
                    &larr; {isSw ? "Nyuma" : "Back"}
                  </button>
                  <button
                    type="button"
                    onClick={() => transitionToStep(4)}
                    className="px-6 py-2.5 rounded-md text-white text-xs font-semibold cursor-pointer transition-all"
                    style={{ backgroundColor: brandAccent }}
                  >
                    {isSw ? "Endelea Leseni" : "Continue to Permits"} &rarr;
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: SKIPPABLE CERTIFICATES WITH BESPOKE DROPZONE */}
            {step === 4 && (
              <div className="space-y-5">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#006875] mb-1">
                    {isSw ? "HATUA YA 04 · HIARI (UNAWEZA KURUKA)" : "STEP 04 · OPTIONAL (SKIPPABLE)"}
                  </div>
                  <h1 className="text-2xl font-bold" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                    {isSw ? "Vyeti na Leseni ya Biashara" : "Regulatory Certificates & Permits"}
                  </h1>
                  <p className={`text-xs sm:text-sm mt-1.5 leading-relaxed ${mutedCls}`}>
                    {isSw
                      ? "Ukiruka sasa, bado unaweza kutumia kaunta na kulipia kifurushi chako. Ufikiaji wa mtandao utafunguka ukishapakia cheti."
                      : "Skip for now to open local counter POS and subscription billing immediately. Live Cervos Network trade unlocks as soon as you attach your permit."}
                  </p>
                </div>

                <div
                  className={`rounded-md border p-5 space-y-4 ${
                    isDark ? "bg-slate-900/60 border-slate-800" : "bg-[#F8FAFC] border-[#E2E8F0]"
                  }`}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                        {isSw ? "Aina ya Cheti" : "Document Type"}
                      </label>
                      <select
                        value={docType}
                        onChange={(e) => setDocType(e.target.value)}
                        className={`w-full px-3 py-2 rounded-md border text-xs focus:outline-none ${inputBase}`}
                      >
                        <option value="Pharmacy Operating Permit">Pharmacy Operating Permit</option>
                        <option value="Wholesale Distribution Permit">Wholesale Distribution Permit</option>
                        <option value="Clinic Registration Certificate">Clinic Registration Certificate</option>
                        <option value="TIN / BRELA Business Certificate">TIN / BRELA Business Certificate</option>
                      </select>
                    </div>
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                        {isSw ? "Namba ya Leseni" : "License / Permit Number"}
                      </label>
                      <input
                        type="text"
                        value={licenseNumber}
                        onChange={(e) => setLicenseNumber(e.target.value)}
                        placeholder="e.g. PC-TZ-2026-0842"
                        className={`w-full px-3 py-2 rounded-md border text-xs focus:outline-none ${inputBase}`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1.5 ${mutedCls}`}>
                      {isSw ? "Pakia Cheti Chako" : "Attach Operating License"}
                    </label>
                    <CertificateDropzone
                      fileName={certificateFileName}
                      onFileSelect={setCertificateFileName}
                      isDark={isDark}
                      isSw={isSw}
                    />
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => transitionToStep(3)}
                    className={`px-4 py-2.5 rounded-md border text-xs font-semibold cursor-pointer ${
                      isDark ? "border-slate-700 hover:bg-slate-800" : "border-[#E2E8F0] hover:bg-slate-50"
                    }`}
                  >
                    &larr; {isSw ? "Nyuma" : "Back"}
                  </button>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => submitOnboarding(true)}
                      className={`px-5 py-2.5 rounded-md border text-xs font-semibold cursor-pointer ${
                        isDark ? "border-slate-700 hover:bg-slate-800 text-slate-200" : "border-[#E2E8F0] hover:bg-slate-50 text-[#0F172A]"
                      }`}
                    >
                      {isSw ? "Ruka Kwa Sasa" : "Skip For Now"}
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => submitOnboarding(false)}
                      className="px-6 py-2.5 rounded-md disabled:opacity-60 text-white text-xs font-bold cursor-pointer"
                      style={{ backgroundColor: brandAccent }}
                    >
                      {submitting
                        ? isSw
                          ? "Inahifadhi..."
                          : "Finishing..."
                        : isSw
                          ? "Kamilisha & Fungua Duka"
                          : "Verify & Open Workspace"}{" "}
                      &rarr;
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: TRIAL OR PAY CHOICE */}
            {step === 5 && (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold uppercase tracking-wider">
                    <IconCheck className="w-3.5 h-3.5 text-emerald-500" />
                    {isSw ? "Usajili Umekamilika!" : "Setup Complete!"}
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                    {isSw ? "Chagua Jinsi ya Kuanza" : "Choose How to Start"}
                  </h1>
                  <p className={`text-xs sm:text-sm max-w-md mx-auto ${mutedCls}`}>
                    {isSw
                      ? `Kituo cha ${centreName || fullName} kiko tayari. Unaweza kuanza mara moja kwa jaribio la siku 14 bure, au kulipa mpango kamili sasa.`
                      : `${centreName || fullName} is ready. You can dive in immediately with a 14-day free trial, or activate a full commercial plan now.`}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {/* OPTION A: FREE TRIAL */}
                  <div
                    onClick={() => {
                      try {
                        window.sessionStorage.setItem("cervos-just-logged-in", "1");
                      } catch {
                        // Ignore
                      }
                      router.push("/app");
                    }}
                    className={`rounded-xl border p-5 space-y-4 cursor-pointer transition-all hover:scale-[1.01] hover:shadow-lg relative flex flex-col justify-between ${
                      isDark ? "bg-slate-900/60 border-emerald-500/40 hover:border-emerald-500" : "bg-emerald-50/40 border-emerald-300 hover:border-emerald-500"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500 text-white">
                          {isSw ? "Inapendekezwa" : "Recommended"}
                        </span>
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {isSw ? "Siku 14 Bure" : "14 Days Free"}
                        </span>
                      </div>
                      <h3 className="text-base font-bold">
                        {isSw ? "Anza Jaribio Bure (Ruka Malipo)" : "Start 14-Day Free Trial (Skip Payment)"}
                      </h3>
                      <p className={`text-xs leading-relaxed ${mutedCls}`}>
                        {isSw
                          ? "Tumia mfumo wote: mauzo ya kaunta (POS), stoo na udhibiti wa dawa, risiti, na ripoti mara moja bila kutoa kadi wala malipo."
                          : "Explore full counter POS, inventory stock control, shift receipts, and business reports right now with zero upfront payment."}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer transition-colors text-center"
                    >
                      {isSw ? "Tumia Jaribio Bure Sasa ->" : "Use Free Trial Now ->"}
                    </button>
                  </div>

                  {/* OPTION B: PAY NOW */}
                  <div
                    onClick={() => {
                      try {
                        window.sessionStorage.setItem("cervos-just-logged-in", "1");
                      } catch {
                        // Ignore
                      }
                      router.push("/app/billing");
                    }}
                    className={`rounded-xl border p-5 space-y-4 cursor-pointer transition-all hover:scale-[1.01] hover:shadow-lg relative flex flex-col justify-between ${
                      isDark ? "bg-slate-900/60 border-slate-700 hover:border-[#1039B9]" : "bg-white border-[#E2E8F0] hover:border-[#1039B9]"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {isSw ? "Mpango Kamili" : "Full Plan"}
                        </span>
                        <span className="text-xs font-semibold" style={{ color: brandAccent }}>
                          {isSw ? "Kuanzia 45,000 TZS/mwezi" : "From 45,000 TZS/mo"}
                        </span>
                      </div>
                      <h3 className="text-base font-bold">
                        {isSw ? "Lipa & Washa Kituo Sasa" : "Choose Plan & Pay Now"}
                      </h3>
                      <p className={`text-xs leading-relaxed ${mutedCls}`}>
                        {isSw
                          ? "Lipa kupitia M-Pesa, Tigo Lipa au Benki. Fungua mtandao wa ununuzi wa jumla na vibali vya uhakiki bila kusubiri."
                          : "Activate full commercial licensing via M-Pesa, Tigo Lipa, or Bank. Unlocks wholesale B2B network ordering and verified status."}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="w-full py-2.5 px-4 rounded-lg text-white text-xs font-bold cursor-pointer transition-colors text-center"
                      style={{ backgroundColor: brandAccent }}
                    >
                      {isSw ? "Chagua Mpango & Lipa ->" : "Choose Plan & Pay ->"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <div className={`relative z-10 text-center text-[11px] ${mutedCls}`}>
        Cervos Workplace Onboarding &middot; {email}
      </div>
    </div>
  );
}
