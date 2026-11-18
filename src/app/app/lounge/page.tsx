"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { IconCheck, IconShield } from "@/components/LandingIcons";
import { useWorkspaceTheme } from "@/lib/workspace/theme";
import { useI18n } from "@/lib/i18n/context";

interface LoungeJoinRequest {
  id: string;
  targetAccountId: string;
  targetOrgName: string;
  requesterFullName: string;
  requesterUsername: string;
  requesterEmail: string;
  requesterSex: string;
  requesterLang: "EN" | "SW";
  requesterRegion: string;
  requestedRoleLabel?: string;
  note?: string;
  status: "pending" | "approved" | "declined" | "accepted";
  allocatedCentreId?: string;
  allocatedCentreName?: string;
  allocatedRole?: string;
  allocatedPinPreview?: string;
  declineReason?: string;
  createdAt: string;
  reviewedAt?: string;
}

interface DirectoryOrg {
  id: string;
  orgName: string;
  roleType: string;
  region: string;
  networkUnlocked: boolean;
  centres: Array<{ id: string; name: string; region: string }>;
}

interface HqUpdateItem {
  id: string;
  tag: string;
  title: string;
  swTitle: string;
  summary: string;
  swSummary: string;
  ctaLabel: string;
  ctaTarget: string;
  publishedAt: string;
}

interface LoungePayload {
  authenticated: boolean;
  joinRequest?: LoungeJoinRequest;
  organizations?: DirectoryOrg[];
  hqUpdates?: HqUpdateItem[];
}

export default function WorkspaceLoungePage() {
  const router = useRouter();
  const { isDark, toggleTheme } = useWorkspaceTheme();
  const { setLang: setI18nLang } = useI18n();

  const [data, setData] = useState<LoungePayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Declined recovery state
  const [orgSearch, setOrgSearch] = useState("");
  const [filteredOrgs, setFilteredOrgs] = useState<DirectoryOrg[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [reapplyRole, setReapplyRole] = useState("Counter Cashier");
  const [reapplyNote, setReapplyNote] = useState("");
  const [newOrgName, setNewOrgName] = useState("");

  const loadLounge = useCallback(async () => {
    const res = await fetch("/api/workspace/lounge", { cache: "no-store" });
    if (res.status === 401) {
      router.replace("/auth?mode=signin");
      return;
    }
    const json = (await res.json()) as LoungePayload;
    if (!json.authenticated || !json.joinRequest) {
      router.replace("/auth?mode=signin");
      return;
    }
    setData(json);
    setFilteredOrgs(json.organizations ?? []);
    if (json.joinRequest.requesterLang) {
      setI18nLang(json.joinRequest.requesterLang);
    }
  }, [router, setI18nLang]);

  useEffect(() => {
    loadLounge();
  }, [loadLounge]);

  useEffect(() => {
    if (!data?.joinRequest || data.joinRequest.status !== "declined") return;
    const t = setTimeout(async () => {
      const r = await fetch(
        `/api/workspace/orgs?q=${encodeURIComponent(orgSearch)}&preferredRegion=${encodeURIComponent(
          data.joinRequest?.requesterRegion || ""
        )}`
      );
      if (r.ok) {
        const j = (await r.json()) as { organizations?: DirectoryOrg[] };
        setFilteredOrgs(j.organizations ?? []);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [orgSearch, data?.joinRequest]);

  const handleAcceptAllocation = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/workspace/lounge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept_allocation" }),
      });
      const out = (await res.json()) as { ok?: boolean; redirectTo?: string; error?: string };
      if (!res.ok || !out.ok) {
        setErr(out.error || "Unable to complete workspace allocation.");
        return;
      }
      router.push(out.redirectTo || "/app");
    } finally {
      setBusy(false);
    }
  };

  const handleResubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId) return;
    setBusy(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch("/api/workspace/lounge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resubmit_request",
          targetAccountId: selectedOrgId,
          requestedRoleLabel: reapplyRole,
          note: reapplyNote,
        }),
      });
      const out = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !out.ok) {
        setErr(out.error || "Could not resend request.");
        return;
      }
      setNotice("New access request sent cleanly.");
      await loadLounge();
    } finally {
      setBusy(false);
    }
  };

  const handleConvertToCreateOrg = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/workspace/lounge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "convert_to_create_org", orgName: newOrgName }),
      });
      const out = (await res.json()) as { ok?: boolean; redirectTo?: string; error?: string };
      if (!res.ok || !out.ok) {
        setErr(out.error || "Unable to switch to organization setup.");
        return;
      }
      router.push(out.redirectTo || "/app/onboarding");
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    await fetch("/api/workspace/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "signout" }),
    });
    router.push("/auth?mode=signin");
  };

  if (!data?.joinRequest) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? "bg-[#090C12] text-white" : "bg-[#F4F5F7] text-[#111317]"}`}>
        <div className="w-8 h-8 rounded-full border-2 border-[#1039B9] border-t-transparent animate-spin" />
      </div>
    );
  }

  const req = data.joinRequest;
  const isSw = req.requesterLang === "SW";
  const updates = data.hqUpdates ?? [];
  const cardCls = isDark
    ? "bg-[#11161F]/95 border-slate-800 text-slate-100"
    : "bg-white border-[#EAECF0] text-[#111317] shadow-[0_8px_28px_rgba(15,23,42,0.04)]";
  const mutedCls = isDark ? "text-slate-400" : "text-slate-500";
  const chipCls = isDark ? "bg-[#171D28] border-slate-800 text-slate-200" : "bg-[#F8FAFC] border-[#E2E8F0] text-[#111317]";

  return (
    <div className={`min-h-screen transition-colors ${isDark ? "bg-[#090C12] text-slate-100" : "bg-[#F4F5F7] text-[#111317]"}`}>
      {/* Lounge Header */}
      <header className="max-w-6xl mx-auto px-4 sm:px-8 pt-4 sm:pt-5 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative h-8 w-8 shrink-0">
            <Image src="/logo.png" alt="Cervos" fill className="object-contain" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider text-[#1039B9] dark:text-[#38BDF8]">
              {isSw ? "Ukumbi wa Kusubiri · Cervos" : "Cervos Welcome Lounge"}
            </div>
            <div className="text-xs font-medium opacity-75 truncate">
              {req.requesterFullName} (@{req.requesterUsername}) &middot; {req.requesterRegion}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={loadLounge}
            className={`min-h-[44px] px-4 py-2 rounded-full border text-xs font-semibold inline-flex items-center justify-center cursor-pointer ${chipCls}`}
          >
            {isSw ? "Kagua Hali" : "Refresh Status"}
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className={`min-h-[44px] px-4 py-2 rounded-full border text-xs font-semibold inline-flex items-center justify-center cursor-pointer ${chipCls}`}
          >
            {isDark ? "Light" : "Dark"}
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="min-h-[44px] px-4 py-2 rounded-full border border-rose-500/30 text-rose-500 text-xs font-semibold inline-flex items-center justify-center cursor-pointer"
          >
            {isSw ? "Ondoka" : "Sign Out"}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {notice && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-600">
            {notice}
          </div>
        )}
        {err && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs font-semibold text-rose-500">
            {err}
          </div>
        )}

        {/* ============================================================ */}
        {/* STATUS CARD: APPROVED (EXCITED WELCOME + ACCEPT ALLOCATION)  */}
        {/* ============================================================ */}
        {req.status === "approved" && (
          <section
            className={`rounded-[28px] border p-5 sm:p-9 space-y-5 animate-stage-pop ${isDark
              ? "bg-gradient-to-br from-emerald-950/60 via-[#11161F] to-[#11161F] border-emerald-700/60"
              : "bg-gradient-to-br from-emerald-50 via-white to-[#F0FDF4] border-emerald-300 shadow-lg"
              }`}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E2F575] text-[#111317] text-[11px] font-bold">
              <IconCheck className="w-3.5 h-3.5" />
              <span>{isSw ? "OMBI LIMEKUBALIWA!" : "ACCESS APPROVED & PROVISIONED!"}</span>
            </div>

            <div className="space-y-2 max-w-2xl">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                {isSw
                  ? `Hongera ${req.requesterFullName}! Umeongezwa ${req.targetOrgName}.`
                  : `You're in, ${req.requesterFullName}! ${req.targetOrgName} allocated your seat.`}
              </h1>
              <p className={`text-sm ${mutedCls}`}>
                {isSw
                  ? "Mmiliki amepanga kituo chako, jukumu lako na PIN ya kaunta. Kubali hapa chini kuingia moja kwa moja kazini."
                  : "Your Organization Owner assigned your branch, operational role, and Counter PIN. Confirm below to launch straight into your provisioned workspace."}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
              <div className={`p-4 rounded-2xl border ${chipCls}`}>
                <div className={`text-[10px] uppercase font-bold ${mutedCls}`}>Assigned Branch</div>
                <div className="text-sm font-bold mt-0.5">{req.allocatedCentreName}</div>
              </div>
              <div className={`p-4 rounded-2xl border ${chipCls}`}>
                <div className={`text-[10px] uppercase font-bold ${mutedCls}`}>Provisioned Role</div>
                <div className="text-sm font-bold capitalize mt-0.5">
                  {(req.allocatedRole || "staff").replace(/_/g, " ")}
                </div>
              </div>
              <div className={`p-4 rounded-2xl border ${chipCls}`}>
                <div className={`text-[10px] uppercase font-bold ${mutedCls}`}>Login Handle &amp; Counter PIN</div>
                <div className="text-sm font-mono font-bold mt-0.5">
                  @{req.requesterUsername} &middot; PIN {req.allocatedPinPreview || "Set"}
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={handleAcceptAllocation}
              className="w-full sm:w-auto min-h-[44px] px-7 py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md cursor-pointer transition-transform hover:scale-[1.01]"
            >
              {busy
                ? isSw ? "Inafungua..." : "Provisioning Workspace..."
                : isSw ? "Kubali & Ingia Kazini ->" : "Accept Allocation & Enter Workspace ->"}
            </button>
          </section>
        )}

        {/* ============================================================ */}
        {/* STATUS CARD: PENDING CONFIRMATION                            */}
        {/* ============================================================ */}
        {req.status === "pending" && (
          <section className={`rounded-[28px] border p-5 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 ${cardCls}`}>
            <div className="space-y-3 max-w-2xl">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 text-[11px] font-bold">
                <IconShield className="w-3.5 h-3.5" />
                <span>{isSw ? "INASUBIRI UTHIBITISHO WA MMILIKI" : "AWAITING OWNER CONFIRMATION"}</span>
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                {isSw
                  ? `Ombi lako la kujiunga na ${req.targetOrgName} limetumwa.`
                  : `Request sent to ${req.targetOrgName}. Hang tight cleanly!`}
              </h1>
              <p className={`text-xs sm:text-sm leading-relaxed ${mutedCls}`}>
                {isSw
                  ? `Ukithibitishwa na mmiliki, ukiingia tena na @${req.requesterUsername} utapewa PIN yako na kituo chako mara moja.`
                  : `As soon as the Owner approves and assigns your branch & role, your next sign-in with @${req.requesterUsername} will reveal your Counter PIN right here.`}
              </p>
              <div className="flex flex-wrap gap-2 text-xs pt-1">
                <span className={`px-3 py-1 rounded-full border ${chipCls}`}>
                  Target: <strong>{req.targetOrgName}</strong>
                </span>
                {req.requestedRoleLabel && (
                  <span className={`px-3 py-1 rounded-full border ${chipCls}`}>
                    Role Note: <strong>{req.requestedRoleLabel}</strong>
                  </span>
                )}
                <span className={`px-3 py-1 rounded-full border ${chipCls}`}>
                  Location: <strong>{req.requesterRegion}</strong>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap lg:flex-col gap-2.5 w-full lg:w-auto shrink-0">
              <button
                type="button"
                onClick={loadLounge}
                className="flex-1 lg:flex-initial min-h-[44px] px-5 py-2.5 rounded-full bg-[#1039B9] hover:bg-[#0D2E94] text-white text-xs font-semibold inline-flex items-center justify-center cursor-pointer"
              >
                {isSw ? "Angalia Kama Limekubaliwa" : "Check Approval Status"}
              </button>
              <Link href="/" className={`flex-1 lg:flex-initial min-h-[44px] px-5 py-2.5 rounded-full border text-xs font-semibold inline-flex items-center justify-center text-center ${chipCls}`}>
                {isSw ? "Soma Kuhusu Cervos" : "Tour Cervos Platform"}
              </Link>
            </div>
          </section>
        )}

        {/* ============================================================ */}
        {/* STATUS CARD: DECLINED (SEARCH ANOTHER ORG OR CREATE NEW)     */}
        {/* ============================================================ */}
        {req.status === "declined" && (
          <section className={`rounded-[28px] border p-5 sm:p-7 space-y-6 ${cardCls}`}>
            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full bg-rose-500/15 text-rose-500 text-[11px] font-bold">
                REQUEST NOT CONFIRMED
              </span>
              <h1 className="text-2xl font-bold" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                {req.targetOrgName} could not confirm this access request yet
              </h1>
              <p className={`text-xs ${mutedCls}`}>{req.declineReason}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <form onSubmit={handleResubmit} className={`lg:col-span-7 p-5 rounded-2xl border space-y-3 ${chipCls}`}>
                <div className="text-xs font-bold">Search &amp; Request Another Cervos Organization</div>
                <input
                  type="search"
                  value={orgSearch}
                  onChange={(e) => setOrgSearch(e.target.value)}
                  placeholder="Search organization or region..."
                  className={`w-full px-3.5 py-2 rounded-xl border text-xs ${isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"}`}
                />
                <div className="space-y-1.5 max-h-44 overflow-y-auto">
                  {filteredOrgs.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setSelectedOrgId(o.id)}
                      className={`w-full min-h-[48px] p-3.5 rounded-xl border text-left text-xs flex items-center justify-between gap-3 cursor-pointer ${selectedOrgId === o.id
                        ? "border-[#1039B9] bg-blue-500/10"
                        : isDark ? "border-slate-800 bg-slate-900/50" : "border-slate-200 bg-white"
                        }`}
                    >
                      <div>
                        <div className="font-bold">{o.orgName}</div>
                        <div className={`text-[10px] ${mutedCls}`}>
                          {o.roleType.toUpperCase()} &middot; {o.region} &middot; {o.centres.length} branch(es)
                        </div>
                      </div>
                      {selectedOrgId === o.id && <span className="text-[#1039B9] font-bold text-xs shrink-0">Selected</span>}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    value={reapplyRole}
                    onChange={(e) => setReapplyRole(e.target.value)}
                    placeholder="Requested role"
                    className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs ${isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"}`}
                  />
                  <input
                    type="text"
                    value={reapplyNote}
                    onChange={(e) => setReapplyNote(e.target.value)}
                    placeholder="Optional note"
                    className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs ${isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"}`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!selectedOrgId || busy}
                  className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-full bg-[#1039B9] text-white text-xs font-semibold disabled:opacity-45 cursor-pointer"
                >
                  Send New Request &rarr;
                </button>
              </form>

              <form onSubmit={handleConvertToCreateOrg} className={`lg:col-span-5 p-5 rounded-2xl border flex flex-col justify-between gap-3 ${chipCls}`}>
                <div className="space-y-2">
                  <div className="text-xs font-bold">Start Your Own Organization Instead</div>
                  <p className={`text-[11px] ${mutedCls}`}>
                    Convert @{req.requesterUsername} straight into an Owner account and launch your own dispensary or supplier depot.
                  </p>
                  <input
                    type="text"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder={`${req.requesterFullName} Pharmacy`}
                    className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl border text-xs ${isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"}`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full min-h-[44px] py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Create New Organization &rarr;
                </button>
              </form>
            </div>
          </section>
        )}

        {/* ============================================================ */}
        {/* CERVOS HQ UPDATES & PLATFORM SHOWCASE ("SELL CERVOS")        */}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <div className={`lg:col-span-7 rounded-[26px] border p-6 space-y-4 ${cardCls}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#1039B9] dark:text-[#38BDF8]">
                  CERVOS HQ DISPATCH
                </div>
                <h2 className="text-lg font-bold mt-0.5" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                  {isSw ? "Masasisho & Uwezo Mpya wa Cervos" : "Platform Updates & What Cervos Solves"}
                </h2>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-[#E2F575] text-[#111317] text-[10px] font-bold">
                HQ Verified
              </span>
            </div>

            <div className="space-y-3">
              {updates.map((u) => (
                <div key={u.id} className={`p-4 rounded-2xl border space-y-1.5 ${chipCls}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-500/15 text-[#1039B9] dark:text-[#38BDF8] text-[9px] font-bold">
                      {u.tag}
                    </span>
                    <span className={`font-mono text-[10px] ${mutedCls}`}>{u.publishedAt.slice(0, 10)}</span>
                  </div>
                  <div className="text-sm font-bold">{isSw ? u.swTitle : u.title}</div>
                  <p className={`text-xs leading-relaxed ${mutedCls}`}>{isSw ? u.swSummary : u.summary}</p>
                </div>
              ))}
            </div>
          </div>

          <div className={`lg:col-span-5 rounded-[26px] border overflow-hidden flex flex-col justify-between ${cardCls}`}>
            <div className="relative h-52 w-full">
              <Image src="/cervos-hardware-desktop.jpg" alt="Cervos Offline Desktop" fill className="object-cover" />
            </div>
            <div className="p-6 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-500">
                BUILT FOR TANZANIA PHARMACIES
              </div>
              <h3 className="text-base font-bold">
                Expiry Safety, Kasri Escrow &amp; Seamless Offline Continuity
              </h3>
              <p className={`text-xs leading-relaxed ${mutedCls}`}>
                From instant barcode intake to zero-variance evening shift closeouts and real-time multi-branch visibility, every station stays protected even without internet.
              </p>
              <div className="flex flex-wrap gap-2.5 pt-1">
                <Link href="/features" className="min-h-[44px] px-4 py-2.5 rounded-full bg-[#1039B9] text-white text-xs font-semibold inline-flex items-center justify-center">
                  Explore Capabilities &rarr;
                </Link>
                <Link href="/pricing" className={`min-h-[44px] px-4 py-2.5 rounded-full border text-xs font-semibold inline-flex items-center justify-center ${chipCls}`}>
                  View Plans
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
