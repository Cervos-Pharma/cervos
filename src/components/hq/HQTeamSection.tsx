"use client";

import { useState, type FormEvent } from "react";
import { HQ_ROLE_METADATA, type HqWorkerCapabilities, type HqWorkerRole } from "@/lib/hq-workers";
import { CERVOS_HQ_ASSETS, hqSurfaceTokens } from "./hqSurface";
import type { HqCurrentSessionWorker, HqTeamNoteItem, HqWorkerSummary } from "./types";

interface HQTeamSectionProps {
  gateSlug: string;
  workers: HqWorkerSummary[];
  notes: HqTeamNoteItem[];
  currentWorker?: HqCurrentSessionWorker;
  onRunAction: (
    payload: Record<string, unknown>,
    successMessage: string
  ) => Promise<boolean>;
  onRefresh: () => Promise<void>;
  isDark: boolean;
  busy: boolean;
}

const HQ_ROLES: HqWorkerRole[] = [
  "support_specialist",
  "finance_controller",
  "compliance_auditor",
  "editorial_growth",
  "hq_master",
];

const TOPIC_STYLE: Record<HqTeamNoteItem["topic"], string> = {
  shift_handoff: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  escalation: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  directive: "bg-amber-500/18 text-amber-700 dark:text-amber-300",
  general: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
};

const CAPABILITY_LABELS: Array<{ key: keyof HqWorkerCapabilities; label: string }> = [
  { key: "canAnswerSupport", label: "Support Desk" },
  { key: "canManageOnboarding", label: "Onboarding & Joins" },
  { key: "canManageBillingEscrow", label: "Escrow & Billing" },
  { key: "canManagePackages", label: "Plan Pricing" },
  { key: "canManageFleetLocks", label: "Locks & Audit" },
  { key: "canPublishEditorial", label: "Dispatch Journal" },
  { key: "canBroadcastComms", label: "SMS & Broadcasts" },
];

export default function HQTeamSection({
  gateSlug,
  workers,
  notes,
  currentWorker,
  onRunAction,
  onRefresh,
  isDark,
  busy,
}: HQTeamSectionProps) {
  const t = hqSurfaceTokens(isDark);
  const isMaster = Boolean(currentWorker?.capabilities?.canManageHqTeam || currentWorker?.isMaster);

  // Master invite form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<HqWorkerRole>("support_specialist");
  const [title, setTitle] = useState("");
  const [region, setRegion] = useState("Dar es Salaam HQ");
  const [createBusy, setCreateBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [issuedInvite, setIssuedInvite] = useState<{
    name: string;
    email: string;
    inviteCode: string;
    url: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Collaborative team feed form
  const [noteTopic, setNoteTopic] = useState<HqTeamNoteItem["topic"]>("shift_handoff");
  const [targetWorkerId, setTargetWorkerId] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [pinNote, setPinNote] = useState(false);

  const buildInviteUrl = (targetEmail: string, code: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://cervos.online";
    return `${origin}/ops-v9k4m/${encodeURIComponent(gateSlug)}?invite=${encodeURIComponent(code)}&email=${encodeURIComponent(targetEmail)}`;
  };

  const handleOnboardWorker = async (e: FormEvent) => {
    e.preventDefault();
    if (!isMaster) return;
    setCreateBusy(true);
    setFormErr(null);
    setIssuedInvite(null);
    try {
      const res = await fetch("/api/ops-v9k4m/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Ops-Gate": gateSlug },
        body: JSON.stringify({
          action: "create_hq_worker",
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          role,
          title: title.trim() || undefined,
          region: region.trim() || undefined,
        }),
      });
      const out = (await res.json()) as {
        ok?: boolean;
        error?: string;
        inviteCode?: string;
        worker?: HqWorkerSummary;
      };
      if (!res.ok || !out.ok || !out.inviteCode || !out.worker) {
        setFormErr(out.error || "Could not create HQ worker invite.");
        return;
      }
      setIssuedInvite({
        name: out.worker.name,
        email: out.worker.email,
        inviteCode: out.inviteCode,
        url: buildInviteUrl(out.worker.email, out.inviteCode),
      });
      setName("");
      setEmail("");
      setPhone("");
      setTitle("");
      await onRefresh();
    } catch {
      setFormErr("Network failure inviting HQ worker.");
    } finally {
      setCreateBusy(false);
    }
  };

  const handleRegenerateInvite = async (worker: HqWorkerSummary) => {
    setCreateBusy(true);
    setFormErr(null);
    try {
      const res = await fetch("/api/ops-v9k4m/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Ops-Gate": gateSlug },
        body: JSON.stringify({
          action: "update_hq_worker",
          workerId: worker.id,
          regenerateInvite: true,
        }),
      });
      const out = (await res.json()) as { ok?: boolean; error?: string; inviteCode?: string };
      if (!res.ok || !out.ok || !out.inviteCode) {
        setFormErr(out.error || "Could not rotate invite code.");
        return;
      }
      setIssuedInvite({
        name: worker.name,
        email: worker.email,
        inviteCode: out.inviteCode,
        url: buildInviteUrl(worker.email, out.inviteCode),
      });
      await onRefresh();
    } finally {
      setCreateBusy(false);
    }
  };

  const copyText = async (label: string, val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedKey(label);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // Clipboard fallback omitted
    }
  };

  const handlePostNote = async (e: FormEvent) => {
    e.preventDefault();
    if (noteBody.trim().length < 3) return;
    const ok = await onRunAction(
      {
        action: "post_hq_team_note",
        topic: noteTopic,
        targetWorkerId: targetWorkerId || undefined,
        body: noteBody.trim(),
        pinned: pinNote,
      },
      "Posted update to HQ Shift Handoff Desk"
    );
    if (ok) {
      setNoteBody("");
      setPinNote(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Showcase Banner with Cervos Logos & Real People Assets */}
      <div className={`p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center ${t.panelCls}`}>
        <div className="lg:col-span-7 flex items-center gap-4">
          <div className={`w-16 h-16 rounded-2xl overflow-hidden shrink-0 p-1 ${t.wellCls}`}>
            <img
              src={CERVOS_HQ_ASSETS.peopleStockroom}
              alt="Cervos HQ Team Operations"
              className="w-full h-full object-cover rounded-xl"
            />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2
                className="text-lg font-semibold tracking-tight"
                style={{ fontFamily: "Outfit, Inter, sans-serif" }}
              >
                HQ Operators, Roles &amp; Shift Handoff
              </h2>
              {currentWorker && (
                <span className="px-2.5 py-0.5 rounded-full bg-[#1039B9]/15 text-[#1039B9] dark:text-sky-300 font-mono text-[10px] font-bold">
                  {HQ_ROLE_METADATA[currentWorker.role].shortTag}
                </span>
              )}
            </div>
            <p className={`text-xs mt-0.5 ${t.mutedCls}`}>
              HQ Master invites specialists with role-scoped permissions, rotates activation codes, and coordinates live shift handovers across the HQ team.
            </p>
          </div>
        </div>
        <div className="lg:col-span-5 grid grid-cols-3 gap-2.5">
          {[
            { label: "Active Desk", val: workers.filter((w) => w.status === "active").length },
            { label: "Pending Invite", val: workers.filter((w) => w.status === "invited").length },
            { label: "Shift Notes", val: notes.length },
          ].map((stat) => (
            <div key={stat.label} className={`p-3 text-center ${t.wellCls}`}>
              <div className="text-lg font-bold tabular-nums">{stat.val}</div>
              <div className={`text-[10px] font-semibold uppercase tracking-wider ${t.mutedCls}`}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Role Architecture Matrix + One-Time Invite Card */}
      {issuedInvite && (
        <div className={`p-5 border-2 border-emerald-500/40 space-y-3 ${t.panelCls}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-300">
                Worker Onboarding Link &amp; Secret Invite Code
              </div>
              <h3 className="text-sm font-semibold mt-0.5">
                Hand this single-use credential to {issuedInvite.name} ({issuedInvite.email})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIssuedInvite(null)}
              className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${t.pillCls}`}
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className={`p-3 flex items-center justify-between gap-2 ${t.wellCls}`}>
              <div className="min-w-0">
                <div className={`text-[10px] font-bold uppercase ${t.mutedCls}`}>One-Time Code</div>
                <div className="font-mono text-sm font-bold truncate">{issuedInvite.inviteCode}</div>
              </div>
              <button
                type="button"
                onClick={() => void copyText("code", issuedInvite.inviteCode)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer ${t.primaryBtnCls}`}
              >
                {copiedKey === "code" ? "Copied" : "Copy Code"}
              </button>
            </div>
            <div className={`p-3 flex items-center justify-between gap-2 ${t.wellCls}`}>
              <div className="min-w-0">
                <div className={`text-[10px] font-bold uppercase ${t.mutedCls}`}>Direct Claim URL</div>
                <div className="font-mono text-[11px] truncate">{issuedInvite.url}</div>
              </div>
              <button
                type="button"
                onClick={() => void copyText("url", issuedInvite.url)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer ${t.primaryBtnCls}`}
              >
                {copiedKey === "url" ? "Copied" : "Copy Link"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left: HQ Roster + Master Onboarding Form */}
        <div className="xl:col-span-7 space-y-5">
          {isMaster ? (
            <form onSubmit={handleOnboardWorker} className={`p-5 space-y-4 ${t.panelCls}`}>
              <div>
                <h3
                  className="text-base font-semibold"
                  style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                >
                  Onboard New HQ Specialist
                </h3>
                <p className={`text-xs mt-0.5 ${t.mutedCls}`}>
                  Create an invited seat with scoped HQ permissions. They activate via Claim Invite with their own password and 4-6 digit PIN.
                </p>
              </div>

              {formErr && (
                <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3.5 py-2 text-xs text-rose-600 dark:text-rose-300">
                  {formErr}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full Name (e.g. Amina Yusuf)"
                  required
                  className={`h-10 px-3.5 rounded-2xl text-xs ${t.inputCls}`}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Work Email (amina@cervos.online)"
                  required
                  className={`h-10 px-3.5 rounded-2xl text-xs ${t.inputCls}`}
                />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as HqWorkerRole)}
                  className={`h-10 px-3.5 rounded-2xl text-xs ${t.inputCls}`}
                >
                  {HQ_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {HQ_ROLE_METADATA[r].label} ({HQ_ROLE_METADATA[r].shortTag})
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={HQ_ROLE_METADATA[role].defaultTitle}
                  className={`h-10 px-3.5 rounded-2xl text-xs ${t.inputCls}`}
                />
                <input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="Desk / Region (e.g. Dar HQ)"
                  className={`h-10 px-3.5 rounded-2xl text-xs ${t.inputCls}`}
                />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Optional SMS Phone (+255...)"
                  className={`h-10 px-3.5 rounded-2xl text-xs ${t.inputCls}`}
                />
              </div>

              <div className={`p-3 text-[11px] ${t.wellCls} ${t.mutedCls}`}>
                <strong className="text-current">{HQ_ROLE_METADATA[role].label}:</strong>{" "}
                {HQ_ROLE_METADATA[role].summary}
              </div>

              <button
                type="submit"
                disabled={createBusy}
                className={`px-5 py-2.5 rounded-full text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer ${t.primaryBtnCls}`}
              >
                {createBusy && (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                )}
                <span>{createBusy ? "Generating HQ Invite..." : "Issue Onboarding Code"}</span>
              </button>
            </form>
          ) : (
            <div className={`p-5 text-xs ${t.panelCls} ${t.mutedCls}`}>
              Signed in under <strong className="text-current">{currentWorker?.title}</strong>. Worker onboarding and role governance are restricted to <strong className="text-current">HQ Master</strong>.
            </div>
          )}

          {/* Directory */}
          <section className={`p-5 space-y-3.5 ${t.panelCls}`}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">HQ Operator Directory ({workers.length})</h3>
              <span className={`text-[11px] ${t.mutedCls}`}>Live clearance roster</span>
            </div>

            {workers.length === 0 ? (
              <div className={`p-6 text-center text-xs ${t.wellCls} ${t.mutedCls}`}>
                No additional HQ specialists invited yet. Issue an onboarding code above to bring Support, Finance, or Compliance teammates online.
              </div>
            ) : (
              <div className="space-y-3">
                {workers.map((w) => (
                  <div key={w.id} className={`p-4 space-y-3 ${t.wellCls}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">{w.name}</span>
                          <span className="px-2 py-0.5 rounded-full bg-[#1039B9]/15 text-[#1039B9] dark:text-sky-300 font-mono text-[10px] font-bold">
                            {HQ_ROLE_METADATA[w.role].shortTag}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              w.status === "active"
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                : w.status === "invited"
                                  ? "bg-amber-500/18 text-amber-700 dark:text-amber-300"
                                  : "bg-rose-500/18 text-rose-700 dark:text-rose-300"
                            }`}
                          >
                            {w.status}
                          </span>
                        </div>
                        <div className={`text-xs mt-0.5 ${t.mutedCls}`}>
                          {w.title} &middot; {w.email} &middot; {w.region}
                        </div>
                        <div className={`text-[10px] font-mono mt-0.5 ${t.mutedCls}`}>
                          {w.lastSeenAt
                            ? `Last active: ${w.lastSeenAt.slice(0, 16).replace("T", " ")}`
                            : `Invited ${w.invitedAt.slice(0, 10)} (Code ${w.inviteCodeHint || "issued"})`}
                        </div>
                      </div>

                      {isMaster && (
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            disabled={createBusy || busy}
                            onClick={() => void handleRegenerateInvite(w)}
                            className={`px-3 py-1 rounded-full text-[11px] font-semibold cursor-pointer ${t.pillCls}`}
                          >
                            Re-issue Code
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void onRunAction(
                                {
                                  action: "update_hq_worker",
                                  workerId: w.id,
                                  status: w.status === "suspended" ? "active" : "suspended",
                                },
                                `${w.status === "suspended" ? "Reactivated" : "Suspended"} ${w.name}`
                              )
                            }
                            className="px-3 py-1 rounded-full border border-rose-500/35 bg-rose-500/10 text-rose-600 dark:text-rose-300 text-[11px] font-semibold cursor-pointer"
                          >
                            {w.status === "suspended" ? "Reactivate" : "Suspend"}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Capability Chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {CAPABILITY_LABELS.map((cap) => {
                        const enabled = w.capabilities[cap.key];
                        return (
                          <button
                            key={cap.key}
                            type="button"
                            disabled={!isMaster || busy || w.role === "hq_master"}
                            onClick={() =>
                              void onRunAction(
                                {
                                  action: "update_hq_worker",
                                  workerId: w.id,
                                  capabilities: {
                                    ...w.capabilities,
                                    [cap.key]: !enabled,
                                  },
                                },
                                `Toggled ${cap.label} for ${w.name}`
                              )
                            }
                            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition cursor-pointer disabled:cursor-default ${
                              enabled
                                ? "bg-emerald-500/16 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                : "bg-slate-500/10 opacity-55 border border-transparent"
                            }`}
                          >
                            {enabled ? "ON" : "OFF"} &middot; {cap.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right: Collaborative Shift Handoff & Internal Dispatch Feed */}
        <section className={`xl:col-span-5 p-5 space-y-4 ${t.panelCls}`}>
          <div>
            <h3
              className="text-base font-semibold"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              Shift Handoff &amp; Internal Directives
            </h3>
            <p className={`text-xs mt-0.5 ${t.mutedCls}`}>
              Coordinate escalations, FEFO recall watchlists, and end-of-shift context across all online HQ operators.
            </p>
          </div>

          <form onSubmit={handlePostNote} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <select
                value={noteTopic}
                onChange={(e) => setNoteTopic(e.target.value as HqTeamNoteItem["topic"])}
                className={`h-9 px-3 rounded-xl text-xs ${t.inputCls}`}
              >
                <option value="shift_handoff">Shift Handoff</option>
                <option value="escalation">Escalation</option>
                <option value="directive">Master Directive</option>
                <option value="general">General Note</option>
              </select>
              <select
                value={targetWorkerId}
                onChange={(e) => setTargetWorkerId(e.target.value)}
                className={`h-9 px-3 rounded-xl text-xs ${t.inputCls}`}
              >
                <option value="">All HQ Operators</option>
                <option value="master">Tag HQ Master</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    Tag @{w.name}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              rows={3}
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder="Write handoff context, open escalation summary, or instruction for next shift..."
              className={`w-full p-3.5 rounded-2xl text-xs ${t.inputCls}`}
            />
            <div className="flex items-center justify-between gap-2">
              <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={pinNote}
                  onChange={(e) => setPinNote(e.target.checked)}
                />
                <span>Pin to top</span>
              </label>
              <button
                type="submit"
                disabled={busy || noteBody.trim().length < 3}
                className={`px-4 py-2 rounded-full text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer ${t.primaryBtnCls}`}
              >
                {busy && (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                )}
                <span>{busy ? "Posting..." : "Post Team Note"}</span>
              </button>
            </div>
          </form>

          <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
            {notes.length === 0 ? (
              <div className={`p-5 text-center text-xs ${t.wellCls} ${t.mutedCls}`}>
                No HQ shift handoff notes posted yet.
              </div>
            ) : (
              [...notes]
                .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)))
                .map((n) => (
                  <div
                    key={n.id}
                    className={`p-3.5 space-y-1.5 ${t.wellCls} ${
                      n.pinned ? "ring-1 ring-[#1039B9]/40" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-full font-bold uppercase ${TOPIC_STYLE[n.topic]}`}>
                          {n.topic.replace("_", " ")}
                        </span>
                        {n.pinned && (
                          <span className="px-2 py-0.5 rounded-full bg-[#1039B9] text-white font-bold uppercase">
                            PINNED
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void onRunAction(
                            { action: "toggle_pin_team_note", noteId: n.id },
                            n.pinned ? "Unpinned team note" : "Pinned team note"
                          )
                        }
                        className={`text-[10px] font-semibold hover:underline cursor-pointer ${t.mutedCls}`}
                      >
                        {n.pinned ? "Unpin" : "Pin"}
                      </button>
                    </div>
                    <p className="text-xs leading-relaxed whitespace-pre-wrap">{n.body}</p>
                    <div className={`text-[10px] flex items-center justify-between ${t.mutedCls}`}>
                      <span>
                        By <strong>{n.authorName}</strong>
                        {n.targetWorkerName ? ` -> @${n.targetWorkerName}` : ""}
                      </span>
                      <span className="font-mono">{n.createdAt.slice(0, 16).replace("T", " ")}</span>
                    </div>
                  </div>
                ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
