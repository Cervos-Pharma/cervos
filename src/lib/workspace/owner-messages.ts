import { calendarNudge } from "@/lib/workspace/tz-calendar";

// The evening message an owner gets on their phone. It reads like a short note from a
// colleague: a greeting by name, how the day went against yesterday, the one thing worth
// acting on, and a calendar or plan nudge when it matters. The SMS sender name (Textify
// sender ID) is never written into the body. Text stays in plain GSM characters so a
// message is billed at 160 characters per part, not 70.

export type Lang = "EN" | "SW";

export interface BranchDay {
  name: string;
  salesCount: number;
  revenueTzs: number;
  yesterdayRevenueTzs: number;
  lowStockCount: number;
  lowStockTop?: string;
  expiredCount: number;
  expiredTop?: string;
  expiringSoonCount: number;
  expiringSoon?: { name: string; days: number };
  topSeller?: { name: string; qty: number };
}

export interface BillingState {
  planName: string;
  daysLeft: number | null;
  isInGraceDay: boolean;
  branchesUsed: number;
  maxBranches: number | null;
  operatorsUsed: number;
  maxOperators: number | null;
}

export interface EveningContext {
  lang: Lang;
  accountId: string;
  firstName: string;
  orgName: string;
  eatDate: string;
  branches: BranchDay[];
  billing: BillingState;
}

const MAX_SMS = 459; // three GSM parts

function seedFor(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const pickOne = <T,>(list: T[], seed: number, salt = 0): T => list[(seed + salt) % list.length];

const tzs = (n: number) => `TSh ${Math.round(n).toLocaleString("en-US")}`;

/** Replace anything outside basic GSM-7 so the message is not billed as Unicode. */
export function toGsmSafe(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00B7/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x20-\x7E\n]/g, "");
}

function greeting(ctx: EveningContext, seed: number): string {
  const en = [`Good evening ${ctx.firstName},`, `Hi ${ctx.firstName},`, `Evening ${ctx.firstName},`];
  const sw = [`Habari za jioni ${ctx.firstName},`, `Jioni njema ${ctx.firstName},`, `Salaam ${ctx.firstName},`];
  return pickOne(ctx.lang === "SW" ? sw : en, seed);
}

function trendPhrase(lang: Lang, today: number, yesterday: number): string {
  if (yesterday <= 0) return "";
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  if (Math.abs(pct) < 5) return lang === "SW" ? ", karibu sawa na jana" : ", about the same as yesterday";
  if (pct > 0) return lang === "SW" ? `, juu kwa ${pct}% kuliko jana` : `, up ${pct}% on yesterday`;
  return lang === "SW" ? `, chini kwa ${Math.abs(pct)}% kuliko jana` : `, down ${Math.abs(pct)}% on yesterday`;
}

function daySummary(ctx: EveningContext, seed: number): string {
  const { lang, branches, orgName } = ctx;
  const sales = branches.reduce((s, b) => s + b.salesCount, 0);
  const revenue = branches.reduce((s, b) => s + b.revenueTzs, 0);
  const yesterday = branches.reduce((s, b) => s + b.yesterdayRevenueTzs, 0);

  if (sales === 0) {
    return lang === "SW"
      ? `hakuna mauzo yaliyorekodiwa ${orgName} leo. Kama duka lilikuwa wazi, hakikisha wafanyakazi wanarekodi kila mauzo kwenye Cervos.`
      : `no sales were recorded at ${orgName} today. If you were open, check the team is ringing every sale through Cervos.`;
  }

  const trend = trendPhrase(lang, revenue, yesterday);
  if (branches.length === 1) {
    const en = [
      `${orgName} made ${tzs(revenue)} from ${sales} sale${sales === 1 ? "" : "s"} today${trend}.`,
      `today ${orgName} closed at ${tzs(revenue)} across ${sales} sale${sales === 1 ? "" : "s"}${trend}.`,
    ];
    const sw = [
      `${orgName} imeingiza ${tzs(revenue)} kutoka mauzo ${sales} leo${trend}.`,
      `leo ${orgName} imefunga na ${tzs(revenue)} kwa mauzo ${sales}${trend}.`,
    ];
    let line = pickOne(lang === "SW" ? sw : en, seed, 1);
    const top = branches[0].topSeller;
    if (top && top.qty >= 3) {
      line += lang === "SW" ? ` Kilichotoka zaidi: ${top.name} (${top.qty}).` : ` Best seller: ${top.name} (${top.qty}).`;
    }
    return line;
  }

  const lead = [...branches].sort((a, b) => b.revenueTzs - a.revenueTzs)[0];
  return lang === "SW"
    ? `matawi yako ${branches.length} yameingiza ${tzs(revenue)} kutoka mauzo ${sales} leo${trend}. ${lead.name} imeongoza kwa ${tzs(lead.revenueTzs)}.`
    : `your ${branches.length} branches made ${tzs(revenue)} from ${sales} sales today${trend}. ${lead.name} led with ${tzs(lead.revenueTzs)}.`;
}

/** The single most useful stock action, most urgent first. */
function watchItem(ctx: EveningContext): string | null {
  const { lang, branches } = ctx;
  const multi = branches.length > 1;
  const at = (b: BranchDay) => (multi ? (lang === "SW" ? ` (${b.name})` : ` at ${b.name}`) : "");

  const expired = branches.find((b) => b.expiredCount > 0 && b.expiredTop);
  if (expired) {
    const more = expired.expiredCount - 1;
    return lang === "SW"
      ? `Tahadhari: ${expired.expiredTop}${more > 0 ? ` na nyingine ${more}` : ""} zimeisha muda${at(expired)}. Ziondoe kwenye rafu leo.`
      : `Heads up: ${expired.expiredTop}${more > 0 ? ` and ${more} more` : ""} expired${at(expired)}. Pull ${more > 0 ? "them" : "it"} off the shelf today.`;
  }

  const soon = branches
    .filter((b) => b.expiringSoon)
    .sort((a, b) => (a.expiringSoon!.days - b.expiringSoon!.days))[0];
  if (soon?.expiringSoon && soon.expiringSoon.days <= 30) {
    const { name, days } = soon.expiringSoon;
    return lang === "SW"
      ? `${name} inaisha muda ndani ya siku ${days}${at(soon)}. Iweke mbele au rudisha kwa msambazaji.`
      : `${name} expires in ${days} day${days === 1 ? "" : "s"}${at(soon)}. Move it to the front or arrange a return.`;
  }

  const low = [...branches].sort((a, b) => b.lowStockCount - a.lowStockCount)[0];
  if (low && low.lowStockCount > 0 && low.lowStockTop) {
    const more = low.lowStockCount - 1;
    return lang === "SW"
      ? `${low.lowStockTop}${more > 0 ? ` na bidhaa ${more} nyingine` : ""} zinakaribia kuisha${at(low)}. Ni wakati wa kuagiza.`
      : `${low.lowStockTop}${more > 0 ? ` and ${more} other item${more === 1 ? "" : "s"}` : ""} ${more > 0 ? "are" : "is"} running low${at(low)}. Time to reorder.`;
  }
  return null;
}

const RENEW_DAYS = new Set([7, 5, 3, 2, 1]);

/** Plan nudge in a natural tone, only on the days it is worth saying. */
export function billingNudge(lang: Lang, b: BillingState, eatDate: string): string | null {
  const link = "cervos.online/app/billing";
  if (b.isInGraceDay) {
    return lang === "SW"
      ? `Kifurushi chako cha ${b.planName} kimeisha leo. Lipia usiku huu kupitia ${link} ili huduma isisimame kesho.`
      : `Your ${b.planName} plan ended today. Renew tonight at ${link} so nothing pauses tomorrow.`;
  }
  if (b.daysLeft !== null && RENEW_DAYS.has(b.daysLeft)) {
    if (b.daysLeft === 1) {
      return lang === "SW"
        ? `Imebaki siku 1 tu kwenye kifurushi chako cha ${b.planName}. Lipia kupitia ${link}.`
        : `Just 1 day left on your ${b.planName} plan. Renew at ${link} to keep everything running.`;
    }
    return lang === "SW"
      ? `Zimebaki siku ${b.daysLeft} kwenye kifurushi chako cha ${b.planName}. Lipia muda wowote kupitia ${link}.`
      : `${b.daysLeft} days left on your ${b.planName} plan. Renew whenever suits at ${link}.`;
  }

  // Growth nudge: once a week (Mondays) when close to plan limits.
  const isMonday = new Date(`${eatDate}T12:00:00.000Z`).getUTCDay() === 1;
  const nearBranchCap = b.maxBranches !== null && b.branchesUsed >= b.maxBranches;
  const nearOpCap = b.maxOperators !== null && b.operatorsUsed >= Math.ceil(b.maxOperators * 0.8);
  if (isMonday && (nearBranchCap || nearOpCap)) {
    return lang === "SW"
      ? `Unatumia matawi ${b.branchesUsed}/${b.maxBranches ?? "-"} na wafanyakazi ${b.operatorsUsed}/${b.maxOperators ?? "-"}. Ukiwa tayari kukua, pandisha kifurushi kupitia ${link}.`
      : `You're using ${b.branchesUsed}/${b.maxBranches ?? "-"} branches and ${b.operatorsUsed}/${b.maxOperators ?? "-"} staff seats. When you're ready to grow, upgrade at ${link}.`;
  }
  return null;
}

export interface EveningMessage {
  sms: string;
  inAppTitle: string;
  inAppBody: string;
  billingNote: string | null;
}

export function composeEveningMessage(ctx: EveningContext): EveningMessage {
  const seed = seedFor(`${ctx.accountId}:${ctx.eatDate}`);
  const hello = greeting(ctx, seed);
  const summary = daySummary(ctx, seed);
  const watch = watchItem(ctx);
  const lowStockCount = ctx.branches.reduce((s, b) => s + b.lowStockCount, 0);
  const calendar = calendarNudge(ctx.eatDate, ctx.lang, { lowStockCount });
  const billing = billingNudge(ctx.lang, ctx.billing, ctx.eatDate);
  const signOff = ctx.lang === "SW" ? "- Cervos" : "- Cervos";

  // Drop the least important lines until it fits three SMS parts.
  const optional: Array<string | null> = [watch, calendar];
  const build = (parts: Array<string | null>) =>
    toGsmSafe([hello, summary, billing, ...parts, signOff].filter(Boolean).join(" "));
  let sms = build(optional);
  if (sms.length > MAX_SMS) sms = build([watch]);
  if (sms.length > MAX_SMS) sms = build([]);
  if (sms.length > MAX_SMS) sms = sms.slice(0, MAX_SMS);

  const inAppBody = toGsmSafe([hello, summary, watch, calendar, billing].filter(Boolean).join(" "));
  const inAppTitle = ctx.lang === "SW" ? `Muhtasari wa jioni - ${ctx.eatDate}` : `Evening update - ${ctx.eatDate}`;
  return { sms, inAppTitle, inAppBody, billingNote: billing };
}
