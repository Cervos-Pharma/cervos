/**
 * @file components/MockModeBar.tsx
 * @description Dev-only floating bar shown when `NEXT_PUBLIC_MOCK_MODE=true`.
 * Lets you switch which demo account the app believes is signed in without
 * touching Supabase. The choice is stored in the `mock_user` cookie, which is
 * read by `lib/supabase/server.ts`, `lib/supabase/client.ts`, and `proxy.ts`.
 *
 * Options:
 *  - Pharmacy  — default demo pharmacy account (dashboard portal)
 *  - Supplier  — demo supplier account (supplier portal)
 *  - Signed out — simulates an unauthenticated visitor (drives auth redirects)
 *
 * Renders nothing in normal (non-mock) builds.
 */

"use client";

import { useEffect, useState } from "react";

const IS_MOCK = process.env.NEXT_PUBLIC_MOCK_MODE === "true";

const ROLES = [
  { key: "pharmacy", label: "Pharmacy" },
  { key: "supplier", label: "Supplier" },
  { key: "none", label: "Signed out" },
] as const;

export default function MockModeBar() {
  // The active role comes from a cookie that only exists in the browser, so
  // read it in an effect — reading it during render makes the server markup
  // (which always renders "pharmacy" active) disagree with the client and
  // triggers a React hydration mismatch.
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    setCurrent(
      document.cookie
        .split("; ")
        .find((c) => c.startsWith("mock_user="))
        ?.split("=")[1] ?? "pharmacy",
    );
  }, []);

  if (!IS_MOCK) return null;

  const switchRole = (role: string) => {
    if (role === "none") {
      document.cookie = "mock_user=none; path=/; max-age=3600";
    } else {
      document.cookie = `mock_user=${role}; path=/; max-age=3600`;
    }
    window.location.reload();
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex items-center gap-1 rounded-full border border-[#3d2f6e]/20 bg-[#1b1432]/95 px-3 py-1.5 text-xs text-white shadow-lg backdrop-blur">
      <span className="mr-1 font-semibold text-[#a78bfa]">MOCK</span>
      {ROLES.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => switchRole(key)}
          className={`rounded-full px-2.5 py-1 transition-colors ${
            current === key ? "bg-[#7c5cff] text-white" : "text-white/70 hover:text-white"
          }`}
        >
          {label}
        </button>
      ))}
      <a
        href="/hq"
        className="ml-1 rounded-full px-2.5 py-1 text-white/70 transition-colors hover:text-white"
      >
        HQ
      </a>
    </div>
  );
}
