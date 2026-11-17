import { useEffect, useState } from "react";
import { WEB_URL } from "./lib/web";

export default function App() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    // If online, navigate immediately to the Cervos online workspace
    if (navigator.onLine) {
      window.location.replace(`${WEB_URL}/app`);
    }

    const handleOnline = () => {
      setOffline(false);
      window.location.replace(`${WEB_URL}/app`);
    };
    const handleOffline = () => setOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0F17] text-white flex flex-col items-center justify-center p-6 select-none font-sans">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="relative inline-block mx-auto">
          <div className="w-24 h-24 rounded-full bg-blue-500/10 border border-[#1039B9]/30 flex items-center justify-center mx-auto shadow-2xl backdrop-blur-md">
            <img
              src="/cervos-company-logo-circular.svg"
              alt="Cervos Logo"
              className="w-16 h-16 object-contain animate-pulse"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/logo.png";
              }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight text-slate-100">Cervos Pharmacy OS</h1>
          <p className="text-xs text-slate-400">
            {offline
              ? "You are currently offline. Check your network connection to access your live pharmacy database."
              : "Launching Cervos POS workspace..."}
          </p>
        </div>

        {offline ? (
          <div className="space-y-3 pt-2">
            <button
              onClick={() => {
                if (navigator.onLine) {
                  window.location.replace(`${WEB_URL}/app`);
                } else {
                  window.location.reload();
                }
              }}
              className="w-full py-3 px-4 rounded-xl bg-[#1039B9] hover:bg-[#0c2d8a] text-white text-xs font-semibold tracking-wide transition-all shadow-lg cursor-pointer"
            >
              Retry Connection
            </button>
            <p className="text-[11px] text-slate-500">
              Offline sales made on POS will sync automatically when your connection is restored.
            </p>
          </div>
        ) : (
          <div className="flex justify-center items-center gap-2 text-xs text-[#38BDF8]">
            <div className="w-2 h-2 rounded-full bg-[#38BDF8] animate-ping" />
            <span>Connecting to live cloud workspace...</span>
          </div>
        )}
      </div>
    </div>
  );
}
