export default function OpsPortalLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#090C12] text-slate-300 px-6">
      <div className="rounded-2xl border border-slate-800 bg-[#11161F] px-6 py-5 text-xs font-mono tracking-wider uppercase">
        Synchronizing encrypted telemetry node...
      </div>
    </div>
  );
}
