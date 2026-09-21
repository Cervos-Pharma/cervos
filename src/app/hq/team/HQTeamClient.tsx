/**
 * @file hq/team/HQTeamClient.tsx
 * @description Client component for the HQ Team page. Lists HQ console
 *   operators with last-login info and allows adding, disabling, and
 *   removing team members. The last enabled admin can never be disabled or
 *   removed (guarded server-side as well).
 */
"use client";

import { useState } from "react";
import { addHQAdmin, removeHQAdmin, setHQAdminDisabled, type HQAdminRow } from "@/lib/actions/hq";
import Toast from "@/components/Toast";

interface Props {
  admins: HQAdminRow[] | null;
  error: string | null;
}

export default function HQTeamClient({ admins, error }: Props) {
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "admin" });

  function showToast(message: string, type: "success" | "error" | "info") {
    setToast({ message, type });
  }

  async function run(id: string, fn: () => Promise<{ error: string | null }>, success: string) {
    setBusy(id);
    try {
      const result = await fn();
      if (result.error) {
        showToast(result.error, "error");
      } else {
        showToast(success, "success");
        window.location.reload();
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleAdd() {
    const result = await addHQAdmin(form.email, form.name, form.password, form.role);
    if (result.error) {
      showToast(result.error, "error");
    } else {
      showToast("HQ operator added.", "success");
      setAddOpen(false);
      setForm({ email: "", name: "", password: "", role: "admin" });
      window.location.reload();
    }
  }

  if (error) {
    return (
      <div className="bg-error-container text-on-error-container p-6 rounded">
        <p className="font-body-md">Error loading HQ team: {error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <p className="font-label-md text-label-md text-on-surface-variant">
          {admins?.length ?? 0} team member{(admins?.length ?? 0) === 1 ? "" : "s"}
        </p>
        <button
          onClick={() => setAddOpen((v) => !v)}
          className="px-4 py-2 bg-primary text-on-primary font-label-md text-label-md flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[16px]">person_add</span>
          Add operator
        </button>
      </div>

      {addOpen && (
        <div className="bg-surface-base border border-outline-variant rounded p-6 mb-6">
          <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">
            New HQ operator
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-label-md text-label-md text-xs text-on-surface-variant uppercase tracking-wider">Full name</span>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="border border-outline-variant bg-surface-container-low px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-label-md text-label-md text-xs text-on-surface-variant uppercase tracking-wider">Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="border border-outline-variant bg-surface-container-low px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-label-md text-label-md text-xs text-on-surface-variant uppercase tracking-wider">Password (min 10 chars)</span>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                className="border border-outline-variant bg-surface-container-low px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-label-md text-label-md text-xs text-on-surface-variant uppercase tracking-wider">Role</span>
              <select
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                className="border border-outline-variant bg-surface-container-low px-3 py-2 text-sm focus:outline-none focus:border-primary"
              >
                <option value="admin">Admin</option>
                <option value="support">Support</option>
              </select>
            </label>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleAdd}
              disabled={busy === "add"}
              className="px-4 py-2 bg-primary text-on-primary font-label-md text-label-md disabled:opacity-60"
            >
              {busy === "add" ? "Adding…" : "Add operator"}
            </button>
            <button
              onClick={() => setAddOpen(false)}
              className="px-4 py-2 border border-outline-variant text-on-surface-variant font-label-md text-label-md"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-surface-base border border-outline-variant rounded overflow-x-auto">
        {(admins ?? []).length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-body-md text-on-surface-variant">No HQ operators configured.</p>
          </div>
        ) : (
          <table className="w-full min-w-[720px]">
            <thead className="bg-surface-container-low">
              <tr>
                {["Name", "Email", "Role", "Status", "Last login", "Actions"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-6 py-3 font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {(admins ?? []).map((a) => (
                <tr key={a.id} className={`hover:bg-surface-container-low/30 transition-colors ${a.disabled ? "opacity-50" : ""}`}>
                  <td className="px-6 py-4 font-body-md text-body-md text-ink-deep font-medium">{a.name}</td>
                  <td className="px-6 py-4 font-body-sm text-body-sm text-on-surface-variant">{a.email}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-label-md capitalize bg-primary/10 text-primary">
                      {a.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-label-md ${
                      a.disabled ? "bg-error-container text-error" : "bg-secondary/10 text-secondary"
                    }`}>
                      {a.disabled ? "disabled" : "enabled"}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-on-surface-variant">
                    {a.last_login_at ? new Date(a.last_login_at).toLocaleString() : "never"}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() =>
                          run(`toggle-${a.id}`, () => setHQAdminDisabled(a.id, !a.disabled), a.disabled ? "Operator enabled." : "Operator disabled.")
                        }
                        disabled={busy === `toggle-${a.id}`}
                        className="text-sm font-label-md text-primary hover:underline disabled:opacity-50"
                      >
                        {a.disabled ? "Enable" : "Disable"}
                      </button>
                      <button
                        onClick={() => run(`remove-${a.id}`, () => removeHQAdmin(a.id), "Operator removed.")}
                        disabled={busy === `remove-${a.id}`}
                        className="text-sm font-label-md text-error hover:underline disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
