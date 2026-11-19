import { afterEach, describe, it, expect, vi } from "vitest";
import { arrayToCSV, exportCleanPdfReport } from "@/lib/export";
import {
  NATIVE_BRIDGE_EVENT,
  detectNativeShellHost,
  isNativeShellContainer,
  playNativeSound,
  requestNativeBarcodeScan,
  requestNativePrint,
  subscribeNativeBridgeEvents,
  triggerNativeHaptic,
} from "@/lib/native-bridge";
import {
  DEFAULT_HARDWARE_CONFIG,
  printThermalTestSlip,
  probeBrowserHardwareCapabilities,
} from "@/lib/hardware/devices";

describe("arrayToCSV", () => {
  const columns = [
    { key: "name" as const, header: "Name" },
    { key: "age" as const, header: "Age" },
  ];

  it("converts basic data to CSV", () => {
    const rows = [
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ];

    const csv = arrayToCSV(rows, columns);
    const lines = csv.split("\n");

    expect(lines[0]).toBe('"Name","Age"');
    expect(lines[1]).toBe('"Alice","30"');
    expect(lines[2]).toBe('"Bob","25"');
  });

  it("escapes double quotes in values", () => {
    const rows = [{ name: 'Say "hello"', age: 20 }];
    const csv = arrayToCSV(rows, columns);

    expect(csv).toContain('"Say ""hello"""');
  });

  it("handles null and undefined values as empty strings", () => {
    const rows = [
      { name: "Alice", age: null },
      { name: undefined, age: 25 },
    ];
    const csv = arrayToCSV(rows, columns);
    const lines = csv.split("\n");

    expect(lines[1]).toBe('"Alice",""');
    expect(lines[2]).toBe('"","25"');
  });

  it("returns only the header row for an empty array", () => {
    const csv = arrayToCSV([], columns);

    expect(csv).toBe('"Name","Age"');
  });

  it("handles a single row", () => {
    const rows = [{ name: "Alice", age: 30 }];
    const csv = arrayToCSV(rows, columns);
    const lines = csv.split("\n");

    expect(lines).toHaveLength(2);
  });
});

interface MockNativeWindow extends Window {
  ReactNativeWebView?: { postMessage: (msg: string) => void };
  CervosNativeBridge?: { postMessage?: (msg: string) => void };
}

describe("Two-Tier PWA <-> Native Hardware Bridge", () => {
  afterEach(() => {
    const win = window as MockNativeWindow;
    delete win.ReactNativeWebView;
    delete win.CervosNativeBridge;
    vi.restoreAllMocks();
  });

  it("detects browser by default and react_native_webview when native bridge is injected", () => {
    expect(detectNativeShellHost()).toBe("browser");
    expect(isNativeShellContainer()).toBe(false);

    const win = window as MockNativeWindow;
    win.CervosNativeBridge = { postMessage: vi.fn() };
    expect(detectNativeShellHost()).toBe("react_native_webview");
    expect(isNativeShellContainer()).toBe(true);

    delete win.CervosNativeBridge;
    win.ReactNativeWebView = { postMessage: vi.fn() };
    expect(detectNativeShellHost()).toBe("react_native_webview");
    expect(isNativeShellContainer()).toBe(true);
  });

  it("emits valid cervos-pwa-bridge v1 envelopes and short-circuits browser fallbacks", async () => {
    const captured: Array<Record<string, unknown>> = [];
    const win = window as MockNativeWindow;
    win.CervosNativeBridge = {
      postMessage: (msg: string) => {
        captured.push(JSON.parse(msg) as Record<string, unknown>);
      },
    };

    const createElementSpy = vi.spyOn(document, "createElement");
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    expect(requestNativeBarcodeScan("pos")).toBe(true);
    expect(playNativeSound("scan", 0.8)).toBe(true);
    expect(triggerNativeHaptic("success")).toBe(true);
    expect(requestNativePrint("<html><body>Receipt</body></html>", 80)).toBe(true);

    exportCleanPdfReport({
      orgName: "Cervos Care",
      branchName: "Kinondoni Main",
      title: "Shift Receipt",
      subtitle: "POS Counter",
      generatedLabel: "2026-11-19",
      lang: "EN",
      metrics: [{ label: "Total", value: "TZS 12,000" }],
      tables: [],
    });

    const slipRes = await printThermalTestSlip({
      orgName: "Cervos Care",
      branchName: "Kinondoni Main",
      paperWidthMm: 58,
      cfg: DEFAULT_HARDWARE_CONFIG,
    });

    expect(slipRes).toEqual({ ok: true, mode: "Native Print (58mm)" });
    expect(createElementSpy).not.toHaveBeenCalledWith("iframe");
    expect(openSpy).not.toHaveBeenCalled();

    expect(captured).toHaveLength(6);
    for (const msg of captured) {
      expect(msg.channel).toBe("cervos-pwa-bridge");
      expect(msg.version).toBe(1);
    }
    expect(captured.map((m) => m.type)).toEqual([
      "hardware:scan_barcode",
      "feedback:sound",
      "feedback:haptic",
      "hardware:print_receipt",
      "hardware:print_receipt",
      "hardware:print_receipt",
    ]);
    expect(captured[0].payload).toEqual({ context: "pos" });
    expect(captured[5].payload).toMatchObject({ paperWidthMm: 58 });
  });

  it("reports camera hardware available in native shell without navigator.mediaDevices", async () => {
    const win = window as MockNativeWindow;
    win.CervosNativeBridge = { postMessage: vi.fn() };
    const caps = await probeBrowserHardwareCapabilities();
    expect(caps.supportsCamera).toBe(true);
    expect(caps.cameraPermission).toBe("granted");
  });

  it("delivers inbound CustomEvent and window.postMessage events and deduplicates matching eventId", () => {
    const received: Array<{ type: string; payload?: Record<string, unknown>; eventId?: string }> = [];
    const unsubscribe = subscribeNativeBridgeEvents((ev) => {
      received.push(ev);
    });

    window.dispatchEvent(
      new CustomEvent(NATIVE_BRIDGE_EVENT, {
        detail: {
          channel: "cervos-native-bridge",
          eventId: "evt-dedupe-1",
          type: "native:barcode_scanned",
          payload: { code: "8901234567890", context: "pos" },
        },
      })
    );

    window.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({
          channel: "cervos-native-bridge",
          eventId: "evt-dedupe-1",
          type: "native:barcode_scanned",
          payload: { code: "8901234567890", context: "pos" },
        }),
      })
    );

    window.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({
          channel: "cervos-native-bridge",
          eventId: "evt-unique-2",
          type: "native:sync_requested",
          payload: {},
        }),
      })
    );

    unsubscribe();

    expect(received).toHaveLength(2);
    expect(received[0]).toMatchObject({
      type: "native:barcode_scanned",
      eventId: "evt-dedupe-1",
      payload: { code: "8901234567890", context: "pos" },
    });
    expect(received[1]).toMatchObject({
      type: "native:sync_requested",
      eventId: "evt-unique-2",
    });
  });
});
