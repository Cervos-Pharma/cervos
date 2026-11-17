"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import AuthHelpModal from "@/components/AuthHelpModal";
import AuthStageVisuals, { type BusinessRole } from "@/components/AuthStageVisuals";
import FlipText from "@/components/FlipText";
import { IconCheck } from "@/components/LandingIcons";
import { authenticateWithPasskey, isPasskeySupported } from "@/lib/security/client-passkey";
import { useI18n } from "@/lib/i18n/context";
import { useWorkspaceTheme } from "@/lib/workspace/theme";

function AuthPageInner() {
  const { lang, setLang } = useI18n();
  const isSw = lang === "SW";
  const { isDark, toggleTheme } = useWorkspaceTheme();
  const router = useRouter();
  const searchParams = useSearchParams();

  const paramInitMode =
    searchParams.get("mode") === "signup" || Boolean(searchParams.get("role"))
      ? "signup"
      : "signin";

  // Tab & Onboarding Flow State
  const [mode, setMode] = useState<"signin" | "signup">(paramInitMode);
  const [signupStep, setSignupStep] = useState<number>(0); // 0=welcome, 1=name/email, 2=business, 3=region, 4=scale, 5=final form
  const [isFading, setIsFading] = useState(false);

  // User Form Values
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [sex, setSex] = useState<"female" | "male" | "prefer_not_to_say">("prefer_not_to_say");
  const [signupGeo, setSignupGeo] = useState<{ lat?: number; lng?: number; source: "gps" | "manual" }>({
    source: "manual",
  });
  const [geoSnappedNotice, setGeoSnappedNotice] = useState<string | null>(null);
  const [role, setRole] = useState<BusinessRole>(null);

  // Join Existing Organization State
  const [joinQuery, setJoinQuery] = useState("");
  const [joinRegionFilter, setJoinRegionFilter] = useState("all");
  const [joinRoleFilter, setJoinRoleFilter] = useState("all");
  const [orgDirectory, setOrgDirectory] = useState<
    Array<{ id: string; orgName: string; roleType: string; region: string; centres: Array<{ id: string; name: string }> }>
  >([]);
  const [selectedJoinOrgId, setSelectedJoinOrgId] = useState("");
  const [requestedRoleLabel, setRequestedRoleLabel] = useState("Counter Cashier");
  const [joinNote, setJoinNote] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [region, setRegion] = useState("Dar es Salaam");
  const [step3Answer, setStep3Answer] = useState("");
  const [step3Custom, setStep3Custom] = useState("");
  const [step4Answer, setStep4Answer] = useState("");
  const [step4Custom, setStep4Custom] = useState("");
  const [orgName, setOrgName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMismatch, setPasswordMismatch] = useState(false);

  // Sign-In Form & Submission State
  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");
  const [authDoneMsg, setAuthDoneMsg] = useState<string | null>(null);
  const [authErrorMsg, setAuthErrorMsg] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const [pairedOrg, setPairedOrg] = useState<{
    orgName: string;
    activeProfileName?: string;
    hasActiveProfile: boolean;
  } | null>(null);

  useEffect(() => {
    setPasskeyAvailable(isPasskeySupported());
    const switchOrg = searchParams.get("switch_org") === "1";
    const paramMode = searchParams.get("mode");
    if (paramMode === "signup" || Boolean(searchParams.get("role"))) return;
    fetch("/api/workspace/state?probe=1", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          d: {
            authenticated?: boolean;
            account?: { onboardingDone?: boolean; orgName?: string };
            activeProfile?: { displayName?: string } | null;
          } | null
        ) => {
          if (!d?.authenticated || !d.account?.onboardingDone) return;
          if (!switchOrg && !d.activeProfile) {
            router.replace("/app/gate?stage=profile");
            return;
          }
          setPairedOrg({
            orgName: d.account.orgName || "Cervos Workspace",
            activeProfileName: d.activeProfile?.displayName,
            hasActiveProfile: Boolean(d.activeProfile),
          });
        }
      )
      .catch(() => {
        // Ignore silent session check failure
      });
  }, [router, searchParams]);

  // Quiet background location snap when user reaches personal identity step (fallback cleanly to region)
  useEffect(() => {
    if (mode !== "signup" || signupStep !== 1 || geoSnappedNotice) return;
    const inferRegionFromCoords = (lat: number, lng: number) => {
      if (lat < -6.3 && lng > 38.7) return "Dar es Salaam";
      if (lat > -4.0 && lng > 36.0 && lng < 37.5) return "Arusha";
      if (lat > -3.2 && lng < 33.6) return "Mwanza";
      if (lat < -5.8 && lat > -6.5 && lng > 35.2 && lng < 36.2) return "Dodoma";
      return "Dar es Salaam";
    };
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const detected = inferRegionFromCoords(pos.coords.latitude, pos.coords.longitude);
          setRegion(detected);
          setSignupGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude, source: "gps" });
          setGeoSnappedNotice(
            isSw
              ? `Eneo limetambuliwa kwa utulivu (${detected}) kusaidia kupata taasisi za karibu.`
              : `Location noted quietly (${detected}) to surface nearby Cervos organizations. Adjustable anytime.`
          );
        },
        () => {
          setSignupGeo({ source: "manual" });
          setGeoSnappedNotice(
            isSw
              ? `Tunatumia mkoa wako (${region}) kwa utulivu kupanga taasisi za karibu.`
              : `Using your selected region (${region}) quietly to surface nearby workplaces.`
          );
        },
        { timeout: 3500, maximumAge: 600000 }
      );
    } else {
      setGeoSnappedNotice(
        isSw
          ? `Tunatumia mkoa wako (${region}) kwa utulivu.`
          : `Using region context (${region}) quietly to tailor setup.`
      );
    }
  }, [mode, signupStep, geoSnappedNotice, isSw, region]);

  // Load filtered organization directory when exploring existing Cervos workplaces
  useEffect(() => {
    if (mode !== "signup" || signupStep !== 6) return;
    const t = setTimeout(async () => {
      const qs = new URLSearchParams({
        q: joinQuery,
        region: joinRegionFilter,
        roleType: joinRoleFilter,
        preferredRegion: region,
      });
      const r = await fetch(`/api/workspace/orgs?${qs.toString()}`);
      if (r.ok) {
        const j = (await r.json()) as {
          organizations?: Array<{ id: string; orgName: string; roleType: string; region: string; centres: Array<{ id: string; name: string }> }>;
        };
        setOrgDirectory(j.organizations ?? []);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [mode, signupStep, joinQuery, joinRegionFilter, joinRoleFilter, region]);

  // Legal Modal State, Help Modal & Exit Confirmation Focus Card
  const [legalDoc, setLegalDoc] = useState<"terms" | "privacy" | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  useEffect(() => {
    if (!showExitConfirm && !legalDoc && !showHelpModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowExitConfirm(false);
        setLegalDoc(null);
        setShowHelpModal(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showExitConfirm, legalDoc, showHelpModal]);

  // Sync URL query params (?mode=signup | ?mode=signin | ?role=supplier) cleanly
  useEffect(() => {
    const paramMode = searchParams.get("mode");
    const paramRole = searchParams.get("role") as BusinessRole | null;
    if (paramMode === "signup" || paramRole) {
      setMode("signup");
    } else if (paramMode === "signin") {
      setMode("signin");
    }
    if (
      paramRole &&
      ["pharmacy", "supplier", "dispensary", "researcher", "investor", "other"].includes(paramRole)
    ) {
      setRole(paramRole);
    }
  }, [searchParams]);

  // Smooth step transition helper (un-rushed crossfade -> swap -> settle)
  const transitionToStep = (nextStep: number) => {
    setIsFading(true);
    setTimeout(() => {
      setSignupStep(nextStep);
      setIsFading(false);
    }, 260);
  };

  const switchMode = (nextMode: "signin" | "signup") => {
    setAuthDoneMsg(null);
    setIsFading(true);
    setTimeout(() => {
      setMode(nextMode);
      setSignupStep(0);
      setIsFading(false);
    }, 240);
  };

  const hideTopTabs = mode === "signup" && signupStep > 0;
  const isDarkLeftStage = mode === "signup" && role === "supplier";

  const roleOptions: Array<{ id: Exclude<BusinessRole, null>; label: string; sub: string }> = [
    {
      id: "pharmacy",
      label: isSw ? "Duka la Dawa (Pharmacy)" : "Pharmacy",
      sub: isSw ? "Mauzo ya kaunta & rafu" : "Retail counter & shelf stock",
    },
    {
      id: "supplier",
      label: isSw ? "Msambazaji (Supplier)" : "Supplier",
      sub: isSw ? "Ugavi wa jumla & ghala" : "Wholesale warehouse & fleet",
    },
    {
      id: "dispensary",
      label: isSw ? "Zahanati / Kliniki" : "Dispensary / Clinic",
      sub: isSw ? "Huduma ya wagonjwa" : "Patient care & clinical stock",
    },
    {
      id: "researcher",
      label: isSw ? "Mtafiti (Researcher)" : "Researcher",
      sub: isSw ? "Takwimu & afya ya jamii" : "Access & rotation insights",
    },
    {
      id: "investor",
      label: isSw ? "Mwekezaji (Investor)" : "Investor",
      sub: isSw ? "Ukuzi wa miundombinu" : "Network expansion & partners",
    },
    {
      id: "other",
      label: isSw ? "Nyingine (Other)" : "Other",
      sub: isSw ? "Taja aina ya shirika" : "Specify your organization",
    },
  ];

  const getCategoryQuestions = (selectedRole: BusinessRole) => {
    switch (selectedRole) {
      case "pharmacy":
        return {
          step3Eyebrow: isSw ? "MPANGILIO WA DUKA" : "COUNTER SETUP",
          step3Title: isSw ? "Unaendesha kaunta au matawi mangapi?" : "How many counters or branches do you run?",
          step3Options: isSw
            ? ["Duka 1 (Kaunta Moja)", "Matawi 2 - 4", "Matawi 5+ (Mtandao)", "Duka la Hospitali"]
            : ["Single Counter Pharmacy", "2 - 4 Branches", "5+ Branch Chain", "Hospital Outpatient Desk"],
          step3IsRegion: false,
          step4Eyebrow: isSw ? "KIPAUMBELE" : "DAY-ONE PRIORITY",
          step4Title: isSw ? "Unataka tuboreshe nini kwanza?" : "What matters most on day one?",
          step4Options: isSw
            ? [
                "Mauzo ya haraka bila mtandao",
                "Kuzuia hasara ya dawa zilizoisha",
                "Maagizo ya jumla kupitia Kasri\u2122",
                "Ulinganifu wa hesabu za zamu",
              ]
            : [
                "Offline counter checkout",
                "Stop expired stock losses",
                "Wholesale restocking via Kasri\u2122",
                "Shift & drawer cash tracking",
              ],
          orgPlaceholder: "e.g. Uzuri Care Pharmacy",
        };
      case "supplier":
        return {
          step3Eyebrow: isSw ? "MAENEO YA UGAVI" : "DELIVERY COVERAGE",
          step3Title: isSw ? "Magari yako yanahudumia ukanda upi?" : "Which corridors do your vans serve?",
          step3Options: isSw
            ? [
                "Dar es Salaam & Pwani",
                "Kaskazini (Arusha / Moshi / Tanga)",
                "Ziwa & Kati (Mwanza / Dodoma)",
                "Tanzania Nzima + Zanzibar",
              ]
            : [
                "Dar es Salaam & Coast",
                "Northern Corridor (Arusha / Kilimanjaro)",
                "Lake & Central Zone",
                "Nationwide + Zanzibar",
              ],
          step3IsRegion: false,
          step4Eyebrow: isSw ? "AINA YA MZIGO" : "SUPPLY FOCUS",
          step4Title: isSw ? "Mnauza bidhaa gani zaidi kwa jumla?" : "What is your primary catalog focus?",
          step4Options: isSw
            ? [
                "Dawa za cheti & za msingi",
                "Chanjo & mnyororo wa baridi",
                "Vifaa tiba & maabara",
                "Ugavi kamili wa jumla",
              ]
            : [
                "Essential prescription & generics",
                "Cold-chain & vaccines",
                "Diagnostics & surgical supplies",
                "Full-line wholesale distribution",
              ],
          orgPlaceholder: "e.g. Keko Wholesale Distributors",
        };
      case "dispensary":
        return {
          step3Eyebrow: isSw ? "HUDUMA YA WAGONJWA" : "CARE MODEL",
          step3Title: isSw ? "Kliniki yako inatoa huduma zipi?" : "What kind of clinic do you operate?",
          step3Options: isSw
            ? [
                "Zahanati ya Jamii",
                "Kliniki ya Mama na Mtoto",
                "Kituo cha Mabingwa",
                "Kliniki ya Mtaani (Outreach)",
              ]
            : [
                "Community Outpatient Clinic",
                "Maternal & Child Health",
                "Specialist Care Center",
                "Mobile Outreach Dispensary",
              ],
          step3IsRegion: false,
          step4Eyebrow: isSw ? "USALAMA WA MGONJWA" : "PATIENT FLOW",
          step4Title: isSw ? "Unahitaji msaada upi wa haraka?" : "Where do you want immediate relief?",
          step4Options: isSw
            ? [
                "Utoaji wa haraka wa maagizo (Rx)",
                "Uhakiki wa dozi & tarehe ya dawa",
                "Kujaza stoo ya wodi kwa urahisi",
                "Kumbukumbu safi za ziara za wagonjwa",
              ]
            : [
                "Fast patient prescription issue",
                "Safe dose & expiry verification",
                "Smooth ward-to-store refills",
                "Clean patient visit records",
              ],
          orgPlaceholder: "e.g. Kinondoni Family Clinic",
        };
      case "researcher":
        return {
          step3Eyebrow: isSw ? "WIGO WA UTAFITI" : "STUDY FOCUS",
          step3Title: isSw ? "Utafiti wako unalenga eneo lipi?" : "Which health topic fits your study?",
          step3Options: isSw
            ? [
                "Matumizi sahihi ya antibayotiki",
                "Upatikanaji wa dawa muhimu",
                "Uthabiti wa mnyororo wa ugavi",
                "Sera na takwimu za afya ya jamii",
              ]
            : [
                "Antimicrobial stewardship",
                "Essential medicine availability",
                "Regional supply resilience",
                "Public health policy & access",
              ],
          step3IsRegion: false,
          step4Eyebrow: isSw ? "RATIBA YA TAKWIMU" : "REPORTING CADENCE",
          step4Title: isSw ? "Unapendelea kupokea maarifa kwa muda gani?" : "Which cadence fits your team?",
          step4Options: isSw
            ? [
                "Muhtasari wa kila wiki",
                "Ripoti ya mwezi kikanda",
                "Takwimu za robo mwaka",
                "Ushirikiano wa utafiti maalum",
              ]
            : [
                "Weekly regional snapshots",
                "Monthly corridor briefs",
                "Quarterly cohort dataset",
                "Custom research partnership",
              ],
          orgPlaceholder: "e.g. Ifakara Health Research Unit",
        };
      case "investor":
        return {
          step3Eyebrow: isSw ? "LENGO LA UWEKEZAJI" : "MANDATE",
          step3Title: isSw ? "Mtazamo upi unakuvutia zaidi?" : "Which lens brings you to Cervos?",
          step3Options: isSw
            ? [
                "Miundombinu ya afya Afrika",
                "Malipo ya Kasri\u2122 & fintech ya afya",
                "Mtandao wa usambazaji wa baridi",
                "Ukuaji wa kibiashara kikanda",
              ]
            : [
                "East African health infrastructure",
                "Healthcare payments & Kasri\u2122",
                "Cold-chain & fleet expansion",
                "Growth-stage market scaling",
              ],
          step3IsRegion: false,
          step4Eyebrow: isSw ? "MAWASILIANO" : "NEXT CONVERSATION",
          step4Title: isSw ? "Ungependa kuanza kuangalia nini?" : "What would you like to review first?",
          step4Options: isSw
            ? [
                "Ukuaji wa vituo na mikoa",
                "Mzunguko wa mauzo & Kasri\u2122",
                "Mpango wa upanuzi Afrika Mashariki",
                "Mazungumzo na waanzilishi",
              ]
            : [
                "Active pharmacy & supplier traction",
                "Wholesale & Kasri\u2122 economics",
                "Regional expansion roadmap",
                "Direct founders briefing",
              ],
          orgPlaceholder: "e.g. Serengeti Health Ventures",
        };
      default:
        return {
          step3Eyebrow: isSw ? "ENEO" : "LOCATION",
          step3Title: isSw ? "Timu yenu ipo mkoa upi?" : "Where is your team primarily based?",
          step3Options: ["Dar es Salaam", "Arusha", "Mwanza", "Dodoma", "Zanzibar"],
          step3IsRegion: true,
          step4Eyebrow: isSw ? "USHIRIKIANO" : "COLLABORATION",
          step4Title: isSw ? "Mgependa kushirikiana vipi nasi?" : "How would you like to collaborate?",
          step4Options: isSw
            ? [
                "Kuunganisha huduma zetu",
                "Ufadhili wa programu za afya",
                "Majaribio ya taasisi",
                "Swali la jumla la ushirika",
              ]
            : [
                "Technical integration",
                "Health program sponsorship",
                "Institutional pilot",
                "General partnership inquiry",
              ],
          orgPlaceholder: "e.g. East Africa Health Trust",
        };
    }
  };

  const activeQuestions = getCategoryQuestions(role);

  const selectRole = (nextRole: Exclude<BusinessRole, null>) => {
    setRole(nextRole);
    const q = getCategoryQuestions(nextRole);
    if (q.step3IsRegion) {
      setRegion(q.step3Options[0] ?? "Dar es Salaam");
    }
    setStep3Answer(q.step3Options[0] ?? "");
    setStep4Answer(q.step4Options[0] ?? "");
  };

  const handleSignInSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthErrorMsg(null);
    setAuthBusy(true);
    try {
      const res = await fetch("/api/workspace/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "signin",
          identifier: signinEmail,
          password: signinPassword,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; redirectTo?: string; error?: string };
      if (!res.ok || !data.ok) {
        setAuthErrorMsg(data.error || (isSw ? "Imeshindikana kuingia." : "Unable to sign in."));
        return;
      }
      router.push(data.redirectTo || "/app/gate");
    } catch {
      setAuthErrorMsg(isSw ? "Hitilafu ya mtandao. Jaribu tena." : "Network error. Please retry.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handlePasskeySignIn = async () => {
    setAuthErrorMsg(null);
    setAuthBusy(true);
    const res = await authenticateWithPasskey({
      purpose: "login",
      email: signinEmail.trim() || undefined,
    });
    setAuthBusy(false);
    if (!res.ok) {
      setAuthErrorMsg(res.error || (isSw ? "Biometria haikufanikiwa." : "Passkey sign-in failed."));
      return;
    }
    router.push(res.redirectTo || "/app/gate");
  };

  const handleFinalSignUpSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthErrorMsg(null);
    if (password.length < 8) {
      setAuthErrorMsg(
        isSw
          ? "Neno la siri lazima liwe na herufi 8 au zaidi."
          : "Password must be at least 8 characters long."
      );
      return;
    }
    if (password !== confirmPassword) {
      setPasswordMismatch(true);
      return;
    }
    setPasswordMismatch(false);
    setAuthBusy(true);
    try {
      const res = await fetch("/api/workspace/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "signup",
          fullName,
          username: username.trim() || undefined,
          email,
          sex,
          signupGeo: { ...signupGeo, region },
          orgName,
          region,
          role: role ?? "pharmacy",
          customRole,
          lang,
          password,
          confirmPassword,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; redirectTo?: string; error?: string };
      if (!res.ok || !data.ok) {
        setAuthErrorMsg(
          data.error || (isSw ? "Imeshindikana kufungua akaunti." : "Could not create account.")
        );
        return;
      }
      router.push(data.redirectTo || "/app/onboarding");
    } catch {
      setAuthErrorMsg(isSw ? "Hitilafu ya mtandao. Jaribu tena." : "Network error. Please retry.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleRequestJoinSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthErrorMsg(null);
    if (!selectedJoinOrgId) {
      setAuthErrorMsg(isSw ? "Tafadhali chagua shirika kwanza." : "Select an organization first.");
      return;
    }
    if (password.length < 8) {
      setAuthErrorMsg(isSw ? "Neno la siri liwe angalau herufi 8." : "Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setPasswordMismatch(true);
      return;
    }
    setPasswordMismatch(false);
    setAuthBusy(true);
    try {
      const res = await fetch("/api/workspace/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request_join",
          targetAccountId: selectedJoinOrgId,
          fullName,
          username: username.trim() || undefined,
          email,
          sex,
          lang,
          region,
          signupGeo,
          requestedRoleLabel,
          note: joinNote,
          password,
          confirmPassword,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; redirectTo?: string; error?: string };
      if (!res.ok || !data.ok) {
        setAuthErrorMsg(data.error || "Could not submit join request.");
        return;
      }
      router.push(data.redirectTo || "/app/lounge");
    } catch {
      setAuthErrorMsg(isSw ? "Hitilafu ya mtandao." : "Network error. Please retry.");
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <div
      className={`relative min-h-screen lg:h-screen lg:overflow-hidden flex flex-col selection:bg-[#1039B9] selection:text-white antialiased transition-colors duration-300 ${
        isDark ? "bg-[#0B0F17] text-slate-100" : "bg-white text-[#0F172A]"
      }`}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Floating Free Top Navigation (Zero Enclosing Bar, Full Edge Bleed)*/}
      {/* Adapts gracefully over Dark Obsidian Stage on Desktop              */}
      {/* ------------------------------------------------------------------ */}
      <Link
        href="/"
        className={`fixed lg:absolute top-4 left-4 sm:top-6 sm:left-8 z-30 min-h-[44px] flex items-center gap-2.5 transition-colors duration-700 ${
          isDarkLeftStage ? "text-[#0F172A] lg:text-white" : "text-[#0F172A]"
        }`}
      >
        <div
          className={`relative w-8 h-8 rounded-full overflow-hidden bg-white transition-all duration-700 ${
            isDarkLeftStage
              ? "ring-1 ring-slate-200 lg:ring-white/30 shadow-md"
              : "ring-1 ring-slate-200 shadow-xs"
          }`}
        >
          <Image
            src="/cervos-company-logo-circular.svg"
            alt="Cervos Pharma"
            fill
            className="object-contain p-0.5"
            priority
          />
        </div>
        <span
          className="hidden min-[420px]:inline font-bold text-base tracking-tight"
          style={{ fontFamily: "Outfit, Inter, sans-serif" }}
        >
          Cervos Pharma
        </span>
      </Link>

      <div className="fixed lg:absolute top-3.5 right-3.5 sm:top-6 sm:right-8 z-30 flex flex-wrap items-center justify-end gap-1.5 sm:gap-2.5 max-w-[calc(100vw-4.5rem)] sm:max-w-none text-xs font-semibold">
        <button
          type="button"
          onClick={() => setShowHelpModal(true)}
          className={`min-h-[44px] sm:min-h-[36px] inline-flex items-center transition-colors cursor-pointer px-2.5 py-1.5 rounded-md ${
            isDark ? "text-slate-300 hover:text-[#38BDF8]" : "text-slate-600 hover:text-[#1039B9]"
          }`}
        >
          <FlipText text={isSw ? "Msaada" : "Help"} flipKey={lang} />
        </button>
        <Link
          href="/about"
          className={`hidden sm:inline-flex items-center min-h-[36px] transition-colors px-2 py-1.5 ${
            isDark ? "text-slate-300 hover:text-[#38BDF8]" : "text-slate-600 hover:text-[#1039B9]"
          }`}
        >
          <FlipText text={isSw ? "Kuhusu" : "About"} flipKey={lang} />
        </Link>

        {/* Sun / Moon System-Aware Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          title={isDark ? "Light mode" : "Dark mode"}
          className={`min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] sm:w-9 sm:h-9 rounded-md border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
            isDark
              ? "border-slate-700 bg-[#11161F]/90 text-amber-300 hover:border-slate-600"
              : "border-[#E2E8F0] bg-white/95 text-[#0F172A] hover:bg-slate-50 shadow-2xs"
          }`}
        >
          {isDark ? (
            <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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

        {/* Segmented Language Toggle (Visible Across Viewports Before Onboarding) */}
        <div
          className={`flex items-center rounded-md border p-0.5 text-[11px] font-bold backdrop-blur-xs shrink-0 ${
            isDark
              ? "bg-[#11161F]/90 border-slate-700"
              : "bg-slate-100/90 border-slate-200/70"
          }`}
        >
          <button
            type="button"
            onClick={() => setLang("EN")}
            className={`min-h-[40px] sm:min-h-[30px] px-2.5 py-1 rounded transition-all cursor-pointer ${
              !isSw
                ? isDark
                  ? "bg-[#1039B9] text-white"
                  : "bg-white text-[#0F172A] shadow-2xs"
                : isDark
                  ? "text-slate-400"
                  : "text-slate-500"
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLang("SW")}
            className={`min-h-[40px] sm:min-h-[30px] px-2.5 py-1 rounded transition-all cursor-pointer ${
              isSw
                ? isDark
                  ? "bg-[#1039B9] text-white"
                  : "bg-white text-[#0F172A] shadow-2xs"
                : isDark
                  ? "text-slate-400"
                  : "text-slate-500"
            }`}
          >
            SW
          </button>
        </div>

        {/* Floating Exit Trigger */}
        <button
          type="button"
          onClick={() => setShowExitConfirm(true)}
          className={`min-h-[44px] sm:min-h-[36px] inline-flex items-center gap-1.5 px-3 py-2 rounded-md border backdrop-blur-xs transition-all cursor-pointer shadow-2xs shrink-0 ${
            isDark
              ? "border-slate-700 bg-[#11161F]/90 text-slate-200 hover:bg-slate-800"
              : "border-[#E2E8F0] bg-white/90 hover:border-slate-300 hover:bg-slate-50 text-[#0F172A]"
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <FlipText text={isSw ? "Toka" : "Exit"} flipKey={lang} />
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Main 65% Visual Stage (Mobile Living Horizon / Desktop Left)       */}
      {/* ------------------------------------------------------------------ */}
      <main className="flex-1 min-h-0 flex flex-col lg:flex-row relative">
        {/* Visual Stage: Soft Horizon Background on mobile/small phones, Left 65% split on desktop */}
        <div className="fixed inset-0 z-0 pointer-events-none lg:pointer-events-auto lg:static lg:w-[65%] lg:h-full lg:border-r lg:border-[#E2E8F0]">
          <AuthStageVisuals
            mode={mode}
            role={role}
            customRoleLabel={customRole}
            lang={lang}
            isSw={isSw}
          />
          {/* Mobile Feathered Atmospheric Veil: crisp readable upper/form zone, visual peeks smoothly below */}
          <div
            className={`lg:hidden absolute inset-0 z-30 pointer-events-none transition-colors duration-700 ${
              isDarkLeftStage
                ? "bg-gradient-to-b from-white/95 via-white/88 to-[#09090B]/20"
                : "bg-gradient-to-b from-white/95 via-white/86 to-white/25"
            }`}
          />
        </div>

        {/* Interactive Form Column: Clean, Airy, Borderless on both Mobile & Desktop */}
        <div
          className={`relative z-10 w-full min-h-screen lg:min-h-0 lg:w-[35%] lg:h-full lg:overflow-y-auto flex flex-col justify-between pt-24 pb-6 px-4 sm:px-9 lg:pt-20 lg:pb-8 lg:px-10 transition-colors duration-300 ${
            isDark ? "bg-transparent lg:bg-[#0F141D] text-slate-100" : "bg-transparent lg:bg-white text-[#0F172A]"
          }`}
        >
          <div className="max-w-md w-full mx-auto flex-1 flex flex-col justify-center">
            <div>
            {/* Top Tab Toggle (Smoothly fades out once user proceeds past Sign Up Welcome) */}
            <div
              className={`transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                hideTopTabs
                  ? "opacity-0 max-h-0 overflow-hidden mb-0 pointer-events-none"
                  : "opacity-100 max-h-24 mb-6"
              }`}
            >
              <div
                className={`grid grid-cols-2 gap-1 p-1 rounded-md border ${
                  isDark ? "bg-[#11161F] border-slate-800" : "bg-[#F8FAFC] border-[#E2E8F0]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className={`min-h-[44px] py-2.5 px-3 rounded text-xs font-semibold transition-all cursor-pointer ${
                    mode === "signin"
                      ? "bg-[#1039B9] text-white shadow-xs"
                      : isDark
                        ? "text-slate-300 hover:text-white"
                        : "text-slate-600 hover:text-[#0F172A]"
                  }`}
                >
                  <FlipText text={isSw ? "Ingia" : "Sign In"} flipKey={lang} />
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className={`min-h-[44px] py-2.5 px-3 rounded text-xs font-semibold transition-all cursor-pointer ${
                    mode === "signup"
                      ? "bg-[#1039B9] text-white shadow-xs"
                      : isDark
                        ? "text-slate-300 hover:text-white"
                        : "text-slate-600 hover:text-[#0F172A]"
                  }`}
                >
                  <FlipText text={isSw ? "Anza Sasa" : "Get Started"} flipKey={lang} />
                </button>
              </div>
            </div>

            {/* Confirmation Screen (Ungated standalone completion) */}
            {authDoneMsg ? (
              <div className="animate-fade-in-scale py-6 text-center">
                <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-200 text-[#1039B9] flex items-center justify-center mx-auto mb-4">
                  <IconCheck className="w-6 h-6" />
                </div>
                <h2
                  className={`text-2xl font-bold mb-2 ${isDark ? "text-white" : "text-[#0F172A]"}`}
                  style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                >
                  <FlipText text={isSw ? "Tayari!" : "All Set"} flipKey={lang} />
                </h2>
                <p className={`text-sm leading-relaxed mb-8 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                  <FlipText text={authDoneMsg} flipKey={lang} mode="words" />
                </p>
                <div className="flex flex-col gap-3">
                  <Link
                    href="/"
                    className="w-full py-3 rounded bg-[#1039B9] hover:bg-[#0D2E94] text-white text-xs font-semibold text-center transition-all"
                  >
                    <FlipText text={isSw ? "Rudi Nyumbani" : "Back to Home"} flipKey={lang} />
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthDoneMsg(null);
                      setSignupStep(0);
                    }}
                    className="text-xs font-semibold text-slate-500 hover:text-[#1039B9]"
                  >
                    <FlipText text={isSw ? "Anza upya" : "Reset preview"} flipKey={lang} />
                  </button>
                </div>
              </div>
            ) : (
              /* Animated Content Wrapper */
              <div
                className={`transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isFading ? "opacity-0 translate-y-2.5 scale-[0.99]" : "opacity-100 translate-y-0 scale-100"
                }`}
              >
                {/* -------------------------------------------------------- */}
                {/* SIGN IN VIEW                                             */}
                {/* -------------------------------------------------------- */}
                {mode === "signin" && (
                  <form onSubmit={handleSignInSubmit} className="space-y-5">
                    {pairedOrg && (
                      <div
                        className={`p-3.5 rounded-lg border space-y-2.5 ${
                          isDark
                            ? "border-[#38BDF8]/30 bg-[#1039B9]/15"
                            : "border-[#1039B9]/25 bg-[#EFF6FF]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-[#1039B9] dark:text-[#38BDF8]">
                              {isSw ? "TAASISI IMEUNGANISHWA" : "PAIRED WORKSPACE"}
                            </div>
                            <div className={`text-xs font-bold truncate ${isDark ? "text-white" : "text-[#0F172A]"}`}>
                              {pairedOrg.orgName}
                              {pairedOrg.activeProfileName ? ` · ${pairedOrg.activeProfileName}` : ""}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href="/app/gate?stage=profile"
                            className="flex-1 min-h-[40px] px-3 py-2 rounded bg-[#1039B9] hover:bg-[#0D2E94] text-white text-xs font-semibold text-center flex items-center justify-center transition-colors"
                          >
                            {isSw ? "Fungua kwa PIN / Badili Wasifu" : "PIN Unlock / Switch Profile"} &rarr;
                          </Link>
                          {pairedOrg.hasActiveProfile && (
                            <Link
                              href="/app"
                              className={`min-h-[40px] px-3 py-2 rounded border text-xs font-semibold flex items-center justify-center transition-colors ${
                                isDark
                                  ? "border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500"
                                  : "border-[#E2E8F0] bg-white text-[#0F172A] hover:bg-slate-50"
                              }`}
                            >
                              {isSw ? "Endelea" : "Resume"}
                            </Link>
                          )}
                        </div>
                      </div>
                    )}

                    <div>
                      <h1
                        className={`text-2xl font-bold mb-1.5 ${isDark ? "text-white" : "text-[#0F172A]"}`}
                        style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                      >
                        <FlipText text={isSw ? "Karibu tena" : "Welcome back"} flipKey={lang} />
                      </h1>
                      <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        <FlipText
                          text={
                            isSw
                              ? "Ingia kwenye akaunti yako ya Cervos Pharma."
                              : "Sign in to your Cervos Pharma workspace."
                          }
                          flipKey={lang}
                          mode="words"
                        />
                      </p>
                    </div>

                    <div>
                      <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        <FlipText text={isSw ? "Jina la Mtumiaji au Barua Pepe" : "Username or Email"} flipKey={lang} />
                      </label>
                      <input
                        type="text"
                        required
                        autoComplete="username"
                        value={signinEmail}
                        onChange={(e) => setSigninEmail(e.target.value)}
                        placeholder="@amani, @baraka.mwenge or you@pharmacy.co.tz"
                        className={`w-full px-3.5 py-2.5 rounded border text-sm focus:outline-none transition-colors ${
                          isDark
                            ? "border-slate-700 bg-slate-900 text-white placeholder:text-slate-500 focus:border-[#38BDF8]"
                            : "border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] focus:border-[#1039B9] focus:bg-white"
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        <FlipText text={isSw ? "Neno la Siri au PIN" : "Password or PIN"} flipKey={lang} />
                      </label>
                      <input
                        type="password"
                        required
                        autoComplete="current-password"
                        value={signinPassword}
                        onChange={(e) => setSigninPassword(e.target.value)}
                        placeholder={isSw ? "Neno la siri au PIN ya tarakimu 4-6" : "Password or 4-6 digit PIN"}
                        className={`w-full px-3.5 py-2.5 rounded border text-sm focus:outline-none transition-colors ${
                          isDark
                            ? "border-slate-700 bg-slate-900 text-white placeholder:text-slate-500 focus:border-[#38BDF8]"
                            : "border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] focus:border-[#1039B9] focus:bg-white"
                        }`}
                      />
                    </div>

                    {authErrorMsg && (
                      <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                        {authErrorMsg}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={authBusy}
                      className="w-full min-h-[44px] py-3 rounded bg-[#1039B9] hover:bg-[#0D2E94] disabled:opacity-60 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
                    >
                      <FlipText
                        text={authBusy ? (isSw ? "Inaingia..." : "Signing in...") : (isSw ? "Ingia" : "Sign In")}
                        flipKey={lang}
                      />
                    </button>

                    {passkeyAvailable && (
                      <button
                        type="button"
                        disabled={authBusy}
                        onClick={handlePasskeySignIn}
                        className={`w-full min-h-[44px] py-2.5 rounded border text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                          isDark
                            ? "border-slate-700 hover:border-[#38BDF8] bg-slate-900 text-slate-100"
                            : "border-[#E2E8F0] hover:border-[#1039B9] bg-white text-[#0F172A]"
                        }`}
                      >
                        <svg className="w-4 h-4 text-[#1039B9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a7.464 7.464 0 01-1.15 3.993m1.989 3.559A11.209 11.209 0 008.25 10.5a3.75 3.75 0 117.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 01-3.6 9.75m6.633-4.596a18.666 18.666 0 01-2.485 5.33"
                          />
                        </svg>
                        <span>{isSw ? "Ingia kwa Biometria / Passkey" : "Sign in with Passkey / Biometrics"}</span>
                      </button>
                    )}

                    <div className="pt-1 text-center text-xs text-slate-500 flex flex-wrap items-center justify-center gap-1">
                      <FlipText text={isSw ? "Mgeni hapa?" : "New to Cervos Pharma?"} flipKey={lang} />
                      <button
                        type="button"
                        onClick={() => switchMode("signup")}
                        className="min-h-[44px] px-2 inline-flex items-center font-semibold text-[#1039B9] hover:underline cursor-pointer"
                      >
                        <FlipText text={isSw ? "Jiunge sasa" : "Join the family"} flipKey={lang} />
                      </button>
                    </div>

                    {process.env.NEXT_PUBLIC_MOCK_MODE === "true" && (
                      <div className="pt-4 mt-4 border-t border-slate-100 space-y-2.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {isSw ? "Njia Fupi ya Majaribio (Kwa Jina)" : "Direct Username Login Preview"}
                        </div>
                        <div className="grid grid-cols-1 gap-2.5">
                          <button
                            type="button"
                            onClick={async () => {
                              setSigninEmail("@amani");
                              setSigninPassword("8429");
                              setAuthErrorMsg(null);
                              setAuthBusy(true);
                              try {
                                const res = await fetch("/api/workspace/auth", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    action: "signin",
                                    identifier: "amani",
                                    pin: "8429",
                                  }),
                                });
                                const data = (await res.json()) as { ok?: boolean; redirectTo?: string };
                                if (res.ok && data.ok) {
                                  router.push(data.redirectTo || "/app?scope=all");
                                }
                              } finally {
                                setAuthBusy(false);
                              }
                            }}
                            className="w-full min-h-[44px] py-2.5 px-3.5 rounded-lg bg-[#F8FAFC] hover:bg-blue-50/70 border border-[#E2E8F0] text-[11px] font-semibold text-[#0F172A] text-left flex items-center justify-between gap-2 transition-colors cursor-pointer"
                          >
                            <span>Owner (@amani + PIN 8429) &rarr; All Branches</span>
                            <span className="text-[#1039B9] shrink-0">&rarr;</span>
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              setSigninEmail("@baraka.mwenge");
                              setSigninPassword("6194");
                              setAuthErrorMsg(null);
                              setAuthBusy(true);
                              try {
                                const res = await fetch("/api/workspace/auth", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    action: "signin",
                                    identifier: "baraka.mwenge",
                                    pin: "6194",
                                  }),
                                });
                                const data = (await res.json()) as { ok?: boolean; redirectTo?: string };
                                if (res.ok && data.ok) {
                                  router.push(data.redirectTo || "/app?tab=operations");
                                }
                              } finally {
                                setAuthBusy(false);
                              }
                            }}
                            className="w-full min-h-[44px] py-2.5 px-3.5 rounded-lg bg-[#F8FAFC] hover:bg-emerald-50/70 border border-[#E2E8F0] text-[11px] font-semibold text-[#0F172A] text-left flex items-center justify-between gap-2 transition-colors cursor-pointer"
                          >
                            <span>Cashier (@baraka.mwenge + PIN 6194) &rarr; Counter POS</span>
                            <span className="text-emerald-600 shrink-0">&rarr;</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </form>
                )}

                {/* -------------------------------------------------------- */}
                {/* SIGN UP VIEW - CARD-BY-CARD GUIDED FLOW                   */}
                {/* -------------------------------------------------------- */}
                {mode === "signup" && (
                  <div>
                    {/* Step 0: Warm Welcome Screen + Prominent Language Choice */}
                    {signupStep === 0 && (
                      <div className="space-y-6">
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#1039B9] mb-2">
                            <FlipText text={isSw ? "KARIBU" : "WELCOME"} flipKey={lang} />
                          </div>
                          <h1
                            className={`text-2xl sm:text-3xl font-bold leading-snug mb-3 ${
                              isDark ? "text-white" : "text-[#0F172A]"
                            }`}
                            style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                          >
                            <FlipText
                              text={
                                isSw
                                  ? "Tunafurahi kukuona hapa."
                                  : "We're glad to have you here."
                              }
                              flipKey={lang}
                            />
                          </h1>
                          <p className={`text-sm leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                            <FlipText
                              mode="words"
                              text={
                                isSw
                                  ? "Unakaribia kujiunga na familia ya Cervos Pharma. Maswali machache mepesi yatatufanya tukuandalie mfumo unaokufaa kabisa."
                                  : "You're about to join the Cervos Pharma family. A few quick, simple questions will help us prepare your workspace for you."
                              }
                              flipKey={lang}
                            />
                          </p>
                        </div>

                        {/* Clear Language Choice Carried Into Onboarding */}
                        <div className="space-y-1.5">
                          <div className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            {isSw ? "Chagua Lugha ya Mfumo" : "Workspace Language"}
                          </div>
                          <div className="grid grid-cols-2 gap-2.5">
                            <button
                              type="button"
                              onClick={() => setLang("EN")}
                              className={`min-h-[44px] py-2.5 px-3.5 rounded-md border text-xs font-semibold text-left flex items-center justify-between transition-all cursor-pointer ${
                                !isSw
                                  ? "border-[#1039B9] bg-[#EFF6FF] text-[#1039B9]"
                                  : isDark
                                    ? "border-slate-700 bg-slate-900/60 text-slate-300"
                                    : "border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A]"
                              }`}
                            >
                              <span>English</span>
                              {!isSw && <IconCheck className="w-3.5 h-3.5 text-[#1039B9]" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => setLang("SW")}
                              className={`min-h-[44px] py-2.5 px-3.5 rounded-md border text-xs font-semibold text-left flex items-center justify-between transition-all cursor-pointer ${
                                isSw
                                  ? "border-[#1039B9] bg-[#EFF6FF] text-[#1039B9]"
                                  : isDark
                                    ? "border-slate-700 bg-slate-900/60 text-slate-300"
                                    : "border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A]"
                              }`}
                            >
                              <span>Kiswahili</span>
                              {isSw && <IconCheck className="w-3.5 h-3.5 text-[#1039B9]" />}
                            </button>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => transitionToStep(1)}
                          className="w-full min-h-[44px] py-3 rounded-md bg-[#1039B9] hover:bg-[#0D2E94] text-white text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <FlipText text={isSw ? "Endelea" : "Proceed"} flipKey={lang} />
                          <span>&rarr;</span>
                        </button>
                      </div>
                    )}

                    {/* Step 1: Personal Identity + Sex + Quiet Location Context */}
                    {signupStep === 1 && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          transitionToStep(10);
                        }}
                        className="space-y-4"
                      >
                        <div className="text-[11px] font-bold uppercase tracking-widest text-[#1039B9]">
                          01 &middot; <FlipText text={isSw ? "UTAMBULISHO" : "ABOUT YOU"} flipKey={lang} />
                        </div>
                        <h2
                          className="text-2xl font-bold text-[#0F172A]"
                          style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                        >
                          <FlipText
                            text={isSw ? "Tuanze na taarifa zako binafsi." : "Tell us a little about yourself."}
                            flipKey={lang}
                          />
                        </h2>

                        {geoSnappedNotice && (
                          <div className="p-2.5 rounded-md bg-blue-50/80 border border-blue-200/70 text-[11px] text-slate-700 leading-snug">
                            {geoSnappedNotice}
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                              <FlipText text={isSw ? "Jina Kamili" : "Full Name"} flipKey={lang} />
                            </label>
                            <input
                              type="text"
                              required
                              value={fullName}
                              onChange={(e) => setFullName(e.target.value)}
                              placeholder="Amani Juma"
                              className="w-full px-3 py-2 rounded border border-[#E2E8F0] bg-[#F8FAFC] text-sm text-[#0F172A] focus:outline-none focus:border-[#1039B9] focus:bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                              <FlipText text={isSw ? "Jina la (@handle)" : "Username (@handle)"} flipKey={lang} />
                            </label>
                            <input
                              type="text"
                              value={username}
                              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                              placeholder="amani.juma"
                              className="w-full px-3 py-2 rounded border border-[#E2E8F0] bg-[#F8FAFC] text-sm font-mono text-[#0F172A] focus:outline-none focus:border-[#1039B9] focus:bg-white"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                            <FlipText text={isSw ? "Barua Pepe" : "Email Address"} flipKey={lang} />
                          </label>
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="amani@pharmacy.co.tz"
                            className="w-full px-3 py-2 rounded border border-[#E2E8F0] bg-[#F8FAFC] text-sm text-[#0F172A] focus:outline-none focus:border-[#1039B9] focus:bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                            <FlipText text={isSw ? "Jinsia" : "Sex"} flipKey={lang} />
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {(
                              [
                                { id: "female", label: isSw ? "Mwanamke" : "Female" },
                                { id: "male", label: isSw ? "Mwanaume" : "Male" },
                                { id: "prefer_not_to_say", label: isSw ? "Binafsi" : "Prefer not" },
                              ] as const
                            ).map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setSex(opt.id)}
                                className={`flex-1 min-w-[96px] min-h-[44px] py-2.5 px-3 rounded border text-xs font-semibold cursor-pointer transition-colors ${
                                  sex === opt.id
                                    ? "bg-[#EFF6FF] border-[#1039B9] text-[#1039B9]"
                                    : "bg-[#F8FAFC] border-[#E2E8F0] text-slate-600"
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 pt-1">
                          <button
                            type="button"
                            onClick={() => transitionToStep(0)}
                            aria-label="Back"
                            className="min-h-[44px] min-w-[48px] px-4 py-2.5 rounded border border-[#E2E8F0] text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                          >
                            &larr;
                          </button>
                          <button
                            type="submit"
                            className="flex-1 min-h-[44px] py-3 px-4 rounded bg-[#1039B9] hover:bg-[#0D2E94] text-white text-xs font-semibold transition-all cursor-pointer"
                          >
                            <FlipText text={isSw ? "Endelea" : "Continue"} flipKey={lang} /> &rarr;
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Step 10: Early Intelligent Fork (Existing Org Member vs New Org Setup) */}
                    {signupStep === 10 && (
                      <div className="space-y-5">
                        <div className="text-[11px] font-bold uppercase tracking-widest text-[#1039B9]">
                          02 &middot; <FlipText text={isSw ? "MUUNGANO WA KAZI" : "WORKPLACE CHECK"} flipKey={lang} />
                        </div>
                        <h2
                          className="text-2xl font-bold text-[#0F172A]"
                          style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                        >
                          <FlipText
                            text={
                              isSw
                                ? "Je, duka au shirika lako tayari lipo kwenye Cervos?"
                                : "Is your workplace already on Cervos Pharma?"
                            }
                            flipKey={lang}
                          />
                        </h2>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {isSw
                            ? "Ikiwa bosi au mmiliki wako tayari ana akaunti ya Cervos, tafuta shirika lake na uombe kujiunga moja kwa moja."
                            : "If your pharmacy or depot is already active on Cervos, find it in seconds and request staff access directly instead of building a duplicate account."}
                        </p>

                        <div className="space-y-2.5">
                          <button
                            type="button"
                            onClick={() => transitionToStep(6)}
                            className="w-full min-h-[48px] text-left p-4 rounded-lg border border-[#E2E8F0] hover:border-[#1039B9] bg-[#F8FAFC] hover:bg-[#EFF6FF] transition-all cursor-pointer"
                          >
                            <div className="text-xs font-bold text-[#0F172A]">
                              {isSw ? "Ndiyo, nitafute na nijiunge na shirika langu ->" : "Yes, search & join my existing workplace ->"}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {isSw
                                ? "Tuma ombi la kujiunga na usubiri uthibitisho wa mmiliki kwenye ukumbi."
                                : "Request access and wait in the Lounge while the Owner assigns your branch & PIN."}
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => transitionToStep(2)}
                            className="w-full min-h-[48px] text-left p-4 rounded-lg border border-[#E2E8F0] hover:border-[#1039B9] bg-white transition-all cursor-pointer"
                          >
                            <div className="text-xs font-bold text-[#0F172A]">
                              {isSw ? "Hapana, ninafungua shirika jipya kabisa ->" : "No, I am setting up a new organization ->"}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {isSw
                                ? "Chagua aina ya biashara yako na uanzishe vituo vyako mwenyewe."
                                : "Configure your pharmacy, supplier depot, or dispensary in 3 guided steps."}
                            </div>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => transitionToStep(1)}
                          className="min-h-[44px] px-4 py-2.5 rounded border border-[#E2E8F0] text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                        >
                          &larr; {isSw ? "Rudi" : "Back"}
                        </button>
                      </div>
                    )}

                    {/* Step 6: Search & Request Access to Existing Organization -> Lounge */}
                    {signupStep === 6 && (
                      <form onSubmit={handleRequestJoinSubmit} className="space-y-3.5">
                        <div className="text-[11px] font-bold uppercase tracking-widest text-[#1039B9]">
                          {isSw ? "TAFUTA SHIRIKA" : "FIND YOUR ORGANIZATION"}
                        </div>
                        <h2
                          className="text-xl font-bold text-[#0F172A]"
                          style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                        >
                          {isSw ? "Chagua mahali pako pa kazi" : "Search & request staff access"}
                        </h2>

                        <div className="grid grid-cols-2 sm:grid-cols-12 gap-2.5">
                          <input
                            type="search"
                            value={joinQuery}
                            onChange={(e) => setJoinQuery(e.target.value)}
                            placeholder={isSw ? "Tafuta jina au tawi..." : "Search org or branch..."}
                            className="col-span-2 sm:col-span-6 min-h-[44px] px-3 py-2 rounded border border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#0F172A]"
                          />
                          <select
                            value={joinRegionFilter}
                            onChange={(e) => setJoinRegionFilter(e.target.value)}
                            className="col-span-1 sm:col-span-3 min-h-[44px] px-2.5 py-2 rounded border border-[#E2E8F0] bg-[#F8FAFC] text-xs sm:text-[11px] text-[#0F172A]"
                          >
                            <option value="all">All Areas</option>
                            <option value="Dar es Salaam">Dar es Salaam</option>
                            <option value="Arusha">Arusha</option>
                            <option value="Mwanza">Mwanza</option>
                            <option value="Dodoma">Dodoma</option>
                          </select>
                          <select
                            value={joinRoleFilter}
                            onChange={(e) => setJoinRoleFilter(e.target.value)}
                            className="col-span-1 sm:col-span-3 min-h-[44px] px-2.5 py-2 rounded border border-[#E2E8F0] bg-[#F8FAFC] text-xs sm:text-[11px] text-[#0F172A]"
                          >
                            <option value="all">All Types</option>
                            <option value="pharmacy">Pharmacy</option>
                            <option value="supplier">Supplier</option>
                            <option value="dispensary">Clinic</option>
                          </select>
                        </div>

                        <div className="space-y-2 max-h-40 overflow-y-auto pr-0.5">
                          {orgDirectory.length === 0 ? (
                            <div className="p-3 rounded border border-[#E2E8F0] text-xs text-slate-500 text-center">
                              {isSw ? "Hakuna shirika lililopatikana." : "No matching organizations found yet."}
                            </div>
                          ) : (
                            orgDirectory.map((org) => (
                              <button
                                key={org.id}
                                type="button"
                                onClick={() => setSelectedJoinOrgId(org.id)}
                                className={`w-full min-h-[48px] p-3 rounded border text-left text-xs flex items-center justify-between gap-2 cursor-pointer ${
                                  selectedJoinOrgId === org.id
                                    ? "bg-[#EFF6FF] border-[#1039B9]"
                                    : "bg-[#F8FAFC] border-[#E2E8F0]"
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="font-bold text-[#0F172A] truncate">{org.orgName}</div>
                                  <div className="text-[10px] text-slate-500">
                                    {org.roleType.toUpperCase()} &middot; {org.region} &middot; {org.centres.length} branch(es)
                                  </div>
                                </div>
                                {selectedJoinOrgId === org.id && (
                                  <span className="text-[10px] font-bold text-[#1039B9] shrink-0">Selected</span>
                                )}
                              </button>
                            ))
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <input
                            type="text"
                            value={requestedRoleLabel}
                            onChange={(e) => setRequestedRoleLabel(e.target.value)}
                            placeholder="Requested role (e.g. Cashier)"
                            className="min-h-[44px] px-3 py-2 rounded border border-[#E2E8F0] bg-white text-xs text-[#0F172A]"
                          />
                          <input
                            type="text"
                            value={joinNote}
                            onChange={(e) => setJoinNote(e.target.value)}
                            placeholder="Optional shift/branch note"
                            className="min-h-[44px] px-3 py-2 rounded border border-[#E2E8F0] bg-white text-xs text-[#0F172A]"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <input
                            type="password"
                            required
                            minLength={8}
                            value={password}
                            onChange={(e) => {
                              setPassword(e.target.value);
                              setPasswordMismatch(false);
                              setAuthErrorMsg(null);
                            }}
                            placeholder="Create Password (8+ chars)"
                            className="min-h-[44px] px-3 py-2 rounded border border-[#E2E8F0] bg-white text-xs text-[#0F172A]"
                          />
                          <input
                            type="password"
                            required
                            minLength={8}
                            value={confirmPassword}
                            onChange={(e) => {
                              setConfirmPassword(e.target.value);
                              setPasswordMismatch(false);
                            }}
                            placeholder="Confirm Password"
                            className="min-h-[44px] px-3 py-2 rounded border border-[#E2E8F0] bg-white text-xs text-[#0F172A]"
                          />
                        </div>

                        {(passwordMismatch || authErrorMsg) && (
                          <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-[11px] text-rose-700 font-medium">
                            {passwordMismatch ? "Passwords do not match." : authErrorMsg}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2.5 pt-1">
                          <button
                            type="button"
                            onClick={() => transitionToStep(10)}
                            aria-label="Back"
                            className="min-h-[44px] min-w-[48px] px-4 py-2.5 rounded border border-[#E2E8F0] text-xs font-semibold text-slate-600 cursor-pointer"
                          >
                            &larr;
                          </button>
                          <button
                            type="submit"
                            disabled={authBusy || !selectedJoinOrgId}
                            className="flex-1 min-h-[44px] py-2.5 px-4 rounded bg-[#1039B9] hover:bg-[#0D2E94] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                          >
                            {authBusy
                              ? isSw ? "Inatuma Ombi..." : "Sending Request..."
                              : isSw ? "Tuma Ombi & Ingia Ukumbini ->" : "Send Request & Enter Lounge ->"}
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Step 2: Business Type Card (Morphs Left 65% Stage Live!) */}
                    {signupStep === 2 && (
                      <div className="space-y-5">
                        <div className="text-[11px] font-bold uppercase tracking-widest text-[#1039B9]">
                          02 / 04 &middot; <FlipText text={isSw ? "BIASHARA" : "YOUR ROLE"} flipKey={lang} />
                        </div>
                        <h2
                          className="text-2xl font-bold text-[#0F172A]"
                          style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                        >
                          <FlipText
                            text={isSw ? "Unawakilisha upande upi?" : "What describes your work?"}
                            flipKey={lang}
                          />
                        </h2>

                        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-2.5">
                          {roleOptions.map((opt) => {
                            const selected = role === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => selectRole(opt.id)}
                                className={`min-h-[56px] p-3.5 rounded-md border text-left transition-all cursor-pointer ${
                                  selected
                                    ? "border-[#1039B9] bg-[#EFF6FF] ring-1 ring-[#1039B9]"
                                    : "border-[#E2E8F0] bg-[#F8FAFC] hover:border-slate-300"
                                }`}
                              >
                                <div
                                  className={`text-xs font-bold mb-0.5 ${
                                    selected ? "text-[#1039B9]" : "text-[#0F172A]"
                                  }`}
                                >
                                  <FlipText text={opt.label} flipKey={lang} />
                                </div>
                                <div className="text-[10px] text-slate-500 leading-snug">
                                  <FlipText text={opt.sub} flipKey={lang} mode="words" />
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {/* Expandable Input if "Other" is clicked */}
                        {role === "other" && (
                          <div className="animate-fade-in-scale">
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                              <FlipText
                                text={isSw ? "Taja Aina ya Shirika" : "Tell us your role"}
                                flipKey={lang}
                              />
                            </label>
                            <input
                              type="text"
                              value={customRole}
                              onChange={(e) => setCustomRole(e.target.value)}
                              placeholder={
                                isSw
                                  ? "Mfano: Shirika la Afya / NGO"
                                  : "e.g. Health NGO / Insurance Partner"
                              }
                              className="w-full px-3.5 py-2.5 rounded border border-[#1039B9] bg-white text-sm text-[#0F172A] focus:outline-none"
                            />
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2.5 pt-2">
                          <button
                            type="button"
                            onClick={() => transitionToStep(10)}
                            aria-label="Back"
                            className="min-h-[44px] min-w-[48px] px-4 py-2.5 rounded border border-[#E2E8F0] text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                          >
                            &larr;
                          </button>
                          <button
                            type="button"
                            disabled={!role || (role === "other" && !customRole.trim())}
                            onClick={() => transitionToStep(3)}
                            className="flex-1 min-h-[44px] py-3 px-4 rounded bg-[#1039B9] hover:bg-[#0D2E94] disabled:opacity-45 text-white text-xs font-semibold transition-all cursor-pointer"
                          >
                            <FlipText text={isSw ? "Endelea" : "Proceed"} flipKey={lang} /> &rarr;
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Step 3: Category-Specific Primary Question */}
                    {signupStep === 3 && (
                      <div className="space-y-5">
                        <div className="text-[11px] font-bold uppercase tracking-widest text-[#1039B9]">
                          03 / 04 &middot; <FlipText text={activeQuestions.step3Eyebrow} flipKey={`${lang}-${role}`} />
                        </div>
                        <h2
                          className="text-2xl font-bold text-[#0F172A]"
                          style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                        >
                          <FlipText text={activeQuestions.step3Title} flipKey={`${lang}-${role}`} mode="words" />
                        </h2>

                        <div className="space-y-2.5">
                          {activeQuestions.step3Options.map((opt) => {
                            const currentVal = activeQuestions.step3IsRegion ? region : step3Answer;
                            const isSelected = currentVal === opt;
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => {
                                  setStep3Answer(opt);
                                  if (activeQuestions.step3IsRegion) setRegion(opt);
                                }}
                                className={`w-full min-h-[44px] p-3.5 rounded-md border text-left text-xs font-semibold flex items-center justify-between gap-2 transition-all cursor-pointer ${
                                  isSelected
                                    ? "border-[#1039B9] bg-[#EFF6FF] text-[#1039B9]"
                                    : isDark
                                      ? "border-slate-700 bg-slate-900/60 text-slate-200 hover:border-slate-500"
                                      : "border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] hover:border-slate-300"
                                }`}
                              >
                                <FlipText text={opt} flipKey={`${lang}-${role}`} />
                                {isSelected && <IconCheck className="w-4 h-4 text-[#1039B9] shrink-0" />}
                              </button>
                            );
                          })}

                          {!activeQuestions.step3IsRegion && (
                            <button
                              type="button"
                              onClick={() => setStep3Answer("__other__")}
                              className={`w-full min-h-[44px] p-3.5 rounded-md border text-left text-xs font-semibold flex items-center justify-between gap-2 transition-all cursor-pointer ${
                                step3Answer === "__other__"
                                  ? "border-[#1039B9] bg-[#EFF6FF] text-[#1039B9]"
                                  : isDark
                                    ? "border-slate-700 bg-slate-900/60 text-slate-200 hover:border-slate-500"
                                    : "border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] hover:border-slate-300"
                              }`}
                            >
                              <FlipText
                                text={isSw ? "Nyingine (Andika yako binafsi)" : "Other (Type your own)"}
                                flipKey={lang}
                              />
                              {step3Answer === "__other__" && <IconCheck className="w-4 h-4 text-[#1039B9] shrink-0" />}
                            </button>
                          )}
                        </div>

                        {step3Answer === "__other__" && !activeQuestions.step3IsRegion && (
                          <input
                            type="text"
                            autoFocus
                            value={step3Custom}
                            onChange={(e) => setStep3Custom(e.target.value)}
                            placeholder={isSw ? "Eleza hali au muundo wako..." : "Describe your setup or case..."}
                            className={`w-full px-3.5 py-2.5 rounded-md border text-xs focus:outline-none ${
                              isDark
                                ? "border-[#38BDF8] bg-slate-900 text-white"
                                : "border-[#1039B9] bg-white text-[#0F172A]"
                            }`}
                          />
                        )}

                        {activeQuestions.step3IsRegion && (
                          <input
                            type="text"
                            value={region}
                            onChange={(e) => {
                              setRegion(e.target.value);
                              setStep3Answer(e.target.value);
                            }}
                            placeholder={isSw ? "Au andika mkoa..." : "Or type city / region..."}
                            className="w-full px-3.5 py-2.5 rounded border border-[#E2E8F0] bg-[#F8FAFC] text-sm text-[#0F172A] focus:outline-none focus:border-[#1039B9] focus:bg-white"
                          />
                        )}

                        <div className="flex flex-wrap items-center gap-2.5 pt-2">
                          <button
                            type="button"
                            onClick={() => transitionToStep(2)}
                            aria-label="Back"
                            className="min-h-[44px] min-w-[48px] px-4 py-2.5 rounded border border-[#E2E8F0] text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                          >
                            &larr;
                          </button>
                          <button
                            type="button"
                            disabled={step3Answer === "__other__" && !step3Custom.trim()}
                            onClick={() => transitionToStep(4)}
                            className="flex-1 min-h-[44px] py-3 px-4 rounded bg-[#1039B9] hover:bg-[#0D2E94] disabled:opacity-45 text-white text-xs font-semibold transition-all cursor-pointer"
                          >
                            <FlipText text={isSw ? "Endelea" : "Proceed"} flipKey={lang} /> &rarr;
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Step 4: Category-Specific Focus / Priority Question */}
                    {signupStep === 4 && (
                      <div className="space-y-5">
                        <div className="text-[11px] font-bold uppercase tracking-widest text-[#1039B9]">
                          04 / 04 &middot; <FlipText text={activeQuestions.step4Eyebrow} flipKey={`${lang}-${role}`} />
                        </div>
                        <h2
                          className="text-2xl font-bold text-[#0F172A]"
                          style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                        >
                          <FlipText text={activeQuestions.step4Title} flipKey={`${lang}-${role}`} mode="words" />
                        </h2>

                        <div className="space-y-2.5">
                          {activeQuestions.step4Options.map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setStep4Answer(opt)}
                              className={`w-full min-h-[44px] p-3.5 rounded-md border text-left text-xs font-semibold flex items-center justify-between gap-2 transition-all cursor-pointer ${
                                step4Answer === opt
                                  ? "border-[#1039B9] bg-[#EFF6FF] text-[#1039B9]"
                                  : isDark
                                    ? "border-slate-700 bg-slate-900/60 text-slate-200 hover:border-slate-500"
                                    : "border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] hover:border-slate-300"
                              }`}
                            >
                              <FlipText text={opt} flipKey={`${lang}-${role}`} />
                              {step4Answer === opt && <IconCheck className="w-4 h-4 text-[#1039B9] shrink-0" />}
                            </button>
                          ))}

                          <button
                            type="button"
                            onClick={() => setStep4Answer("__other__")}
                            className={`w-full min-h-[44px] p-3.5 rounded-md border text-left text-xs font-semibold flex items-center justify-between gap-2 transition-all cursor-pointer ${
                              step4Answer === "__other__"
                                ? "border-[#1039B9] bg-[#EFF6FF] text-[#1039B9]"
                                : isDark
                                  ? "border-slate-700 bg-slate-900/60 text-slate-200 hover:border-slate-500"
                                  : "border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] hover:border-slate-300"
                            }`}
                          >
                            <FlipText
                              text={isSw ? "Nyingine (Andika hitaji lako)" : "Other (Type your own priority)"}
                              flipKey={lang}
                            />
                            {step4Answer === "__other__" && <IconCheck className="w-4 h-4 text-[#1039B9] shrink-0" />}
                          </button>
                        </div>

                        {step4Answer === "__other__" && (
                          <input
                            type="text"
                            autoFocus
                            value={step4Custom}
                            onChange={(e) => setStep4Custom(e.target.value)}
                            placeholder={isSw ? "Tuambie kipaumbele chako..." : "Tell us your day-one priority..."}
                            className={`w-full px-3.5 py-2.5 rounded-md border text-xs focus:outline-none ${
                              isDark
                                ? "border-[#38BDF8] bg-slate-900 text-white"
                                : "border-[#1039B9] bg-white text-[#0F172A]"
                            }`}
                          />
                        )}

                        <div className="flex flex-wrap items-center gap-2.5 pt-2">
                          <button
                            type="button"
                            onClick={() => transitionToStep(3)}
                            aria-label="Back"
                            className="min-h-[44px] min-w-[48px] px-4 py-2.5 rounded border border-[#E2E8F0] text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                          >
                            &larr;
                          </button>
                          <button
                            type="button"
                            disabled={step4Answer === "__other__" && !step4Custom.trim()}
                            onClick={() => transitionToStep(5)}
                            className="flex-1 min-h-[44px] py-3 px-4 rounded bg-[#1039B9] hover:bg-[#0D2E94] disabled:opacity-45 text-white text-xs font-semibold transition-all cursor-pointer"
                          >
                            <FlipText text={isSw ? "Kamilisha" : "Continue"} flipKey={lang} /> &rarr;
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Step 5: Warm "Wonderful!" Pre-Filled Setup Form */}
                    {signupStep === 5 && (
                      <form onSubmit={handleFinalSignUpSubmit} className="space-y-4">
                        <div className="p-3.5 rounded-md bg-[#EFF6FF] border border-blue-200/80 mb-2">
                          <div className="text-xs font-bold text-[#1039B9] mb-0.5">
                            <FlipText
                              text={
                                isSw
                                  ? `Safi sana, ${fullName || "Rafiki"}!`
                                  : `Wonderful, ${fullName || "friend"}!`
                              }
                              flipKey={lang}
                            />
                          </div>
                          <p className="text-[11px] text-slate-600 leading-snug">
                            <FlipText
                              mode="words"
                              text={
                                isSw
                                  ? "Maelezo machache tu ya mwisho ili kufungua akaunti yako."
                                  : "Just a few more details to finish setting up your account."
                              }
                              flipKey={lang}
                            />
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                              <FlipText text={isSw ? "Jina" : "Name"} flipKey={lang} />
                            </label>
                            <input
                              type="text"
                              required
                              value={fullName}
                              onChange={(e) => setFullName(e.target.value)}
                              className="w-full min-h-[44px] px-3 py-2 rounded border border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#0F172A] focus:outline-none focus:border-[#1039B9]"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                              <FlipText text={isSw ? "Mkoa" : "Region"} flipKey={lang} />
                            </label>
                            <input
                              type="text"
                              required
                              value={region}
                              onChange={(e) => setRegion(e.target.value)}
                              className="w-full min-h-[44px] px-3 py-2 rounded border border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#0F172A] focus:outline-none focus:border-[#1039B9]"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                            <FlipText text={isSw ? "Barua Pepe" : "Email"} flipKey={lang} />
                          </label>
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 rounded border border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#0F172A] focus:outline-none focus:border-[#1039B9]"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                            <FlipText
                              text={isSw ? "Jina la Biashara / Shirika" : "Business / Organization Name"}
                              flipKey={lang}
                            />
                          </label>
                          <input
                            type="text"
                            required
                            value={orgName}
                            onChange={(e) => setOrgName(e.target.value)}
                            placeholder={activeQuestions.orgPlaceholder}
                            className="w-full px-3 py-2 rounded border border-[#E2E8F0] bg-white text-xs text-[#0F172A] focus:outline-none focus:border-[#1039B9]"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                              <FlipText text={isSw ? "Unda Neno la Siri" : "Create Password (8+ chars)"} flipKey={lang} />
                            </label>
                            <input
                              type="password"
                              required
                              minLength={8}
                              value={password}
                              onChange={(e) => {
                                setPassword(e.target.value);
                                if (passwordMismatch) setPasswordMismatch(false);
                                if (authErrorMsg) setAuthErrorMsg(null);
                              }}
                              placeholder="••••••••"
                              className="w-full px-3 py-2 rounded border border-[#E2E8F0] bg-white text-xs text-[#0F172A] focus:outline-none focus:border-[#1039B9]"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                              <FlipText text={isSw ? "Thibitisha Neno la Siri" : "Confirm Password"} flipKey={lang} />
                            </label>
                            <input
                              type="password"
                              required
                              minLength={8}
                              value={confirmPassword}
                              onChange={(e) => {
                                setConfirmPassword(e.target.value);
                                if (passwordMismatch) setPasswordMismatch(false);
                              }}
                              placeholder="••••••••"
                              className={`w-full px-3 py-2 rounded border bg-white text-xs text-[#0F172A] focus:outline-none ${
                                passwordMismatch
                                  ? "border-rose-500 focus:border-rose-600"
                                  : password.length >= 8 && confirmPassword === password
                                    ? "border-emerald-500 focus:border-emerald-600"
                                    : "border-[#E2E8F0] focus:border-[#1039B9]"
                              }`}
                            />
                          </div>
                        </div>

                        {(passwordMismatch || authErrorMsg) && (
                          <p className="text-[11px] font-medium text-rose-600">
                            {authErrorMsg ||
                              (isSw
                                ? "Neno la siri halilingani. Tafadhali hakikisha."
                                : "Passwords do not match. Please verify.")}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2.5 pt-2">
                          <button
                            type="button"
                            onClick={() => transitionToStep(4)}
                            aria-label="Back"
                            className="min-h-[44px] min-w-[48px] px-4 py-2.5 rounded border border-[#E2E8F0] text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                          >
                            &larr;
                          </button>
                          <button
                            type="submit"
                            disabled={authBusy}
                            className="flex-1 min-h-[44px] py-2.5 px-4 rounded bg-[#1039B9] hover:bg-[#0D2E94] disabled:opacity-60 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
                          >
                            <FlipText
                              text={
                                authBusy
                                  ? isSw
                                    ? "Inafungua..."
                                    : "Creating Account..."
                                  : isSw
                                    ? "Fungua Akaunti"
                                    : "Create Account"
                              }
                              flipKey={lang}
                            />
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Quiet fallback link after tabs fade out */}
                    {hideTopTabs && (
                      <div className="mt-6 pt-4 border-t border-slate-100 text-center text-[11px] text-slate-400">
                        <button
                          type="button"
                          onClick={() => switchMode("signin")}
                          className="min-h-[44px] px-3 py-2 inline-flex items-center hover:text-[#1039B9] transition-colors cursor-pointer"
                        >
                          <FlipText
                            text={isSw ? "Tayari una akaunti? Ingia hapa" : "Already have an account? Sign in"}
                            flipKey={lang}
                          />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            </div>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* Bottom Legal & Visible Exit Strip                                */}
          {/* ---------------------------------------------------------------- */}
          <div className="pt-5 mt-6 border-t border-slate-200/70 lg:pt-8 lg:mt-8 lg:border-slate-100 flex flex-wrap items-center justify-between gap-2.5 text-[11px] text-slate-600 lg:text-slate-500">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setLegalDoc("terms")}
                className="min-h-[44px] sm:min-h-[32px] px-1.5 inline-flex items-center hover:text-[#1039B9] transition-colors cursor-pointer"
              >
                <FlipText text={isSw ? "Vigezo na Masharti" : "Terms & Conditions"} flipKey={lang} />
              </button>
              <button
                type="button"
                onClick={() => setLegalDoc("privacy")}
                className="min-h-[44px] sm:min-h-[32px] px-1.5 inline-flex items-center hover:text-[#1039B9] transition-colors cursor-pointer"
              >
                <FlipText text={isSw ? "Sera ya Faragha" : "Privacy Policy"} flipKey={lang} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowExitConfirm(true)}
              className="min-h-[44px] sm:min-h-[32px] px-2 inline-flex items-center font-semibold text-slate-700 hover:text-[#1039B9] transition-colors cursor-pointer"
            >
              <FlipText text={isSw ? "Toka Nyumbani" : "Exit"} flipKey={lang} /> &rarr;
            </button>
          </div>
        </div>
      </main>

      {/* Clean Legal Reader Modal (Terms & Privacy) */}
      {legalDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/70 backdrop-blur-xs"
          onClick={() => setLegalDoc(null)}
        >
          <div
            className="max-w-lg w-full bg-white rounded-xl border border-slate-200 p-7 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLegalDoc(null)}
              aria-label="Close"
              className="absolute top-3 right-3 w-11 h-11 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer"
            >
              x
            </button>
            <h3 className="text-lg font-bold text-[#0F172A] mb-3">
              {legalDoc === "terms"
                ? isSw ? "Vigezo na Masharti" : "Terms & Conditions"
                : isSw ? "Sera ya Faragha" : "Privacy Policy"}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-5">
              {legalDoc === "terms"
                ? isSw
                  ? "Cervos Pharma hutoa huduma ya programu kwa maduka ya dawa na wasambazaji halali kulingana na sheria na miongozo ya afya ya nchi husika."
                  : "Cervos Pharma provides counter dispensing and wholesale supply software strictly for licensed pharmacies, dispensaries, and authorized distributors."
                : isSw
                  ? "Taarifa zako za mauzo, wafanyakazi, na wagonjwa zinalindwa kwa usiri kamili na haziuzwi wala kutolewa nje ya duka lako."
                  : "All pharmacy inventory, transaction records, and business accounts remain strictly private and encrypted."}
            </p>
            <button
              type="button"
              onClick={() => setLegalDoc(null)}
              className="min-h-[44px] px-5 py-2.5 rounded bg-[#1039B9] text-white text-xs font-semibold cursor-pointer"
            >
              {isSw ? "Sawa" : "Got it"}
            </button>
          </div>
        </div>
      )}
      {/* ------------------------------------------------------------------ */}
      {/* Exit Confirmation Focus Card                                       */}
      {/* ------------------------------------------------------------------ */}
      {showExitConfirm && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowExitConfirm(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="max-w-sm w-full bg-white rounded-xl border border-[#E2E8F0] p-6 sm:p-7 shadow-2xl animate-stage-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="relative w-9 h-9 rounded-full overflow-hidden ring-1 ring-slate-200 bg-white shrink-0">
                <Image
                  src="/cervos-company-logo-circular.svg"
                  alt="Cervos Pharma"
                  fill
                  className="object-contain p-0.5"
                />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1039B9]">
                  Cervos Pharma
                </div>
                <h3
                  className="text-base font-bold text-[#0F172A]"
                  style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                >
                  <FlipText
                    text={isSw ? "Rudi ukurasa wa mwanzo?" : "Return to home page?"}
                    flipKey={lang}
                  />
                </h3>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-[#475569] leading-relaxed mb-6">
              <FlipText
                text={
                  isSw
                    ? "Je, una uhakika unataka kutoka hapa? Maendeleo ambayo hayajahifadhiwa kwenye fomu hii yatafutwa."
                    : "Are you sure you want to leave? Any unsaved details entered on this screen will be cleared."
                }
                flipKey={lang}
                mode="words"
              />
            </p>

            <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="min-h-[44px] px-4 py-2.5 rounded border border-[#E2E8F0] hover:bg-slate-50 text-xs font-semibold text-[#0F172A] transition-colors cursor-pointer"
              >
                <FlipText text={isSw ? "Baki Hapa" : "Stay Here"} flipKey={lang} />
              </button>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="min-h-[44px] px-4 py-2.5 rounded bg-[#1039B9] hover:bg-[#0D2E94] text-xs font-semibold text-white transition-colors shadow-xs cursor-pointer"
              >
                <FlipText text={isSw ? "Ndiyo, Ondoka" : "Yes, Go Home"} flipKey={lang} />
              </button>
            </div>
          </div>
        </div>
      )}

      <AuthHelpModal
        open={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        isSw={isSw}
        defaultEmail={email || signinEmail}
      />
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center text-xs text-slate-400">
          Loading...
        </div>
      }
    >
      <AuthPageInner />
    </Suspense>
  );
}
