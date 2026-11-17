"use client";

export default function OpsPortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#090C12] text-slate-100 px-6">
      <div className="max-w-md w-full rounded-2xl border border-red-500/30 bg-[#11161F] p-6 space-y-4">
        <div className="text-[10px] font-mono uppercase tracking-widest text-red-400">
          Ops Terminal Fault
        </div>
        <h1 className="text-lg font-semibold">Telemetry stream interrupted</h1>
        <p className="text-xs text-slate-400">
          {error.message || "Unexpected runtime error in Operations Portal."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2 rounded-xl bg-[#1039B9] text-white text-xs font-semibold cursor-pointer"
        >
          Retry Clearance
        </button>
      </div>
    </div>
  );
}
