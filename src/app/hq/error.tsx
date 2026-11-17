"use client";

export default function HQError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-[24px] border border-[#EAECF0] bg-white p-6 space-y-4 text-center">
        <div className="text-xs font-bold uppercase tracking-widest text-red-600">
          HQ Console Error
        </div>
        <h2 className="text-lg font-semibold text-[#111317]">
          Unable to render HQ telemetry
        </h2>
        <p className="text-xs text-[#64748B]">
          {error.message || "Unexpected runtime error in the HQ Console."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2 rounded-full bg-[#1039B9] text-white text-xs font-semibold cursor-pointer"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
