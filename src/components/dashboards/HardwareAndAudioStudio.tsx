"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  pairBluetoothPrinter,
  pairSerialThermalPrinter,
  pairUsbThermalPrinter,
  printThermalTestSlip,
  probeBrowserHardwareCapabilities,
  saveHardwareConfig,
  type BrowserHardwareCapabilities,
  type HardwareConfigState,
} from "@/lib/hardware/devices";
import {
  getSoundVolume,
  isSoundMuted,
  playAppSound,
  setSoundMuted,
  setSoundVolume,
} from "@/lib/sounds";

interface HardwareAndAudioStudioProps {
  orgName: string;
  branchName: string;
  hwConfig: HardwareConfigState;
  onHwConfigChange: (next: HardwareConfigState) => void;
  isDark: boolean;
  isSw: boolean;
  accent: string;
}

export default function HardwareAndAudioStudio({
  orgName,
  branchName,
  hwConfig,
  onHwConfigChange,
  isDark,
  isSw,
  accent,
}: HardwareAndAudioStudioProps) {
  const [caps, setCaps] = useState<BrowserHardwareCapabilities | null>(null);
  const [hwBusy, setHwBusy] = useState<string | null>(null);
  const [hwNotice, setHwNotice] = useState<{ ok: boolean; text: string } | null>(null);

  // Scanner calibration
  const [wedgeTestValue, setWedgeTestValue] = useState("");
  const lastKeyTimeRef = useRef<number>(0);
  const fastBurstCountRef = useRef<number>(0);

  // Audio controls
  const [muted, setMutedState] = useState(false);
  const [volume, setVolumeState] = useState(0.7);

  // Quick In-App HQ Support Ticket
  const [supSubject, setSupSubject] = useState("");
  const [supMsg, setSupMsg] = useState("");
  const [supCat, setSupCat] = useState<"technical" | "billing" | "general">("technical");
  const [supBusy, setSupBusy] = useState(false);
  const [supNotice, setSupNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setMutedState(isSoundMuted());
    setVolumeState(getSoundVolume());
    void probeBrowserHardwareCapabilities().then(setCaps);
  }, []);

  const updateConfig = (patch: Partial<HardwareConfigState>) => {
    const next: HardwareConfigState = {
      ...hwConfig,
      ...patch,
      lastTestedAt: new Date().toISOString(),
    };
    saveHardwareConfig(next);
    onHwConfigChange(next);
  };

  const handlePairSerial = async () => {
    setHwBusy("serial");
    setHwNotice(null);
    try {
      const res = await pairSerialThermalPrinter();
      if (!res.ok) {
        playAppSound("alert");
        setHwNotice({ ok: false, text: res.error || "Serial pairing failed." });
        return;
      }
      updateConfig({ printerTransport: "web_serial", printerName: res.name || "Serial Thermal Printer" });
      playAppSound("scan");
      setHwNotice({ ok: true, text: `Paired ${res.name} via Web Serial.` });
      setCaps(await probeBrowserHardwareCapabilities());
    } finally {
      setHwBusy(null);
    }
  };

  const handlePairUsb = async () => {
    setHwBusy("usb");
    setHwNotice(null);
    try {
      const res = await pairUsbThermalPrinter();
      if (!res.ok) {
        playAppSound("alert");
        setHwNotice({ ok: false, text: res.error || "USB pairing failed." });
        return;
      }
      updateConfig({ printerTransport: "web_usb", printerName: res.name || "USB ESC/POS Printer" });
      playAppSound("scan");
      setHwNotice({ ok: true, text: `Paired ${res.name} via WebUSB.` });
      setCaps(await probeBrowserHardwareCapabilities());
    } finally {
      setHwBusy(null);
    }
  };

  const handlePairBluetooth = async () => {
    setHwBusy("bt");
    setHwNotice(null);
    try {
      const res = await pairBluetoothPrinter();
      if (!res.ok) {
        playAppSound("alert");
        setHwNotice({ ok: false, text: res.error || "Bluetooth pairing failed." });
        return;
      }
      updateConfig({ printerTransport: "bluetooth", printerName: res.name || "Bluetooth Thermal" });
      playAppSound("scan");
      setHwNotice({ ok: true, text: `Paired ${res.name} over Bluetooth.` });
    } finally {
      setHwBusy(null);
    }
  };

  const handleTestPrint = async () => {
    setHwBusy("print");
    setHwNotice(null);
    try {
      const res = await printThermalTestSlip({
        orgName,
        branchName,
        paperWidthMm: hwConfig.paperWidthMm,
        cfg: hwConfig,
      });
      if (!res.ok) {
        playAppSound("alert");
        setHwNotice({ ok: false, text: res.error || "Test print failed." });
        return;
      }
      playAppSound("sale-complete");
      setHwNotice({ ok: true, text: `Sent diagnostic test slip via ${res.mode}.` });
    } finally {
      setHwBusy(null);
    }
  };

  const handleSendSupportTicket = async (e: FormEvent) => {
    e.preventDefault();
    if (supSubject.trim().length < 3 || supMsg.trim().length < 8) return;
    setSupBusy(true);
    setSupNotice(null);
    try {
      const res = await fetch("/api/workspace/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_support_ticket",
          subject: supSubject.trim(),
          message: supMsg.trim(),
          category: supCat,
        }),
      });
      const out = (await res.json()) as {
        ok?: boolean;
        error?: string;
        ticket?: { ticketRef: string };
      };
      if (!res.ok || !out.ok) {
        playAppSound("alert");
        setSupNotice({ ok: false, text: out.error || "Could not submit ticket." });
        return;
      }
      playAppSound("notify");
      setSupSubject("");
      setSupMsg("");
      setSupNotice({
        ok: true,
        text: `Support ticket ${out.ticket?.ticketRef || ""} sent to Cervos HQ Desk. Replies appear in your HQ Inbox.`,
      });
    } finally {
      setSupBusy(false);
    }
  };

  const cardCls = isDark
    ? "bg-[#11161F] border-slate-800 text-slate-100"
    : "bg-white border-[#EAECF0] text-[#111317]";
  const chipCls = isDark
    ? "bg-[#171D28] border-slate-800 text-slate-200"
    : "bg-[#F8FAFC] border-[#EAECF0] text-[#111317]";
  const inputCls = isDark
    ? "bg-[#090C12] border-slate-700 text-slate-100 placeholder:text-slate-500"
    : "bg-[#F8FAFC] border-[#CBD5E1] text-[#111317] placeholder:text-slate-400";
  const mutedCls = isDark ? "text-slate-400" : "text-[#64748B]";

  const isDirectHardware =
    hwConfig.printerTransport === "web_serial" ||
    hwConfig.printerTransport === "web_usb" ||
    hwConfig.printerTransport === "bluetooth";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
      {/* Left: Real Hardware Pairing, Scanner Calibration & Troubleshooting */}
      <div className={`lg:col-span-7 rounded-[24px] border p-6 space-y-4 ${cardCls}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>
              {isSw ? "VIFAA HALISI & UTATUZI" : "HARDWARE SETUP & TROUBLESHOOTING"}
            </div>
            <h3 className="text-sm font-semibold mt-0.5">
              {isSw
                ? "Printa ya Risiti, Skana ya Msimbopau na Ukaguzi Halisi"
                : "Thermal Receipt Printer, Scanner Calibration & Browser Diagnostics"}
            </h3>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-[10px] font-bold ${
              isDirectHardware
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
            }`}
          >
            {isDirectHardware
              ? `Paired: ${hwConfig.printerName}`
              : "System Print Only (No Direct USB/BT Paired)"}
          </span>
        </div>

        {hwNotice && (
          <div
            className={`p-3 rounded-2xl border text-xs font-medium ${
              hwNotice.ok
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                : "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300"
            }`}
          >
            {hwNotice.text}
          </div>
        )}

        {/* Real Browser Capabilities Probe */}
        {caps && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            {[
              { label: "HTTPS Context", ok: caps.isSecureContext, detail: caps.isSecureContext ? "Secure OK" : "Needs HTTPS" },
              { label: "Web Serial", ok: caps.supportsSerial, detail: caps.supportsSerial ? `${caps.authorizedSerialPorts} port(s)` : "OS Print fallback" },
              { label: "WebUSB / BT", ok: caps.supportsUsb || caps.supportsBluetooth, detail: `${caps.authorizedUsbDevices} USB` },
              { label: "Camera QR", ok: caps.supportsCamera && caps.cameraPermission !== "denied", detail: caps.cameraPermission },
            ].map((item) => (
              <div key={item.label} className={`p-2.5 rounded-xl border ${chipCls}`}>
                <div className={`text-[10px] ${mutedCls}`}>{item.label}</div>
                <div className={`font-bold mt-0.5 ${item.ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-300"}`}>
                  {item.detail}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pair Buttons & Paper Width */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={hwBusy !== null}
            onClick={handlePairSerial}
            className="px-3.5 py-2 rounded-full text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            style={{ backgroundColor: accent }}
          >
            {hwBusy === "serial" && <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />}
            <span>Pair Serial / COM Printer</span>
          </button>
          <button
            type="button"
            disabled={hwBusy !== null}
            onClick={handlePairUsb}
            className={`px-3.5 py-2 rounded-full border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${chipCls}`}
          >
            {hwBusy === "usb" && <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />}
            <span>Pair USB Printer</span>
          </button>
          <button
            type="button"
            disabled={hwBusy !== null}
            onClick={handlePairBluetooth}
            className={`px-3.5 py-2 rounded-full border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${chipCls}`}
          >
            {hwBusy === "bt" && <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />}
            <span>Pair Bluetooth</span>
          </button>
          <button
            type="button"
            disabled={hwBusy !== null}
            onClick={handleTestPrint}
            className={`px-3.5 py-2 rounded-full border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${chipCls}`}
          >
            {hwBusy === "print" && <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />}
            <span>Test Print ({hwConfig.paperWidthMm}mm)</span>
          </button>
        </div>

        <div className={`p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 text-xs ${chipCls}`}>
          <div className="flex items-center gap-2">
            <span className={mutedCls}>Roll Width:</span>
            {([58, 80] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => updateConfig({ paperWidthMm: w })}
                className={`px-3 py-1 rounded-full font-semibold cursor-pointer ${
                  hwConfig.paperWidthMm === w ? "text-white" : `border ${cardCls}`
                }`}
                style={hwConfig.paperWidthMm === w ? { backgroundColor: accent } : undefined}
              >
                {w}mm
              </button>
            ))}
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hwConfig.autoPrintOnSale}
              onChange={(e) => updateConfig({ autoPrintOnSale: e.target.checked })}
            />
            <span>Auto-trigger print after POS checkout</span>
          </label>
          {isDirectHardware && (
            <button
              type="button"
              onClick={() =>
                updateConfig({ printerTransport: "system_print", printerName: "OS System Print Dialog" })
              }
              className="text-[11px] font-semibold text-rose-500 hover:underline cursor-pointer"
            >
              Reset to OS Print
            </button>
          )}
        </div>

        {/* Scanner Wedge Calibration Box */}
        <div className={`p-3.5 rounded-2xl border space-y-2 text-xs ${chipCls}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">Barcode Scanner Wedge Calibration</span>
            <span className={`font-mono text-[10px] ${hwConfig.scannerTransport === "unverified" ? "text-amber-500" : "text-emerald-500"}`}>
              {hwConfig.scannerName}
            </span>
          </div>
          <input
            type="text"
            value={wedgeTestValue}
            onKeyDown={(e) => {
              const now = performance.now();
              if (now - lastKeyTimeRef.current < 65) {
                fastBurstCountRef.current += 1;
              } else if (e.key.length === 1) {
                fastBurstCountRef.current = 0;
              }
              lastKeyTimeRef.current = now;
              if (e.key === "Enter" && wedgeTestValue.trim().length >= 3) {
                e.preventDefault();
                const isHardwareBurst = fastBurstCountRef.current >= 3;
                updateConfig({
                  scannerTransport: "keyboard_wedge",
                  scannerName: isHardwareBurst
                    ? "Verified HID Barcode Scanner (Enter Suffix OK)"
                    : "Verified Manual / Scanner Input",
                });
                playAppSound("scan");
                setHwNotice({
                  ok: true,
                  text: `Scanner input verified (${wedgeTestValue.trim()}) — ${isHardwareBurst ? "HID hardware burst detected" : "Enter suffix confirmed"}.`,
                });
                setWedgeTestValue("");
              }
            }}
            onChange={(e) => setWedgeTestValue(e.target.value)}
            placeholder="Click here and scan ANY medicine box barcode to verify your scanner..."
            className={`w-full px-3.5 py-2 rounded-xl border font-mono text-xs ${inputCls}`}
          />
        </div>

        {/* Interactive Troubleshooting Playbook */}
        <details className={`p-3.5 rounded-2xl border text-xs ${chipCls}`}>
          <summary className="font-semibold cursor-pointer">
            Hardware Troubleshooting Guide (Printer / USB / Bluetooth / Scanner)
          </summary>
          <ul className={`mt-2.5 space-y-1.5 list-disc pl-4 leading-relaxed ${mutedCls}`}>
            <li>
              <strong>Thermal roll feeds blank:</strong> Flip the thermal paper roll upside down — thermal ink only prints on the coated outer face.
            </li>
            <li>
              <strong>USB printer shows Access Denied:</strong> Windows spooler drivers lock WebUSB interfaces. Either install via Windows Printers &amp; use <em>OS System Print (58mm/80mm)</em>, or connect via COM/Serial Port.
            </li>
            <li>
              <strong>Scanner types numbers but does not add to cart:</strong> Scan the <em>Add Enter / CR Suffix</em> configuration barcode in your scanner leaflet, then verify using the calibration box above.
            </li>
            <li>
              <strong>Camera QR blocked on Android / iPhone:</strong> Confirm URL is <span className="font-mono">https://cervos.online</span> and grant Camera permission in site settings.
            </li>
          </ul>
        </details>
      </div>

      {/* Right: Curated Sound Studio + Direct HQ Support Ticket */}
      <div className="lg:col-span-5 space-y-4">
        <div className={`rounded-[24px] border p-6 space-y-3.5 ${cardCls}`}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>
                AUDIO FEEDBACK
              </div>
              <h3 className="text-sm font-semibold mt-0.5">Counter &amp; Notification Sounds</h3>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !muted;
                setSoundMuted(next);
                setMutedState(next);
                if (!next) playAppSound("tap");
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${
                muted ? "bg-rose-500/15 text-rose-500" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
              }`}
            >
              {muted ? "Muted" : "Sounds ON"}
            </button>
          </div>
          <div className="space-y-1">
            <div className={`flex justify-between text-[11px] ${mutedCls}`}>
              <span>Counter Volume</span>
              <span className="font-mono">{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              onChange={(e) => {
                const v = Number(e.target.value) / 100;
                setSoundVolume(v);
                setVolumeState(v);
              }}
              className="w-full"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { kind: "scan", label: "Test Scan" },
                { kind: "cart-add", label: "Test Cart" },
                { kind: "sale-complete", label: "Test Receipt" },
                { kind: "shift-clock", label: "Test Shift" },
                { kind: "alert", label: "Test Alert" },
              ] as const
            ).map((btn) => (
              <button
                key={btn.kind}
                type="button"
                onClick={() => playAppSound(btn.kind)}
                className={`px-2.5 py-1.5 rounded-full border text-[11px] font-semibold cursor-pointer ${chipCls}`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSendSupportTicket} className={`rounded-[24px] border p-6 space-y-3 ${cardCls}`}>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>
              CERVOS HQ SUPPORT DESK
            </div>
            <h3 className="text-sm font-semibold mt-0.5">Need Help? Open Direct HQ Ticket</h3>
          </div>
          {supNotice && (
            <div
              className={`p-2.5 rounded-xl border text-[11px] font-medium ${
                supNotice.ok
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-500"
              }`}
            >
              {supNotice.text}
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              value={supSubject}
              onChange={(e) => setSupSubject(e.target.value)}
              placeholder="Short subject..."
              required
              className={`col-span-2 px-3 py-2 rounded-xl border text-xs ${inputCls}`}
            />
            <select
              value={supCat}
              onChange={(e) => setSupCat(e.target.value as "technical" | "billing" | "general")}
              className={`px-2.5 py-2 rounded-xl border text-xs ${inputCls}`}
            >
              <option value="technical">Hardware / Tech</option>
              <option value="billing">Billing / Kasri</option>
              <option value="general">General</option>
            </select>
          </div>
          <textarea
            rows={2}
            value={supMsg}
            onChange={(e) => setSupMsg(e.target.value)}
            placeholder="Describe printer, stock, or billing question for Cervos HQ Support..."
            required
            className={`w-full px-3 py-2 rounded-xl border text-xs ${inputCls}`}
          />
          <button
            type="submit"
            disabled={supBusy || supSubject.trim().length < 3 || supMsg.trim().length < 8}
            className="w-full py-2.5 rounded-full text-white text-xs font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            style={{ backgroundColor: accent }}
          >
            {supBusy && <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />}
            <span>{supBusy ? "Sending to HQ..." : "Submit Support Ticket"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
