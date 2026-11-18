/**
 * @file lib/hardware/devices.ts
 * @description Real Web Serial / Web USB / Web Bluetooth / Keyboard-Wedge scanner &
 * thermal receipt printer hardware diagnostics, pairing, ESC/POS printing, and
 * user-facing troubleshooting helpers. Never reports hardware "Ready" unless verified.
 */

export type PrinterTransport = "none" | "web_serial" | "web_usb" | "bluetooth" | "system_print";
export type ScannerTransport = "unverified" | "keyboard_wedge" | "camera";

export interface HardwareConfigState {
  printerTransport: PrinterTransport;
  printerName: string;
  paperWidthMm: 58 | 80;
  autoPrintOnSale: boolean;
  scannerTransport: ScannerTransport;
  scannerName: string;
  lastTestedAt?: string;
}

export interface BrowserHardwareCapabilities {
  isSecureContext: boolean;
  supportsSerial: boolean;
  supportsUsb: boolean;
  supportsBluetooth: boolean;
  supportsCamera: boolean;
  cameraPermission: "granted" | "denied" | "prompt" | "unknown";
  authorizedSerialPorts: number;
  authorizedUsbDevices: number;
}

const HW_CONFIG_KEY = "cervos-hw-config-v1";

export const DEFAULT_HARDWARE_CONFIG: HardwareConfigState = {
  printerTransport: "system_print",
  printerName: "OS System Print Dialog",
  paperWidthMm: 80,
  autoPrintOnSale: false,
  scannerTransport: "unverified",
  scannerName: "Not yet calibrated",
};

export function loadHardwareConfig(): HardwareConfigState {
  if (typeof window === "undefined") return DEFAULT_HARDWARE_CONFIG;
  try {
    const raw = window.localStorage.getItem(HW_CONFIG_KEY);
    if (!raw) return DEFAULT_HARDWARE_CONFIG;
    const parsed = JSON.parse(raw) as Partial<HardwareConfigState>;
    return {
      printerTransport:
        parsed.printerTransport === "web_serial" ||
        parsed.printerTransport === "web_usb" ||
        parsed.printerTransport === "bluetooth" ||
        parsed.printerTransport === "system_print" ||
        parsed.printerTransport === "none"
          ? parsed.printerTransport
          : "system_print",
      printerName:
        typeof parsed.printerName === "string" && parsed.printerName.trim()
          ? parsed.printerName.trim()
          : DEFAULT_HARDWARE_CONFIG.printerName,
      paperWidthMm: parsed.paperWidthMm === 58 ? 58 : 80,
      autoPrintOnSale: Boolean(parsed.autoPrintOnSale),
      scannerTransport:
        parsed.scannerTransport === "keyboard_wedge" ||
        parsed.scannerTransport === "camera"
          ? parsed.scannerTransport
          : "unverified",
      scannerName:
        typeof parsed.scannerName === "string" && parsed.scannerName.trim()
          ? parsed.scannerName.trim()
          : DEFAULT_HARDWARE_CONFIG.scannerName,
      lastTestedAt: typeof parsed.lastTestedAt === "string" ? parsed.lastTestedAt : undefined,
    };
  } catch {
    return DEFAULT_HARDWARE_CONFIG;
  }
}

export function saveHardwareConfig(cfg: HardwareConfigState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HW_CONFIG_KEY, JSON.stringify(cfg));
  } catch {
    // Ignore storage errors
  }
}

export async function probeBrowserHardwareCapabilities(): Promise<BrowserHardwareCapabilities> {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      isSecureContext: false,
      supportsSerial: false,
      supportsUsb: false,
      supportsBluetooth: false,
      supportsCamera: false,
      cameraPermission: "unknown",
      authorizedSerialPorts: 0,
      authorizedUsbDevices: 0,
    };
  }

  const nav = navigator as Navigator & {
    serial?: { getPorts?: () => Promise<unknown[]> };
    usb?: { getDevices?: () => Promise<unknown[]> };
    bluetooth?: unknown;
  };

  const supportsSerial = Boolean(nav.serial);
  const supportsUsb = Boolean(nav.usb);
  const supportsBluetooth = Boolean(nav.bluetooth);
  const supportsCamera = Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  let authorizedSerialPorts = 0;
  let authorizedUsbDevices = 0;
  let cameraPermission: BrowserHardwareCapabilities["cameraPermission"] = "unknown";

  if (supportsSerial && nav.serial?.getPorts) {
    try {
      const ports = await nav.serial.getPorts();
      authorizedSerialPorts = ports.length;
    } catch {
      authorizedSerialPorts = 0;
    }
  }
  if (supportsUsb && nav.usb?.getDevices) {
    try {
      const devices = await nav.usb.getDevices();
      authorizedUsbDevices = devices.length;
    } catch {
      authorizedUsbDevices = 0;
    }
  }
  if (navigator.permissions?.query) {
    try {
      const status = await navigator.permissions.query({ name: "camera" as PermissionName });
      if (status.state === "granted" || status.state === "denied" || status.state === "prompt") {
        cameraPermission = status.state;
      }
    } catch {
      cameraPermission = "unknown";
    }
  }

  return {
    isSecureContext: Boolean(window.isSecureContext),
    supportsSerial,
    supportsUsb,
    supportsBluetooth,
    supportsCamera,
    cameraPermission,
    authorizedSerialPorts,
    authorizedUsbDevices,
  };
}

export async function pairSerialThermalPrinter(): Promise<{
  ok: boolean;
  name?: string;
  error?: string;
}> {
  if (typeof navigator === "undefined") return { ok: false, error: "Browser runtime required." };
  const nav = navigator as Navigator & {
    serial?: { requestPort: () => Promise<{ getInfo?: () => { usbVendorId?: number; usbProductId?: number } }> };
  };
  if (!nav.serial?.requestPort) {
    return {
      ok: false,
      error: "Web Serial is not supported in this browser. Use Chrome/Edge on desktop, or switch to OS System Print.",
    };
  }
  try {
    const port = await nav.serial.requestPort();
    const info = port.getInfo?.();
    const label = info?.usbVendorId
      ? `USB Serial Printer (VID ${info.usbVendorId.toString(16).toUpperCase()})`
      : "Serial Thermal Printer";
    return { ok: true, name: label };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (/cancel|abort|NotFoundError/i.test(msg)) {
      return { ok: false, error: "Printer pairing cancelled — no serial port selected." };
    }
    return { ok: false, error: msg || "Could not open serial port picker." };
  }
}

export async function pairUsbThermalPrinter(): Promise<{
  ok: boolean;
  name?: string;
  error?: string;
}> {
  if (typeof navigator === "undefined") return { ok: false, error: "Browser runtime required." };
  const nav = navigator as Navigator & {
    usb?: { requestDevice: (opts: { filters: Array<Record<string, number>> }) => Promise<{ productName?: string; manufacturerName?: string }> };
  };
  if (!nav.usb?.requestDevice) {
    return {
      ok: false,
      error: "WebUSB is unavailable here. Use OS System Print or Desktop app.",
    };
  }
  try {
    // Request common USB printer class (classCode 7)
    const dev = await nav.usb.requestDevice({ filters: [{ classCode: 7 }] });
    const label = [dev.manufacturerName, dev.productName].filter(Boolean).join(" ") || "USB ESC/POS Printer";
    return { ok: true, name: label };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (/cancel|abort|NotFoundError/i.test(msg)) {
      return { ok: false, error: "No USB printer selected (or OS kernel driver holds USB interface — try Serial or OS Print)." };
    }
    return { ok: false, error: msg || "Unable to pair USB printer." };
  }
}

export async function pairBluetoothPrinter(): Promise<{
  ok: boolean;
  name?: string;
  error?: string;
}> {
  if (typeof navigator === "undefined") return { ok: false, error: "Browser runtime required." };
  const nav = navigator as Navigator & {
    bluetooth?: {
      requestDevice: (opts: { acceptAllDevices?: boolean; optionalServices?: string[] }) => Promise<{ name?: string }>;
    };
  };
  if (!nav.bluetooth?.requestDevice) {
    return {
      ok: false,
      error: "Web Bluetooth is unavailable on this browser. Pair Bluetooth printer in OS Bluetooth settings and use System Print.",
    };
  }
  try {
    const device = await nav.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ["000018f0-0000-1000-8000-00805f9b34fb"],
    });
    return { ok: true, name: device.name || "Bluetooth Thermal Printer" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (/cancel|abort|NotFoundError/i.test(msg)) {
      return { ok: false, error: "Bluetooth device selection cancelled." };
    }
    return { ok: false, error: msg || "Bluetooth pairing failed." };
  }
}

/**
 * Prints an ESC/POS plain slip to an already-authorized Web Serial printer when paired,
 * or opens a formatted 58mm/80mm thermal slip print dialog for OS printers.
 */
export async function printThermalTestSlip(opts: {
  orgName: string;
  branchName: string;
  paperWidthMm: 58 | 80;
  cfg: HardwareConfigState;
}): Promise<{ ok: boolean; mode: string; error?: string }> {
  if (typeof window === "undefined") return { ok: false, mode: "none", error: "Client required." };

  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  if (opts.cfg.printerTransport === "web_serial") {
    const nav = navigator as Navigator & {
      serial?: {
        getPorts: () => Promise<
          Array<{
            open: (o: { baudRate: number }) => Promise<void>;
            close: () => Promise<void>;
            writable: WritableStream<Uint8Array> | null;
          }>
        >;
      };
    };
    try {
      const ports = (await nav.serial?.getPorts()) ?? [];
      if (ports.length > 0) {
        const port = ports[0];
        await port.open({ baudRate: 9600 });
        const writer = port.writable?.getWriter();
        if (writer) {
          const text =
            `\x1B\x40` + // ESC @ initialize
            `${opts.orgName}\n${opts.branchName}\n` +
            `HARDWARE DIAGNOSTIC SLIP (${opts.paperWidthMm}mm)\n` +
            `Timestamp: ${now}\n` +
            `Printer: ${opts.cfg.printerName}\n` +
            `Status: VERIFIED OK\n\n\n` +
            `\x1D\x56\x41\x03`; // GS V cut
          await writer.write(new TextEncoder().encode(text));
          writer.releaseLock();
        }
        await port.close();
        return { ok: true, mode: "ESC/POS Serial" };
      }
    } catch (err) {
      return {
        ok: false,
        mode: "ESC/POS Serial",
        error: err instanceof Error ? err.message : "Failed writing ESC/POS bytes to serial printer.",
      };
    }
  }

  // Fallback to formatted thermal print window
  const w = window.open("", "_blank", "width=420,height=640");
  if (!w) {
    return {
      ok: false,
      mode: "OS Print",
      error: "Pop-up blocked. Allow pop-ups for cervos.online to print counter receipts.",
    };
  }
  const widthCss = opts.paperWidthMm === 58 ? "58mm" : "80mm";
  w.document.write(`<!doctype html><html><head><title>Cervos Test Slip</title>
    <style>
      body{font-family:ui-monospace,Consolas,monospace;width:${widthCss};margin:12px auto;font-size:12px;color:#0f172a}
      h1{font-size:14px;margin:0 0 4px}
      hr{border:none;border-top:1px dashed #94a3b8;margin:10px 0}
    </style></head><body>
    <h1>${opts.orgName}</h1>
    <div>Branch: ${opts.branchName}</div>
    <hr/>
    <div><strong>COUNTER PRINTER TEST (${opts.paperWidthMm}mm)</strong></div>
    <div>Date: ${now}</div>
    <div>Mode: ${opts.cfg.printerName}</div>
    <div>Barcode Scanner: ${opts.cfg.scannerName}</div>
    <hr/>
    <div>If this slip prints sharply without cutoffs, counter printing is verified.</div>
    <script>window.onload=function(){window.print();}</script>
  </body></html>`);
  w.document.close();
  return { ok: true, mode: `OS Print (${opts.paperWidthMm}mm)` };
}
