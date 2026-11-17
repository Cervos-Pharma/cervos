"use client";

/**
 * @route /hq/* (error boundary)
 * @description Catches unhandled errors in any HQ console route.
 */

import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";

export default function HQError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-8">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-error-container flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-[28px] text-error">error_outline</span>
        </div>
        <h1 className="font-headline-lg text-headline-lg text-ink-deep mb-3">{t("hq.console_error")}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mb-2">
          An error occurred in the HQ console. Your session may have expired.
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-on-surface-variant/60 mb-6">Error ID: {error.digest}</p>
        )}
        <div className="flex gap-3 justify-center mt-6">
          <button onClick={reset} className="bg-ink-deep text-white font-label-md text-label-md px-6 py-2.5 rounded hover:opacity-90 transition-opacity">
            Try again
          </button>
          <Link href="/hq" className="border border-outline-variant text-on-surface-variant font-label-md text-label-md px-6 py-2.5 rounded hover:bg-surface-container transition-colors">
            Back to HQ login
          </Link>
        </div>
      </div>
    </div>
  );
}
