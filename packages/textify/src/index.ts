/**
 * Textify Africa SMS, WhatsApp, and OTP adapter for Cervos OS.
 *
 * Adapted from our internal Textify Africa integration contract (`portal.textify.africa/api/v1`):
 * - Server-only secret (`TEXTIFY_API_KEY` passed via config; never exposed in client bundles)
 * - Injected fetch transport for deterministic, zero-network unit testing
 * - Local Tanzanian MSISDN normalization (`07...` / `+255...` -> `255...`)
 * - Accurate ASCII (160/153) & UCS-2 non-ASCII (70/63) segment billing math
 * - Privacy-safe message builders (zero patient diagnosis or PHI in SMS payloads)
 */

export const TEXTIFY_BASE_URL = "https://portal.textify.africa/api/v1";

export interface TextifyConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface SmsMessage {
  receiver: string;
  content: string;
}

export interface SendSmsInput {
  messages: SmsMessage[];
  senderName?: string;
  isScheduled?: boolean;
  scheduledDate?: string;
  channel?: "sms" | "whatsapp";
  idempotencyKey?: string;
}

export interface SendOtpInput {
  phoneNumber: string;
  emailAddress?: string;
  senderName?: string;
  brandName?: string;
  channel?: "sms" | "whatsapp";
}

export interface VerifyOtpInput {
  code: number;
  phoneNumber?: string;
  emailAddress?: string;
}

export interface TextifyEnvelope {
  success: boolean;
  status_code: number;
  status_text: string;
  message: string;
  data: unknown;
  error?: string;
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Billable units for one SMS body. Up to 160 ASCII characters is 1 unit; longer
 * bodies bill per 153 characters; non-ASCII (UCS-2) bodies bill at 70 then 63
 * per part.
 */
export function smsSegments(content: string): number {
  const nonAscii = /[^ -~]/.test(content);
  if (nonAscii) {
    const length = [...content].length;
    if (length <= 70) return 1;
    return 1 + Math.ceil((length - 70) / 63);
  }
  if (content.length <= 160) return 1;
  return Math.ceil(content.length / 153);
}

/** Normalizes Tanzanian local formats (`07...`, `+255...`, 9-digit local) to `255...`. */
export function normalizeMsisdn(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("255")) return digits;
  if (digits.startsWith("0")) return `255${digits.slice(1)}`;
  if (digits.length === 9) return `255${digits}`;
  return digits;
}

/** Masks an MSISDN for audit logs without retaining raw phone numbers. */
export function maskMsisdn(phone: string): string {
  const norm = normalizeMsisdn(phone);
  if (norm.length < 7) return "***";
  return `+${norm.slice(0, 4)}***${norm.slice(-3)}`;
}

function headers(config: TextifyConfig, extra?: Record<string, string>): Record<string, string> {
  return {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function url(config: TextifyConfig, path: string): string {
  return `${config.baseUrl ?? TEXTIFY_BASE_URL}${path}`;
}

function envelopeOf(response: Response, body: unknown): TextifyEnvelope {
  const base: TextifyEnvelope = {
    success: response.ok,
    status_code: response.status,
    status_text: response.statusText,
    message: "",
    data: null,
  };
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    return {
      ...base,
      message: typeof record.message === "string" ? record.message : "",
      data: record.data ?? null,
      error: typeof record.error === "string" ? record.error : undefined,
      success: typeof record.success === "boolean" ? record.success : response.ok,
    };
  }
  return base;
}

async function parse(response: Response): Promise<TextifyEnvelope> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return envelopeOf(response, body);
}

/**
 * Queues one or many messages atomically. Returns the provider envelope;
 * a thrown error means transport failure, not API refusal.
 */
export async function sendSms(
  config: TextifyConfig,
  input: SendSmsInput,
  fetchImpl: FetchLike = fetch
): Promise<TextifyEnvelope> {
  const payload: Record<string, unknown> = {
    messages: input.messages.map((m) => ({
      receiver: normalizeMsisdn(m.receiver),
      content: m.content,
    })),
    is_scheduled: input.isScheduled ?? false,
  };
  if (input.senderName) payload.sender_name = input.senderName;
  if (input.scheduledDate) payload.scheduled_date = input.scheduledDate;
  if (input.channel) payload.channel = input.channel;

  const extra: Record<string, string> = {};
  if (input.idempotencyKey) extra["Idempotency-Key"] = input.idempotencyKey;

  const response = await fetchImpl(url(config, "/messages"), {
    method: "POST",
    headers: headers(config, extra),
    body: JSON.stringify(payload),
  });
  return parse(response);
}

/** Sends a single-use OTP (30 min expiry). Account-verification stays on SMS. */
export async function sendOtp(
  config: TextifyConfig,
  input: SendOtpInput,
  fetchImpl: FetchLike = fetch
): Promise<TextifyEnvelope> {
  const payload: Record<string, unknown> = {
    phone_number: normalizeMsisdn(input.phoneNumber),
  };
  if (input.emailAddress) payload.email_address = input.emailAddress;
  if (input.senderName) payload.sender_name = input.senderName;
  if (input.brandName) payload.brand_name = input.brandName;
  if (input.channel) payload.channel = input.channel;

  const response = await fetchImpl(url(config, "/otps"), {
    method: "POST",
    headers: headers(config),
    body: JSON.stringify(payload),
  });
  return parse(response);
}

/** Verifies an OTP code as a JSON number through the server adapter. */
export async function verifyOtp(
  config: TextifyConfig,
  input: VerifyOtpInput,
  fetchImpl: FetchLike = fetch
): Promise<TextifyEnvelope> {
  const payload: Record<string, unknown> = { code: input.code };
  if (input.phoneNumber) payload.phone_number = normalizeMsisdn(input.phoneNumber);
  if (input.emailAddress) payload.email_address = input.emailAddress;

  const response = await fetchImpl(url(config, "/otps/verify"), {
    method: "POST",
    headers: headers(config),
    body: JSON.stringify(payload),
  });
  return parse(response);
}

/** Reads one message's delivery status (`sending|processing|sent|delivered|failed`). */
export async function getMessage(
  config: TextifyConfig,
  id: string,
  fetchImpl: FetchLike = fetch
): Promise<TextifyEnvelope> {
  const response = await fetchImpl(url(config, `/messages/${id}`), {
    method: "GET",
    headers: headers(config),
  });
  return parse(response);
}

export interface CervosPreparedSms {
  input: SendSmsInput;
  totalSegments: number;
  maskedRecipients: string[];
}

/**
 * Privacy-preserving SMS payload for Patient e-Rx pickup using `claim_token`
 * without exposing drug names, diagnoses, or clinical notes over SMS.
 */
export function buildPrescriptionClaimSms(params: {
  patientPhone: string;
  claimToken: string;
  branchName?: string;
  lang?: "en" | "sw";
  prescriptionId: string;
  senderName?: string;
}): CervosPreparedSms {
  const location = params.branchName ? ` at ${params.branchName}` : "";
  const content =
    params.lang === "sw"
      ? `Cervos: Dawa zako zimeandaliwa${params.branchName ? ` katika ${params.branchName}` : ""}. Tumia tokeni ${params.claimToken} kuchukua.`
      : `Cervos: Your prescription is ready${location}. Present claim token ${params.claimToken} at pickup.`;

  return {
    input: {
      messages: [{ receiver: params.patientPhone, content }],
      senderName: params.senderName ?? "CERVOS",
      idempotencyKey: `cervos-rx-${params.prescriptionId}`,
    },
    totalSegments: smsSegments(content),
    maskedRecipients: [maskMsisdn(params.patientPhone)],
  };
}

/**
 * Urgent TMDA / HQ batch recall alert SMS for branch operators and hospitals.
 */
export function buildBatchRecallAlertSms(params: {
  recipients: string[];
  drugGenericName: string;
  batchNumber: string;
  recallId: string;
  senderName?: string;
}): CervosPreparedSms {
  const content = `CERVOS RECALL NOTICE: Quarantine Batch ${params.batchNumber} (${params.drugGenericName}) immediately. Stop dispensing & check HQ Recall Console.`;
  const messages = params.recipients.map((receiver) => ({ receiver, content }));
  const segPerMsg = smsSegments(content);

  return {
    input: {
      messages,
      senderName: params.senderName ?? "CERVOS",
      idempotencyKey: `cervos-recall-${params.recallId}`,
    },
    totalSegments: segPerMsg * messages.length,
    maskedRecipients: params.recipients.map(maskMsisdn),
  };
}

/**
 * B2B Supplier ASN dispatch notification to pharmacy / hospital receiving staff.
 */
export function buildOrderDispatchSms(params: {
  buyerPhone: string;
  orderReference: string;
  supplierName: string;
  orderId: string;
  senderName?: string;
}): CervosPreparedSms {
  const content = `Cervos B2B: Order ${params.orderReference} from ${params.supplierName} has been dispatched. Verify batch expiry on delivery to release escrow.`;

  return {
    input: {
      messages: [{ receiver: params.buyerPhone, content }],
      senderName: params.senderName ?? "CERVOS",
      idempotencyKey: `cervos-dispatch-${params.orderId}`,
    },
    totalSegments: smsSegments(content),
    maskedRecipients: [maskMsisdn(params.buyerPhone)],
  };
}

