"use client";

import { useState, useMemo } from "react";
import { sendHQMessage, deleteHQMessage, type HQMessage } from "@/lib/actions/hq";
import Toast from "@/components/Toast";
import { useI18n } from "@/lib/i18n/context";

const KIND_COLORS: Record<string, string> = {
  info: "bg-blue-50 border-blue-200 text-blue-900",
  warning: "bg-amber-50 border-amber-200 text-amber-900",
  urgent: "bg-red-50 border-red-200 text-red-900",
  promo: "bg-purple-50 border-purple-200 text-purple-900",
};

const KIND_BADGE: Record<string, string> = {
  info: "bg-blue-100 text-blue-700",
  warning: "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
  promo: "bg-purple-100 text-purple-700",
};

const SCOPE_LABELS: Record<string, string> = {
  all: "Entire Network",
  all_pharmacies: "All Pharmacies",
  all_suppliers: "All Suppliers",
  account: "Specific Account",
  branch: "Specific Branch",
};

interface Account {
  id: string;
  name: string;
}

interface Branch {
  id: string;
  account_id: string;
  name: string;
}

export default function HQMessagesClient({
  messages,
  accounts,
  branches,
}: {
  messages: HQMessage[];
  accounts: Account[];
  branches: Branch[];
}) {
  const { t } = useI18n();
  const [list, setList] = useState(messages);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"info" | "warning" | "urgent" | "promo">("info");
  const [scope, setScope] = useState<"all" | "all_pharmacies" | "all_suppliers" | "account" | "branch">("all");
  const [targetAccountId, setTargetAccountId] = useState("");
  const [targetBranchId, setTargetBranchId] = useState("");
  const [sending, setSending] = useState(false);

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const filteredBranches = useMemo(
    () => (targetAccountId ? branches.filter((b) => b.account_id === targetAccountId) : branches),
    [branches, targetAccountId]
  );

  async function handleSend() {
    if (!title.trim() || !body.trim()) {
      setToast({ message: "Title and body are required.", type: "error" });
      return;
    }
    setSending(true);
    try {
      const result = await sendHQMessage({
        title,
        body,
        kind,
        target_scope: scope,
        target_account_id: scope === "account" ? targetAccountId : null,
        target_branch_id: scope === "branch" ? targetBranchId : null,
      });
      if (result.error) {
        setToast({ message: result.error, type: "error" });
      } else {
        setToast({ message: "Message broadcast successfully.", type: "success" });
        setTitle("");
        setBody("");
        setKind("info");
        setScope("all");
        setTargetAccountId("");
        setTargetBranchId("");
        const { getHQMessages } = await import("@/lib/actions/hq");
        const refreshed = await getHQMessages();
        if (!refreshed.error) setList(refreshed.data ?? []);
      }
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this message?")) return;
    const result = await deleteHQMessage(id);
    if (result.error) {
      setToast({ message: result.error, type: "error" });
    } else {
      setList((prev) => prev.filter((m) => m.id !== id));
      setToast({ message: "Message deleted.", type: "info" });
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        <div className="bg-surface-base border border-outline-variant rounded-xl p-6 sticky top-12">
          <h2 className="font-headline-md text-headline-md text-ink-deep mb-4">{t("hqmsg.compose")}</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">Kind</label>
              <div className="flex gap-2 flex-wrap">
                {(["info", "warning", "urgent", "promo"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setKind(k)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${
                      kind === k ? KIND_BADGE[k] : "bg-surface-container-low text-on-surface-variant"
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">Target</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as typeof scope)}
                className="w-full px-3 py-2.5 rounded-md border border-outline-variant bg-surface-base text-sm focus:outline-none focus:border-primary"
              >
                <option value="all">{t("hqmsg.entire_network")}</option>
                <option value="all_pharmacies">{t("hqmsg.all_pharmacies")}</option>
                <option value="all_suppliers">{t("hqmsg.all_suppliers")}</option>
                <option value="account">{t("hqmsg.specific_account")}</option>
                <option value="branch">{t("hqmsg.specific_branch")}</option>
              </select>
            </div>

            {scope === "account" && (
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">Account</label>
                <select
                  value={targetAccountId}
                  onChange={(e) => setTargetAccountId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-md border border-outline-variant bg-surface-base text-sm focus:outline-none focus:border-primary"
                >
                  <option value="">Select account...</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {scope === "branch" && (
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">Branch</label>
                <select
                  value={targetBranchId}
                  onChange={(e) => setTargetBranchId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-md border border-outline-variant bg-surface-base text-sm focus:outline-none focus:border-primary"
                >
                  <option value="">Select branch...</option>
                  {filteredBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Message title"
                className="w-full px-3 py-2.5 rounded-md border border-outline-variant bg-surface-base text-sm focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">Body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your message here..."
                rows={4}
                className="w-full px-3 py-2.5 rounded-md border border-outline-variant bg-surface-base text-sm focus:outline-none focus:border-primary resize-none"
              />
            </div>

            <button
              onClick={handleSend}
              disabled={sending}
              className="w-full py-2.5 rounded-md bg-primary text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {sending ? "Broadcasting..." : "Broadcast Message"}
            </button>
          </div>
        </div>
      </div>

      <div className="lg:col-span-2">
        <h2 className="font-headline-md text-headline-md text-ink-deep mb-4">Sent Messages ({list.length})</h2>
        {list.length === 0 ? (
          <div className="bg-surface-base border border-outline-variant rounded-xl p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-3">mail_outline</span>
            <p className="font-body-md text-on-surface-variant">No messages sent yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((msg) => (
              <div key={msg.id} className={`rounded-xl border p-5 ${KIND_COLORS[msg.kind] ?? KIND_COLORS.info}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold capitalize ${KIND_BADGE[msg.kind] ?? ""}`}>
                        {msg.kind}
                      </span>
                      <span className="text-xs font-semibold opacity-70">{SCOPE_LABELS[msg.target_scope] ?? msg.target_scope}</span>
                    </div>
                    <h3 className="font-headline-md text-headline-md mb-1">{msg.title}</h3>
                    <p className="font-body-md text-body-md opacity-80 whitespace-pre-wrap">{msg.body}</p>
                    <p className="font-mono text-xs opacity-50 mt-2">
                      {new Date(msg.created_at).toLocaleString()}
                      {msg.target_account_id && ` · Account: ${accountMap.get(msg.target_account_id) ?? msg.target_account_id.slice(0, 8)}...`}
                      {msg.target_branch_id && ` · Branch: ${branches.find((b) => b.id === msg.target_branch_id)?.name ?? msg.target_branch_id.slice(0, 8)}...`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(msg.id)}
                    className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center opacity-50 hover:opacity-100 hover:bg-black/10 transition-all"
                    title="Delete"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
