"use client";

import { useState, type FormEvent } from "react";
import { hqSurfaceTokens } from "./hqSurface";
import ComplianceProofViewerModal from "./ComplianceProofViewerModal";
import type {
  HqFleetAccount,
  HqInvestigationCase,
  HqPrivacyReleaseRecord,
  HqProductAliasRecord,
  HqRecallRecord,
} from "./types";

interface HQCaseAndPrivacySectionProps {
  accounts?: HqFleetAccount[];
  recalls: HqRecallRecord[];
  cases: HqInvestigationCase[];
  privacyReleases: HqPrivacyReleaseRecord[];
  productAliases: HqProductAliasRecord[];
  mappedProductSharePct: number;
  onRunAction: (payload: Record<string, unknown>, successMessage: string) => Promise<boolean>;
  isDark: boolean;
  busy: boolean;
}

export default function HQCaseAndPrivacySection({
  accounts = [],
  recalls,
  cases,
  privacyReleases,
  productAliases,
  mappedProductSharePct,
  onRunAction,
  isDark,
  busy,
}: HQCaseAndPrivacySectionProps) {
  const t = hqSurfaceTokens(isDark);
  const [subTab, setSubTab] = useState<"proofs" | "recalls" | "cases" | "privacy" | "aliases">("proofs");
  const [proofFilter, setProofFilter] = useState<"all" | "uploaded" | "verified" | "unverified">("all");
  const [proofSearch, setProofSearch] = useState("");
  const [proofNotes, setProofNotes] = useState<Record<string, string>>({});
  const [inspectedProof, setInspectedProof] = useState<{
    org: HqFleetAccount;
    cert: HqFleetAccount["certificates"][number] | null;
  } | null>(null);

  // Recall Issue Form (populated purely from operator entry or quick-pick DB ProductMaster aliases)
  const [regRef, setRegRef] = useState("");
  const [innName, setInnName] = useState(productAliases[0]?.masterLabel ?? "");
  const [batchNo, setBatchNo] = useState("");

  // Investigation Case Form
  const [caseTitle, setCaseTitle] = useState("");
  const [caseCategory, setCaseCategory] = useState<HqInvestigationCase["category"]>("till_anomaly");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  // Privacy Release Form
  const [recipient, setRecipient] = useState("");
  const [project, setProject] = useState("");
  const [queryRegion, setQueryRegion] = useState("ALL");
  const [epsilon, setEpsilon] = useState(0.5);

  const handleIssueRecall = async (e: FormEvent) => {
    e.preventDefault();
    if (!regRef.trim() || !innName.trim()) return;
    const ok = await onRunAction(
      {
        action: "issue_recall",
        regulatorRef: regRef.trim(),
        innName: innName.trim(),
        batchNumber: batchNo.trim() || "AUTO",
      },
      `Issued TMDA recall ${regRef.trim()} & traced Lot lineage`
    );
    if (ok) setBatchNo("");
  };

  const handleCreateCase = async (e: FormEvent) => {
    e.preventDefault();
    if (caseTitle.trim().length < 4) return;
    const ok = await onRunAction(
      {
        action: "create_investigation_case",
        title: caseTitle.trim(),
        category: caseCategory,
      },
      `Opened investigation case: ${caseTitle.trim()}`
    );
    if (ok) setCaseTitle("");
  };

  const handlePrivacyRelease = async (e: FormEvent) => {
    e.preventDefault();
    await onRunAction(
      {
        action: "release_privacy_aggregate",
        recipient: recipient.trim(),
        project: project.trim(),
        region: queryRegion,
        epsilon,
      },
      `Evaluated privacy gateway query (${recipient.trim()})`
    );
  };

  return (
    <div className="space-y-5">
      {/* Top Sub-Navigation */}
      <section className={`p-5 flex flex-wrap items-center justify-between gap-3 ${t.panelCls}`}>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#1039B9] dark:text-sky-400">
            ONTOLOGY COMPLIANCE, LINEAGE &amp; PRIVACY
          </span>
          <h2 className="text-xl font-semibold tracking-tight mt-0.5" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
            Recalls, Counter-Fraud, Privacy Gateway &amp; ProductMaster
          </h2>
        </div>

        <div className={`inline-flex flex-wrap rounded-2xl p-1 gap-1 ${t.wellCls}`}>
          {(
            [
              { id: "proofs", label: `Compliance Proofs (${accounts.filter((a) => a.certificates.length > 0).length}/${accounts.length})` },
              { id: "recalls", label: `TMDA Recalls (${recalls.length})` },
              { id: "cases", label: `Case Board (${cases.length})` },
              { id: "privacy", label: `Privacy Gateway (${privacyReleases.length})` },
              { id: "aliases", label: `ProductMaster ${mappedProductSharePct}%` },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSubTab(item.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                subTab === item.id ? t.primaryBtnCls : t.mutedCls
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {/* SUBTAB 0: COMPLIANCE PROOFS & PERMIT VERIFICATION QUEUE */}
      {subTab === "proofs" && (
        <section className={`p-5 space-y-4 ${t.panelCls}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                Compliance Proof Review &amp; Verification
              </h3>
              <p className={`text-xs ${t.mutedCls}`}>
                Read and inspect operating permits uploaded by pharmacies, clinics, and suppliers, then mark them Verified or Unverified.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={proofSearch}
                onChange={(e) => setProofSearch(e.target.value)}
                placeholder="Search org, permit #, filename..."
                className={`h-8 px-3 rounded-full text-xs w-52 ${t.inputCls}`}
              />
              {(
                [
                  { id: "all", label: "All Orgs" },
                  { id: "uploaded", label: "Has Proofs" },
                  { id: "verified", label: "Verified" },
                  { id: "unverified", label: "Unverified" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setProofFilter(f.id)}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold cursor-pointer ${
                    proofFilter === f.id ? t.primaryBtnCls : t.pillCls
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {accounts
              .filter((org) => {
                if (proofFilter === "uploaded" && org.certificates.length === 0) return false;
                if (proofFilter === "verified" && org.verificationStatus !== "verified") return false;
                if (proofFilter === "unverified" && org.verificationStatus === "verified") return false;
                const q = proofSearch.trim().toLowerCase();
                if (!q) return true;
                return (
                  org.orgName.toLowerCase().includes(q) ||
                  org.fullName.toLowerCase().includes(q) ||
                  org.email.toLowerCase().includes(q) ||
                  org.region.toLowerCase().includes(q) ||
                  org.certificates.some(
                    (c) =>
                      c.licenseNumber.toLowerCase().includes(q) ||
                      c.fileName.toLowerCase().includes(q) ||
                      c.docType.toLowerCase().includes(q)
                  )
                );
              })
              .map((org) => {
                const draftNote = proofNotes[org.id] ?? "";
                return (
                  <div key={org.id} className={`p-4 space-y-3 text-xs ${t.wellCls}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-sm">{org.orgName}</div>
                        <div className={`text-[11px] ${t.mutedCls}`}>
                          {org.roleType} &middot; {org.fullName} &middot; {org.region}
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          org.verificationStatus === "verified"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        }`}
                      >
                        {org.verificationStatus === "verified" ? "Verified" : "Unverified"}
                      </span>
                    </div>

                    {org.certificates.length === 0 ? (
                      <div className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${t.cardBorderCls}`}>
                        <span className={t.mutedCls}>No permit document uploaded yet.</span>
                        <button
                          type="button"
                          onClick={() => setInspectedProof({ org, cert: null })}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${t.pillCls}`}
                        >
                          Inspect Record
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {org.certificates.map((cert) => {
                          const certStatus =
                            cert.status ??
                            (org.verificationStatus === "verified" ? "verified" : "pending");
                          return (
                            <div
                              key={cert.id}
                              className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 ${t.cardBorderCls}`}
                            >
                              <div className="min-w-0">
                                <div className="font-bold flex flex-wrap items-center gap-1.5">
                                  <span>{cert.docType}</span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold ${
                                      certStatus === "verified"
                                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                        : certStatus === "rejected"
                                          ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                                          : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                    }`}
                                  >
                                    {certStatus}
                                  </span>
                                </div>
                                <div className={`text-[11px] font-mono ${t.mutedCls}`}>
                                  {cert.licenseNumber} &middot; {cert.fileName} &middot; {cert.uploadedAt.slice(0, 10)}
                                </div>
                                {cert.reviewNote && (
                                  <div className={`text-[10px] italic mt-0.5 ${t.mutedCls}`}>
                                    Note: {cert.reviewNote}
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => setInspectedProof({ org, cert })}
                                className={`px-3 py-1 rounded-full text-[11px] font-semibold cursor-pointer shrink-0 ${t.primaryBtnCls}`}
                              >
                                View / Read Proof
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={draftNote}
                        onChange={(e) => setProofNotes((prev) => ({ ...prev, [org.id]: e.target.value }))}
                        placeholder="Optional compliance review note..."
                        className={`flex-1 min-w-[150px] h-8 px-2.5 rounded-lg text-xs ${t.inputCls}`}
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void onRunAction(
                            {
                              action: "toggle_network_verify",
                              accountId: org.id,
                              verified: true,
                              note: draftNote.trim() || undefined,
                            },
                            `Verified compliance proofs for ${org.orgName}`
                          )
                        }
                        className="h-8 px-3 rounded-full bg-emerald-600 text-white text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                      >
                        Mark Verified
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void onRunAction(
                            {
                              action: "toggle_network_verify",
                              accountId: org.id,
                              verified: false,
                              note: draftNote.trim() || undefined,
                            },
                            `Marked ${org.orgName} unverified`
                          )
                        }
                        className="h-8 px-3 rounded-full border border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-300 text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                      >
                        Mark Unverified
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {/* SUBTAB 1: TMDA RECALLS & LOT LINEAGE GRAPH */}
      {subTab === "recalls" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          <form onSubmit={handleIssueRecall} className={`xl:col-span-4 p-5 space-y-3 text-xs ${t.panelCls}`}>
            <h3 className="text-base font-semibold" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
              Issue TMDA Recall Notice
            </h3>
            <p className={t.mutedCls}>
              Matches across Lot -&gt; Branch HOLDS Lot -&gt; SaleLine SOLD_FROM Lot -&gt; Pseudonymous PatientRef.
            </p>
            <input
              type="text"
              value={regRef}
              onChange={(e) => setRegRef(e.target.value)}
              placeholder="Regulator Ref (e.g. TMDA-RCL-...)"
              required
              className={`w-full h-9 px-3 rounded-xl ${t.inputCls}`}
            />
            <input
              type="text"
              value={innName}
              onChange={(e) => setInnName(e.target.value)}
              placeholder="Medicine / INN Name"
              required
              className={`w-full h-9 px-3 rounded-xl ${t.inputCls}`}
            />
            {productAliases.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {Array.from(new Set(productAliases.map((a) => a.masterLabel))).slice(0, 4).map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setInnName(label)}
                    className={`px-2 py-0.5 rounded-full text-[10px] cursor-pointer ${t.wellCls}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <input
              type="text"
              value={batchNo}
              onChange={(e) => setBatchNo(e.target.value)}
              placeholder="Target Batch Number (optional)"
              className={`w-full h-9 px-3 rounded-xl font-mono ${t.inputCls}`}
            />
            <button
              type="submit"
              disabled={busy}
              className={`w-full h-10 rounded-full font-semibold cursor-pointer disabled:opacity-50 ${t.primaryBtnCls}`}
            >
              Trace Lineage &amp; Issue Recall
            </button>
          </form>

          <div className={`xl:col-span-8 p-5 space-y-3 ${t.panelCls}`}>
            <h3 className="text-base font-semibold" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
              Active Recall Lineage Graph ({recalls.length})
            </h3>
            {recalls.length === 0 ? (
              <div className={`p-6 text-center text-xs ${t.wellCls} ${t.mutedCls}`}>
                No recalls issued yet. Issue a TMDA check on the left to trace affected pharmacy branches.
              </div>
            ) : (
              recalls.map((rc) => (
                <div key={rc.id} className={`p-4 space-y-3 text-xs ${t.wellCls}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-[#1039B9] dark:text-sky-400 mr-2">
                        {rc.regulatorRef}
                      </span>
                      <span className="font-bold">{rc.innName}</span>
                      <span className={`ml-2 font-mono ${t.mutedCls}`}>Lot {rc.batchNumber}</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold uppercase text-[10px]">
                      {rc.state}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {rc.affectedBranches.map((ab) => (
                      <div key={ab.branchId} className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${t.cardBorderCls}`}>
                        <div>
                          <div className="font-semibold">{ab.orgName} &middot; {ab.branchName}</div>
                          <div className={`text-[10px] font-mono ${t.mutedCls}`}>
                            Holds {ab.qtyHeld} packs &middot; Sold {ab.unitsSold} &middot; {ab.patientRefsNotified} patient refs
                          </div>
                        </div>
                        {ab.quarantinedConfirmed ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                            Quarantined
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void onRunAction(
                                {
                                  action: "confirm_recall_quarantine",
                                  recallId: rc.id,
                                  branchId: ab.branchId,
                                },
                                `Quarantine confirmed for ${ab.branchName}`
                              )
                            }
                            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold cursor-pointer ${t.primaryBtnCls}`}
                          >
                            Confirm Quarantine
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 2: INVESTIGATION CASE BOARD & RED-TEAM MODE */}
      {subTab === "cases" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          <div className={`xl:col-span-4 p-5 space-y-4 text-xs ${t.panelCls}`}>
            <form onSubmit={handleCreateCase} className="space-y-3">
              <h3 className="text-base font-semibold" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                Open Counter-Fraud Case
              </h3>
              <input
                type="text"
                value={caseTitle}
                onChange={(e) => setCaseTitle(e.target.value)}
                placeholder="Case title (e.g. Controlled Rx cluster review)"
                required
                className={`w-full h-9 px-3 rounded-xl ${t.inputCls}`}
              />
              <select
                value={caseCategory}
                onChange={(e) => setCaseCategory(e.target.value as HqInvestigationCase["category"])}
                className={`w-full h-9 px-3 rounded-xl ${t.inputCls}`}
              >
                <option value="till_anomaly">Till Variance &amp; Void Anomaly</option>
                <option value="controlled_drug">Controlled-Drug Watch</option>
                <option value="counterfeit_diversion">Diversion &amp; Counterfeit Graph</option>
                <option value="escrow_dispute">Kasri Escrow Dispute</option>
              </select>
              <button
                type="submit"
                disabled={busy}
                className={`w-full h-10 rounded-full font-semibold cursor-pointer disabled:opacity-50 ${t.primaryBtnCls}`}
              >
                Create Case Record
              </button>
            </form>

            <div className={`pt-4 border-t ${t.subtleBorderCls} space-y-2`}>
              <div className="font-bold">Red-Team Synthetic Drill</div>
              <p className={t.mutedCls}>
                Runs automated adversarial checks in sandbox: expired lot sale block, idempotent sync replay, negative stock detection, and role clamp integrity.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void onRunAction(
                    { action: "run_red_team_drill" },
                    "Completed Red-Team adversarial verification drill"
                  )
                }
                className={`w-full h-9 rounded-full font-semibold cursor-pointer ${t.pillCls}`}
              >
                Execute Red-Team Audit
              </button>
            </div>
          </div>

          <div className={`xl:col-span-8 p-5 space-y-3 ${t.panelCls}`}>
            <h3 className="text-base font-semibold" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
              Investigation Case Board ({cases.length})
            </h3>
            {cases.map((c) => (
              <div key={c.id} className={`p-4 space-y-2.5 text-xs ${t.wellCls}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-sm">{c.title}</span>
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-[#1039B9]/12 text-[#1039B9] dark:text-sky-300 font-mono text-[10px] uppercase">
                      {c.category.replace(/_/g, " ")}
                    </span>
                  </div>
                  <span className="font-mono uppercase text-[10px] font-bold">{c.status}</span>
                </div>
                <div className={`text-[11px] font-mono ${t.mutedCls}`}>
                  Pinned: {c.pinnedEntities.join(", ")} &middot; Evidence events: {c.citedEventIds.length}
                </div>
                {c.notes.map((n) => (
                  <div key={n.id} className={`p-2 rounded-lg border text-[11px] ${t.cardBorderCls}`}>
                    <strong>{n.author}:</strong> {n.body}
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={noteDrafts[c.id] || ""}
                    onChange={(e) => setNoteDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                    placeholder="Add investigator note..."
                    className={`flex-1 h-8 px-3 rounded-lg ${t.inputCls}`}
                  />
                  <button
                    type="button"
                    disabled={busy || !(noteDrafts[c.id] || "").trim()}
                    onClick={() => {
                      const body = (noteDrafts[c.id] || "").trim();
                      void onRunAction(
                        { action: "add_case_note", caseId: c.id, body },
                        "Added case note"
                      ).then((ok) => {
                        if (ok) setNoteDrafts((d) => ({ ...d, [c.id]: "" }));
                      });
                    }}
                    className={`px-3 py-1 rounded-lg font-semibold cursor-pointer ${t.primaryBtnCls}`}
                  >
                    Save Note
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 3: PRIVACY OUTPUT GATEWAY */}
      {subTab === "privacy" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          <form onSubmit={handlePrivacyRelease} className={`xl:col-span-5 p-5 space-y-3 text-xs ${t.panelCls}`}>
            <h3 className="text-base font-semibold" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
              Privacy Gateway Query (k &gt;= 5 Enforced)
            </h3>
            <p className={t.mutedCls}>
              Rejects any output cell with fewer than 5 contributing orgs or over 50% single-org dominance, applies Laplace noise, and spends epsilon budget.
            </p>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Recipient organization"
              required
              className={`w-full h-9 px-3 rounded-xl ${t.inputCls}`}
            />
            <input
              type="text"
              value={project}
              onChange={(e) => setProject(e.target.value)}
              placeholder="Research / Sentinel Project"
              required
              className={`w-full h-9 px-3 rounded-xl ${t.inputCls}`}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={queryRegion}
                onChange={(e) => setQueryRegion(e.target.value)}
                placeholder="Region (or ALL)"
                className={`h-9 px-3 rounded-xl ${t.inputCls}`}
              />
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="2.0"
                value={epsilon}
                onChange={(e) => setEpsilon(Number(e.target.value))}
                className={`h-9 px-3 rounded-xl font-mono ${t.inputCls}`}
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className={`w-full h-10 rounded-full font-semibold cursor-pointer disabled:opacity-50 ${t.primaryBtnCls}`}
            >
              Execute Privacy-Gated Release
            </button>
          </form>

          <div className={`xl:col-span-7 p-5 space-y-3 ${t.panelCls}`}>
            <h3 className="text-base font-semibold" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
              Data Release Log (`data.release_made`)
            </h3>
            {privacyReleases.map((pr) => (
              <div key={pr.id} className={`p-3.5 text-xs flex flex-wrap items-center justify-between gap-2 ${t.wellCls}`}>
                <div>
                  <div className="font-bold">
                    {pr.recipient} &middot; {pr.project}
                  </div>
                  <div className={`text-[11px] ${t.mutedCls}`}>
                    {pr.querySummary} &middot; k={pr.contributingOrgsCount}/{pr.minGroupSize} &middot; max dominance{" "}
                    {pr.maxDominanceSharePct}% &middot; epsilon {pr.epsilonSpent}
                  </div>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    pr.status === "approved"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                  }`}
                >
                  {pr.status === "approved" ? `Released (${pr.budgetRemaining} left)` : "Blocked (Small Cell)"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 4: PRODUCTMASTER & ALIAS REVIEW QUEUE */}
      {subTab === "aliases" && (
        <section className={`p-5 space-y-3 ${t.panelCls}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                ProductMaster Entity Resolver ({mappedProductSharePct}% Stock Mapped)
              </h3>
              <p className={`text-xs ${t.mutedCls}`}>
                Exact barcode / normalized INN + fuzzy confidence matching. Middle-band names land here for quick verification.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {productAliases.map((al) => (
              <div key={al.id} className={`p-3.5 text-xs flex items-center justify-between gap-2 ${t.wellCls}`}>
                <div className="min-w-0">
                  <div className="font-bold truncate">{al.rawText}</div>
                  <div className={`text-[11px] ${t.mutedCls} truncate`}>
                    -&gt; {al.masterLabel} ({Math.round(al.confidence * 100)}% conf) &middot; {al.orgName}
                  </div>
                </div>
                {al.status === "review_queue" || al.status === "unresolved" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void onRunAction(
                        { action: "approve_product_alias", aliasId: al.id },
                        `Verified ProductMaster alias for ${al.rawText}`
                      )
                    }
                    className={`px-3 py-1 rounded-full text-[10px] font-semibold shrink-0 cursor-pointer ${t.primaryBtnCls}`}
                  >
                    Approve Link
                  </button>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold uppercase shrink-0">
                    {al.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      {inspectedProof && (
        <ComplianceProofViewerModal
          org={inspectedProof.org}
          certificate={inspectedProof.cert}
          isDark={isDark}
          busy={busy}
          onClose={() => setInspectedProof(null)}
          onVerifyDecision={async (verified, note, certificateId) => {
            const ok = await onRunAction(
              {
                action: "toggle_network_verify",
                accountId: inspectedProof.org.id,
                verified,
                certificateId,
                note: note || undefined,
              },
              verified
                ? `Verified compliance proof for ${inspectedProof.org.orgName}`
                : `Marked ${inspectedProof.org.orgName} unverified`
            );
            if (ok) setInspectedProof(null);
          }}
        />
      )}
    </div>
  );
}
