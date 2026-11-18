"use client";

import { useState } from "react";
import { formatTzs } from "@cervos/core";
import { hqSurfaceTokens } from "./hqSurface";
import type { HqAgentProfile, HqAutonomyMode, HqDecisionProposal } from "./types";

interface HQDecisionInboxSectionProps {
  proposals: HqDecisionProposal[];
  autonomyConfig: Record<string, HqAutonomyMode>;
  agents: HqAgentProfile[];
  onRunAction: (payload: Record<string, unknown>, successMessage: string) => Promise<boolean>;
  isDark: boolean;
  busy: boolean;
}

const ACTION_CLASSES: Array<{
  key: HqDecisionProposal["kind"];
  label: string;
  lockToHuman?: boolean;
}> = [
  { key: "reorder_draft", label: "Kasri Reorder Drafts" },
  { key: "expiry_rescue", label: "Expiry Rescue Transfers" },
  { key: "churn_intervention", label: "Health & Churn Playbooks" },
  { key: "support_reply", label: "Support Ticket Drafts" },
  { key: "billing_grace", label: "Billing & Lock Changes", lockToHuman: true },
  { key: "recall_quarantine", label: "TMDA Recall Quarantine", lockToHuman: true },
  { key: "anomaly_review", label: "Till Anomaly Triage" },
];

export default function HQDecisionInboxSection({
  proposals,
  autonomyConfig,
  agents,
  onRunAction,
  isDark,
  busy,
}: HQDecisionInboxSectionProps) {
  const t = hqSurfaceTokens(isDark);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "proposed" | "executed" | "rejected" | "reverted"
  >("proposed");
  const [expandedBlastId, setExpandedBlastId] = useState<string | null>(proposals[0]?.id ?? null);

  const visibleProposals = proposals.filter(
    (p) => statusFilter === "all" || p.status === statusFilter
  );

  return (
    <div className="space-y-5">
      {/* Autonomy Dial Header (Spec Part 2 §9) */}
      <section className={`p-5 space-y-4 ${t.panelCls}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#1039B9] dark:text-sky-400">
              DECISION LAYER &amp; AUTONOMY DIAL
            </span>
            <h2
              className="text-xl font-semibold tracking-tight mt-0.5"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              Typed Proposals &amp; Command Registry Execution
            </h2>
            <p className={`text-xs mt-0.5 ${t.mutedCls}`}>
              Every suggestion cites event ranges, model versions, and blast-radius bounds. Money, access locks, and clinical actions require human approval.
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void onRunAction(
                { action: "run_agent_drafts" },
                "Generated fresh cited proposals from Spine signals"
              )
            }
            className={`px-4 py-2 rounded-full text-xs font-semibold cursor-pointer disabled:opacity-50 ${t.primaryBtnCls}`}
          >
            Run Agent Draft Pass
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2.5">
          {ACTION_CLASSES.map((cls) => {
            const current = autonomyConfig[cls.key] || "suggest";
            return (
              <div key={cls.key} className={`p-3 space-y-1.5 ${t.wellCls}`}>
                <div className="text-[11px] font-semibold leading-snug">{cls.label}</div>
                <select
                  value={current}
                  disabled={busy}
                  onChange={(e) =>
                    void onRunAction(
                      {
                        action: "set_autonomy_mode",
                        kind: cls.key,
                        mode: e.target.value,
                      },
                      `Autonomy for ${cls.label} set to ${e.target.value}`
                    )
                  }
                  className={`w-full h-8 px-2 rounded-lg text-[11px] font-mono ${t.inputCls}`}
                >
                  <option value="off">Off</option>
                  <option value="suggest">Suggest (Human)</option>
                  {!cls.lockToHuman && <option value="auto_undo">Auto + Undo</option>}
                  {!cls.lockToHuman && <option value="auto">Auto</option>}
                </select>
                {cls.lockToHuman && (
                  <div className="text-[9px] text-amber-600 dark:text-amber-400 font-semibold">
                    Human gate enforced
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left: Proposal Inbox */}
        <div className={`xl:col-span-7 p-5 space-y-4 ${t.panelCls}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
              Proposal Inbox ({proposals.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {(["proposed", "executed", "rejected", "reverted", "all"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold capitalize cursor-pointer ${
                    statusFilter === st ? t.primaryBtnCls : t.pillCls
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {visibleProposals.length === 0 ? (
            <div className={`p-8 text-center text-xs ${t.wellCls} ${t.mutedCls}`}>
              No proposals in this status. Click &ldquo;Run Agent Draft Pass&rdquo; above to scan live telemetry for new recommendations.
            </div>
          ) : (
            <div className="space-y-3">
              {visibleProposals.map((prop) => {
                const showBlast = expandedBlastId === prop.id;
                return (
                  <div key={prop.id} className={`p-4 space-y-3 text-xs ${t.wellCls}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-[#1039B9]/12 text-[#1039B9] dark:text-sky-300 font-mono text-[10px] font-bold uppercase">
                            {prop.tool}
                          </span>
                          <span className="font-bold">{prop.orgName}</span>
                          {prop.branchName && <span className={t.mutedCls}>&middot; {prop.branchName}</span>}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              prop.reversibility === "reversible"
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                : prop.reversibility === "compensatable"
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                  : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                            }`}
                          >
                            {prop.reversibility}
                          </span>
                        </div>
                        <p className="text-sm font-medium leading-snug">{prop.why}</p>
                      </div>
                      <span className="font-mono text-[10px] uppercase font-bold">{prop.status}</span>
                    </div>

                    {/* Confidence Band + Impact */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                      <div className={`p-2 rounded-xl border ${t.cardBorderCls} bg-white/50 dark:bg-slate-900/40`}>
                        <div className={`text-[10px] ${t.mutedCls}`}>Confidence (P10-P90)</div>
                        <div className="font-mono font-bold">
                          {prop.confidence.p50} ({prop.confidence.p10}..{prop.confidence.p90}) {prop.confidence.unit}
                        </div>
                      </div>
                      <div className={`p-2 rounded-xl border ${t.cardBorderCls} bg-white/50 dark:bg-slate-900/40`}>
                        <div className={`text-[10px] ${t.mutedCls}`}>Impact Value</div>
                        <div className="font-mono font-bold">{formatTzs(prop.impact.tzs)}</div>
                      </div>
                      <div className={`p-2 rounded-xl border ${t.cardBorderCls} bg-white/50 dark:bg-slate-900/40`}>
                        <div className={`text-[10px] ${t.mutedCls}`}>Model Version</div>
                        <div className="font-mono font-bold truncate">{prop.evidence.modelVersion}</div>
                      </div>
                      <div className={`p-2 rounded-xl border ${t.cardBorderCls} bg-white/50 dark:bg-slate-900/40`}>
                        <div className={`text-[10px] ${t.mutedCls}`}>Event Range</div>
                        <div className="font-mono font-bold truncate">{prop.evidence.eventRange}</div>
                      </div>
                    </div>

                    {showBlast && (
                      <div className={`p-3 rounded-xl border text-[11px] space-y-1 ${t.cardBorderCls}`}>
                        <div className="font-bold uppercase tracking-wider text-[10px]">
                          Blast-Radius Preview
                        </div>
                        <div className={t.mutedCls}>
                          Touches <strong>{prop.impact.orgsTouched}</strong> org(s),{" "}
                          <strong>{prop.impact.branchesTouched}</strong> branch(es),{" "}
                          <strong>{prop.impact.units}</strong> unit(s), value{" "}
                          <strong>{formatTzs(prop.impact.tzs)}</strong>. Evidence snapshot:{" "}
                          <span className="font-mono">{prop.evidence.featureSnapshot}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setExpandedBlastId(showBlast ? null : prop.id)}
                        className="text-[11px] font-semibold text-[#1039B9] dark:text-sky-400 hover:underline cursor-pointer"
                      >
                        {showBlast ? "Hide Blast Radius" : "Preview Blast Radius"}
                      </button>

                      <div className="flex flex-wrap gap-2">
                        {prop.status === "proposed" && (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void onRunAction(
                                  { action: "approve_proposal", proposalId: prop.id },
                                  `Approved & executed ${prop.tool} for ${prop.orgName}`
                                )
                              }
                              className="px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                            >
                              Approve &amp; Execute
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void onRunAction(
                                  { action: "reject_proposal", proposalId: prop.id },
                                  `Rejected proposal ${prop.id}`
                                )
                              }
                              className="px-3 py-1.5 rounded-full border border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-300 text-[11px] font-semibold cursor-pointer"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {prop.status === "executed" && prop.reversibility !== "irreversible" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void onRunAction(
                                { action: "revert_proposal", proposalId: prop.id },
                                `Reverted proposal ${prop.id}`
                              )
                            }
                            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer ${t.pillCls}`}
                          >
                            Undo / Revert
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: 5-Agent Crew & Guardrails */}
        <div className={`xl:col-span-5 p-5 space-y-4 ${t.panelCls}`}>
          <div>
            <h3 className="text-base font-semibold" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
              Governed Agent Crew ({agents.length})
            </h3>
            <p className={`text-xs mt-0.5 ${t.mutedCls}`}>
              All workers authenticate through the Command Registry with hard token, tool-call, and clinical guardrails.
            </p>
          </div>

          <div className="space-y-3">
            {agents.map((ag) => (
              <div key={ag.id} className={`p-3.5 space-y-2 text-xs ${t.wellCls}`}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-bold">{ag.name}</span>
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-[#1039B9]/12 text-[#1039B9] dark:text-sky-300 font-mono text-[9px] font-bold uppercase">
                      {ag.roleTag}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                    {ag.draftAcceptancePct}% accepted &middot; {ag.wrongActionCount} wrong
                  </span>
                </div>
                <div className={`text-[11px] ${t.mutedCls}`}>
                  <strong>Tools:</strong> {ag.allowedTools.join(", ")}
                </div>
                <div className="text-[11px] text-rose-600 dark:text-rose-400">
                  <strong>Forbidden:</strong> {ag.forbiddenActions.join(", ")}
                </div>
                <div className={`text-[11px] ${t.mutedCls}`}>
                  <strong>Escalates:</strong> {ag.escalatesWhen}
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono pt-1">
                  <span>Tokens: {ag.tokensUsedToday}/{ag.dailyTokenCap}</span>
                  <span>Calls: {ag.toolCallsToday}/{ag.dailyToolCap}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
