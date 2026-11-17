import { createHash, timingSafeEqual } from "crypto";

export interface NotificationEnvStatus {
  hqEndpointConfigured: boolean;
  exceptionWebhookConfigured: boolean;
  exceptionEmailConfigured: boolean;
  exceptionEmailMasked: string | null;
  textifyConfigured: boolean;
  textifySenderName: string;
  trialGraceDays: number;
  mode: "production" | "staging" | "mock";
}

function maskEmail(email: string | undefined): string | null {
  if (!email || !email.includes("@")) return null;
  const [user, domain] = email.split("@");
  if (!user || !domain) return null;
  const prefix = user.slice(0, 2);
  return `${prefix}***@${domain}`;
}

export function getNotificationEnvStatus(): NotificationEnvStatus {
  const hqSecret = process.env.CERVOS_HQ_WEBHOOK_SECRET || process.env.HQ_SECRET || "";
  const webhookUrl = (process.env.CERVOS_EXCEPTION_WEBHOOK_URL || "").trim();
  const email = (process.env.CERVOS_EXCEPTION_EMAIL || "").trim();
  const textifyKey = (process.env.TEXTIFY_API_KEY || "").trim();
  const senderName = (process.env.TEXTIFY_SENDER_NAME || "Nama").trim() || "Nama";
  const graceRaw = Number(process.env.CERVOS_TRIAL_GRACE_DAYS || 15);
  const trialGraceDays = Number.isFinite(graceRaw) && graceRaw > 0 ? graceRaw : 15;
  const isMock = process.env.NEXT_PUBLIC_MOCK_MODE === "true" || process.env.CERVOS_MOCK_AUTH === "true";

  return {
    hqEndpointConfigured: Boolean(hqSecret && !hqSecret.includes("REPLACE-WITH")),
    exceptionWebhookConfigured: Boolean(webhookUrl && /^https?:\/\//i.test(webhookUrl)),
    exceptionEmailConfigured: Boolean(email && email.includes("@")),
    exceptionEmailMasked: maskEmail(email),
    textifyConfigured: Boolean(textifyKey && textifyKey.length >= 16 && !/YOUR-|REPLACE-/i.test(textifyKey)),
    textifySenderName: senderName,
    trialGraceDays,
    mode: isMock ? "mock" : process.env.NODE_ENV === "production" ? "production" : "staging",
  };
}

export function isValidHqSecret(supplied: string | null | undefined): boolean {
  const configured = (process.env.CERVOS_HQ_WEBHOOK_SECRET || process.env.HQ_SECRET || "").trim();
  const candidate = (supplied ?? "").trim();
  if (
    !configured ||
    configured.length < 24 ||
    /REPLACE-WITH|YOUR-|placeholder/i.test(configured) ||
    !candidate
  ) {
    return false;
  }
  const a = createHash("sha256").update(candidate, "utf8").digest();
  const b = createHash("sha256").update(configured, "utf8").digest();
  return timingSafeEqual(a, b);
}

export async function sendTextifySms(params: {
  to: string;
  message: string;
  sender?: string;
}): Promise<{ delivered: boolean; channel: "textify" | "simulated"; sender: string; statusCode?: number }> {
  const apiKey = (process.env.TEXTIFY_API_KEY || "").trim();
  const sender = (params.sender || process.env.TEXTIFY_SENDER_NAME || "Nama").trim() || "Nama";
  const recipient = params.to.replace(/[\s()-]/g, "").trim();
  const isMock = process.env.NEXT_PUBLIC_MOCK_MODE === "true" || process.env.CERVOS_MOCK_AUTH === "true";

  if (!apiKey || apiKey.length < 16 || !recipient || isMock) {
    return { delivered: true, channel: "simulated", sender };
  }

  const endpoint = (
    process.env.TEXTIFY_API_URL || "https://api.textify.africa/v1/sms/send"
  ).trim();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({
        sender,
        sender_id: sender,
        from: sender,
        to: recipient,
        recipient,
        message: params.message.slice(0, 480),
        text: params.message.slice(0, 480),
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return { delivered: res.ok, channel: "textify", sender, statusCode: res.status };
  } catch {
    return { delivered: false, channel: "textify", sender };
  }
}

export async function dispatchExceptionNotification(event: {
  accountId: string;
  orgName: string;
  severity: "warning" | "critical";
  code: string;
  summary: string;
}): Promise<{ delivered: boolean; channel: "webhook" | "log" }> {
  const webhookUrl = (process.env.CERVOS_EXCEPTION_WEBHOOK_URL || "").trim();
  if (webhookUrl && /^https?:\/\//i.test(webhookUrl)) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Cervos-Exception": event.code,
        },
        body: JSON.stringify({
          ...event,
          recipientEmail: process.env.CERVOS_EXCEPTION_EMAIL || undefined,
          sentAt: new Date().toISOString(),
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      return { delivered: res.ok, channel: "webhook" };
    } catch {
      // Fail-open on external delivery telemetry; local audit log always records the exception.
    }
  }
  return { delivered: true, channel: "log" };
}
