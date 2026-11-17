"use client";

import { useState } from "react";
import Link from "next/link";
import FlipText from "@/components/FlipText";

interface Props {
  lang: string;
  isSw: boolean;
}

type Segment = "individual" | "enterprise";
type IndividualTrack = "addo" | "pharmacy" | "supplier_starter";
type EnterpriseTrack = "chain" | "hospital" | "wholesale" | "importer";

function formatTzs(amount: number): string {
  return `TZS ${amount.toLocaleString("en-US")}`;
}

export default function SubscriptionCalculator({ lang, isSw }: Props) {
  const [segment, setSegment] = useState<Segment>("individual");
  const [isSwitching, setIsSwitching] = useState(false);
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const [indTrack, setIndTrack] = useState<IndividualTrack>("pharmacy");
  const [indSeats, setIndSeats] = useState(2);

  const [entTrack, setEntTrack] = useState<EnterpriseTrack>("chain");
  const [entLocations, setEntLocations] = useState(4);
  const [entSeats, setEntSeats] = useState(18);

  const isAnnual = billing === "annual";

  const switchSegment = (next: Segment) => {
    if (next === segment) return;
    setIsSwitching(true);
    setTimeout(() => {
      setSegment(next);
      setIsSwitching(false);
    }, 200);
  };

  const clampInt = (raw: string, min: number, max: number) => {
    const parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed)) return min;
    return Math.min(max, Math.max(min, parsed));
  };

  const calc = (() => {
    if (segment === "individual") {
      if (indTrack === "addo") {
        return {
          planName: isSw ? "Duka Dogo" : "Starter Shop",
          summary: isSw ? "Kaunta 1 · hadi wahudumu 2" : "1 counter · up to 2 staff members",
          baseRate: 10000,
          overage: 0,
          overageLabel: isSw ? "Wahudumu wa ziada" : "Extra staff",
          monthlyPrice: 10000,
          annualPrice: 100000,
          roleParam: "pharmacy",
          includedItems: [
            isSw ? "Mauzo hata mtandao ukikatika" : "Sell even when internet drops",
            isSw ? "Tahadhari za dawa kabla ya kuisha" : "Early warnings before stock expires",
          ],
        };
      }
      if (indTrack === "supplier_starter") {
        return {
          planName: isSw ? "Msambazaji Mpya" : "Wholesale Starter",
          summary: isSw ? "Ghala 1 · hadi maduka 15" : "1 warehouse · up to 15 buyer shops",
          baseRate: 60000,
          overage: 0,
          overageLabel: isSw ? "Maduka ya ziada" : "Extra buyer shops",
          monthlyPrice: 60000,
          annualPrice: 600000,
          roleParam: "supplier",
          includedItems: [
            isSw ? "Orodha ya bei kwa maduka ya mkataba" : "Direct order list for buyer shops",
            isSw ? "Malipo salama kupitia Kasri\u2122" : "Payment released via Kasri\u2122 on arrival",
          ],
        };
      }
      const extraSeatCount = Math.max(0, indSeats - 6);
      const extraSeatFee = extraSeatCount * 6000;
      const monthly = 45000 + extraSeatFee;
      return {
        planName: isSw ? "Duka Kamili" : "Full Pharmacy",
        summary: isSw
          ? `Wahudumu ${indSeats} (6 wa kwanza bure)`
          : `${indSeats} staff logins (first 6 included)`,
        baseRate: 45000,
        overage: extraSeatFee,
        overageLabel: `${extraSeatCount}x ${isSw ? "wahudumu wa ziada" : "extra staff"}`,
        monthlyPrice: monthly,
        annualPrice: monthly * 10,
        roleParam: "pharmacy",
        includedItems: [
          isSw ? "Hesabu safi za taslimu na simu kila jioni" : "Clear cash and mobile money shift totals",
          isSw ? "Agiza mzigo jumla kupitia Kasri\u2122" : "Order wholesale stock with Kasri\u2122",
        ],
      };
    }

    if (entTrack === "hospital") {
      const extraLocCount = Math.max(0, entLocations - 3);
      const extraLocFee = extraLocCount * 35000;
      const monthly = 320000 + extraLocFee;
      return {
        planName: isSw ? "Hospitali & Zahanati" : "Hospital & Clinic",
        summary: isSw
          ? `Vituo ${entLocations} · ufuatiliaji wa wodi`
          : `${entLocations} facilities · full ward tracking`,
        baseRate: 320000,
        overage: extraLocFee,
        overageLabel: `${extraLocCount}x ${isSw ? "vituo vya ziada" : "extra facilities"}`,
        monthlyPrice: monthly,
        annualPrice: monthly * 10,
        roleParam: "dispensary",
        includedItems: [
          isSw ? "Ona upungufu wa dawa kabla haujatokea" : "Spot low ward stock before shortages",
          isSw ? "Hamisha dawa kati ya wodi na matawi" : "Move stock cleanly across units",
        ],
      };
    }
    if (entTrack === "wholesale") {
      const extraWarehouseCount = Math.max(0, entLocations - 5);
      const extraWarehousesFee = extraWarehouseCount * 28000;
      const monthly = 180000 + extraWarehousesFee;
      return {
        planName: isSw ? "Ghala la Jumla" : "Wholesale Depot",
        summary: isSw
          ? `Maghala ${entLocations} · hadi maduka 150`
          : `${entLocations} warehouses · up to 150 buyer shops`,
        baseRate: 180000,
        overage: extraWarehousesFee,
        overageLabel: `${extraWarehouseCount}x ${isSw ? "maghala ya ziada" : "extra warehouses"}`,
        monthlyPrice: monthly,
        annualPrice: monthly * 10,
        roleParam: "supplier",
        includedItems: [
          isSw ? "Hakiki namba za kundi kabla ya safari" : "Track batch dates before vans depart",
          isSw ? "Malipo ya uhakika kupitia Kasri\u2122" : "Guaranteed delivery payout via Kasri\u2122",
        ],
      };
    }
    if (entTrack === "importer") {
      const extraHubCount = Math.max(0, entLocations - 5);
      const extraHubFee = extraHubCount * 30000;
      const monthly = 450000 + extraHubFee;
      return {
        planName: isSw ? "Waagizaji Wakuu" : "National Importer",
        summary: isSw
          ? `Kanda ${entLocations} · takwimu za mahitaji`
          : `${entLocations} regions · live demand tracking`,
        baseRate: 450000,
        overage: extraHubFee,
        overageLabel: `${extraHubCount}x ${isSw ? "kanda za ziada" : "extra regions"}`,
        monthlyPrice: monthly,
        annualPrice: monthly * 10,
        roleParam: "supplier",
        includedItems: [
          isSw ? "Ona mahitaji ya dawa mkoa kwa mkoa" : "See medicine demand across regions",
          isSw ? "Bei maalum za mikataba kwa minyororo" : "Contract pricing for pharmacy chains",
        ],
      };
    }

    const extraBranches = Math.max(0, entLocations - 10) * 18000;
    const extraOperators = Math.max(0, entSeats - 50) * 3000;
    const extraTotal = extraBranches + extraOperators;
    const monthly = 140000 + extraTotal;
    return {
      planName: isSw ? "Mtandao wa Maduka" : "Pharmacy Chain",
      summary: isSw
        ? `Matawi ${entLocations} · wahudumu ${entSeats}`
        : `${entLocations} branches · ${entSeats} staff logins`,
      baseRate: 140000,
      overage: extraTotal,
      overageLabel: isSw ? "Matawi na wahudumu wa ziada" : "Extra branches & staff",
      monthlyPrice: monthly,
      annualPrice: monthly * 10,
      roleParam: "pharmacy",
      includedItems: [
        isSw ? "Hamisha mzigo baina ya matawi kwa urahisi" : "Move slow boxes between your branches",
        isSw ? "Ona faida za matawi yote sehemu moja" : "Watch all branch sales in one view",
      ],
    };
  })();

  const displayedTotal = isAnnual ? calc.annualPrice : calc.monthlyPrice;
  const savingsAnnual = calc.monthlyPrice * 2;

  return (
    <section id="pricing" className="py-24 sm:py-32 bg-[#FAFAFA] border-t border-zinc-200/80">
      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
          <div className="max-w-xl">
            <p className="text-xs font-mono uppercase tracking-[0.18em] text-[#B45309] mb-3">
              <FlipText text={isSw ? "GHARAMA WAZI" : "PRICING"} flipKey={lang} />
            </p>
            <h2
              className="text-3xl sm:text-4xl font-semibold text-zinc-900 tracking-tight leading-tight"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              <FlipText
                text={isSw ? "Mipango inayoendana na ukubwa wa duka lako." : "Plans that fit your shop."}
                flipKey={lang}
                mode="words"
              />
            </h2>
            <p className="text-sm sm:text-base text-zinc-500 mt-2">
              {isSw
                ? "Lipa kulingana na idadi halisi ya matawi na wahudumu dukani bila ada za kufichika."
                : "Pay only for the counters and branches you actually run. No hidden setup fees."}
            </p>
          </div>

          <div className="inline-flex rounded-lg bg-zinc-200/70 p-1 border border-zinc-200 self-start">
            <button
              type="button"
              onClick={() => switchSegment("individual")}
              className={`px-4 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${segment === "individual"
                ? "bg-white text-zinc-900 shadow-2xs"
                : "text-zinc-600 hover:text-zinc-900"
                }`}
            >
              {isSw ? "Duka Moja" : "Single Shop"}
            </button>
            <button
              type="button"
              onClick={() => switchSegment("enterprise")}
              className={`px-4 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${segment === "enterprise"
                ? "bg-white text-zinc-900 shadow-2xs"
                : "text-zinc-600 hover:text-zinc-900"
                }`}
            >
              {isSw ? "Matawi Mengi & Jumla" : "Chains & Wholesalers"}
            </button>
          </div>
        </div>

        {/* Dedicated Anchor For Instant Center-Focused Scroll From Hero */}
        <div
          id="calculator-focus"
          className={`scroll-mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start transition-all duration-300 ease-out ${isSwitching ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
            }`}
        >
          {/* Left Panel: Clear Plain Controls (7 Cols) */}
          <div className="lg:col-span-7 p-6 sm:p-8 rounded-2xl border border-zinc-200 bg-white space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-zinc-200">
              <div>
                <div className="text-sm font-medium text-zinc-900">
                  {isSw ? "Muda wa Malipo" : "Billing Schedule"}
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  <span className="text-emerald-700 font-medium">
                    {isSw ? "Malipo ya mwaka yanaokoa miezi 2 bure" : "Yearly billing · 2 months free"}
                  </span>
                </div>
              </div>

              <div className="inline-flex rounded-lg bg-zinc-100 p-1 border border-zinc-200">
                <button
                  type="button"
                  onClick={() => setBilling("monthly")}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${!isAnnual ? "bg-zinc-900 text-white" : "text-zinc-600 hover:text-zinc-900"
                    }`}
                >
                  {isSw ? "Kila Mwezi" : "Monthly"}
                </button>
                <button
                  type="button"
                  onClick={() => setBilling("annual")}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${isAnnual ? "bg-zinc-900 text-white" : "text-zinc-600 hover:text-zinc-900"
                    }`}
                >
                  {isSw ? "Kila Mwaka" : "Yearly"}
                </button>
              </div>
            </div>

            {segment === "individual" ? (
              <>
                <div>
                  <label className="block font-mono text-[11px] uppercase tracking-wider text-zinc-500 mb-3">
                    {isSw ? "Chagua Mpango" : "Choose Your Plan"}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { id: "addo" as const, title: isSw ? "Duka Dogo" : "Starter Shop", sub: "10,000 TZS/mo" },
                      { id: "pharmacy" as const, title: isSw ? "Duka Kamili" : "Full Pharmacy", sub: "45,000 TZS/mo" },
                      { id: "supplier_starter" as const, title: isSw ? "Msambazaji Mpya" : "Wholesale Starter", sub: "60,000 TZS/mo" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setIndTrack(opt.id)}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${indTrack === opt.id
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400"
                          }`}
                      >
                        <div className="text-xs font-semibold">{opt.title}</div>
                        <div
                          className={`text-[11px] font-mono mt-1 tabular-nums ${indTrack === opt.id ? "text-zinc-300" : "text-zinc-500"
                            }`}
                        >
                          {opt.sub}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {indTrack === "pharmacy" && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-sm font-medium text-zinc-900">
                        {isSw ? "Wahudumu Dukani" : "Staff Logins"}
                      </span>
                      <div className="flex items-center gap-2">
                        <select
                          value={indSeats <= 2 ? "2" : indSeats <= 6 ? "6" : "10"}
                          onChange={(e) => setIndSeats(Number(e.target.value))}
                          className="px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs text-zinc-800"
                        >
                          <option value="2">Small Shop (2)</option>
                          <option value="6">Busy Counter (6)</option>
                          <option value="10">Two Shifts (10)</option>
                        </select>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={indSeats}
                          onChange={(e) => setIndSeats(clampInt(e.target.value, 1, 20))}
                          className="w-14 px-2 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 font-mono text-xs font-semibold text-zinc-900 text-center tabular-nums"
                        />
                      </div>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      value={indSeats}
                      onChange={(e) => setIndSeats(Number(e.target.value))}
                      className="w-full h-1 bg-zinc-200 rounded-lg accent-zinc-900 cursor-pointer"
                    />
                    <div className="flex justify-between font-mono text-[11px] text-zinc-400">
                      <span>1 staff</span>
                      <span>6 included free</span>
                      <span>20 staff</span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div>
                  <label className="block font-mono text-[11px] uppercase tracking-wider text-zinc-500 mb-3">
                    {isSw ? "Aina ya Biashara" : "Business Type"}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: "chain" as const, title: isSw ? "Mtandao wa Maduka" : "Pharmacy Chain", sub: "From 140,000 TZS/mo" },
                      { id: "hospital" as const, title: isSw ? "Hospitali & Zahanati" : "Hospital & Clinic", sub: "From 320,000 TZS/mo" },
                      { id: "wholesale" as const, title: isSw ? "Ghala la Jumla" : "Wholesale Depot", sub: "From 180,000 TZS/mo" },
                      { id: "importer" as const, title: isSw ? "Waagizaji Wakuu" : "National Importer", sub: "From 450,000 TZS/mo" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setEntTrack(opt.id)}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${entTrack === opt.id
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400"
                          }`}
                      >
                        <div className="text-xs font-semibold">{opt.title}</div>
                        <div
                          className={`text-[11px] font-mono mt-1 tabular-nums ${entTrack === opt.id ? "text-zinc-300" : "text-zinc-500"
                            }`}
                        >
                          {opt.sub}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-zinc-900">
                        {isSw ? "Matawi / Maghala" : "Branches"}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={entLocations <= 4 ? "4" : entLocations <= 10 ? "10" : "20"}
                          onChange={(e) => setEntLocations(Number(e.target.value))}
                          className="px-2 py-1 rounded-md border border-zinc-200 bg-white text-[11px] text-zinc-800"
                        >
                          <option value="4">Small Group (4)</option>
                          <option value="10">Regional (10)</option>
                          <option value="20">National (20)</option>
                        </select>
                        <input
                          type="number"
                          min={1}
                          max={60}
                          value={entLocations}
                          onChange={(e) => setEntLocations(clampInt(e.target.value, 1, 60))}
                          className="w-12 px-1.5 py-1 rounded-md border border-zinc-200 bg-zinc-50 font-mono text-xs font-semibold text-zinc-900 text-center tabular-nums"
                        />
                      </div>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={60}
                      value={entLocations}
                      onChange={(e) => setEntLocations(Number(e.target.value))}
                      className="w-full h-1 bg-zinc-200 rounded-lg accent-zinc-900 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-zinc-900">
                        {isSw ? "Wahudumu" : "Staff Logins"}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={entSeats <= 15 ? "15" : entSeats <= 50 ? "50" : "90"}
                          onChange={(e) => setEntSeats(Number(e.target.value))}
                          className="px-2 py-1 rounded-md border border-zinc-200 bg-white text-[11px] text-zinc-800"
                        >
                          <option value="15">Core Team (15)</option>
                          <option value="50">Standard (50)</option>
                          <option value="90">Large Team (90)</option>
                        </select>
                        <input
                          type="number"
                          min={2}
                          max={200}
                          value={entSeats}
                          onChange={(e) => setEntSeats(clampInt(e.target.value, 2, 200))}
                          className="w-12 px-1.5 py-1 rounded-md border border-zinc-200 bg-zinc-50 font-mono text-xs font-semibold text-zinc-900 text-center tabular-nums"
                        />
                      </div>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={200}
                      value={entSeats}
                      onChange={(e) => setEntSeats(Number(e.target.value))}
                      className="w-full h-1 bg-zinc-200 rounded-lg accent-zinc-900 cursor-pointer"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right Panel: Clean Summary Receipt (5 Cols) */}
          <div className="lg:col-span-5 p-6 sm:p-8 rounded-2xl border border-zinc-800 bg-[#18181B] text-white sticky top-8 space-y-6">
            <div className="pb-6 border-b border-zinc-800">
              <div className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
                {isSw ? "Gharama Yako" : "Your Estimate"} &middot;{" "}
                {isAnnual ? (isSw ? "Mwaka" : "Yearly") : (isSw ? "Mwezi" : "Monthly")}
              </div>
              <div className="flex items-baseline gap-2 mt-2.5">
                <span className="text-3xl sm:text-4xl font-semibold tracking-tight font-mono tabular-nums text-white">
                  {formatTzs(displayedTotal)}
                </span>
                <span className="text-xs text-zinc-400">
                  /{isAnnual ? (isSw ? "mwaka" : "year") : (isSw ? "mwezi" : "month")}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-2">{calc.summary}</p>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between text-zinc-300">
                <span>
                  {isSw ? "Mpango" : "Plan"} ({calc.planName})
                </span>
                <span className="tabular-nums">{formatTzs(calc.baseRate)}/mo</span>
              </div>
              {calc.overage > 0 && (
                <div className="flex justify-between text-zinc-400">
                  <span>{calc.overageLabel}</span>
                  <span className="tabular-nums">+{formatTzs(calc.overage)}/mo</span>
                </div>
              )}
              {isAnnual && (
                <div className="flex justify-between text-emerald-400">
                  <span>{isSw ? "Punguzo la Mwaka (Miezi 2 bure)" : "Yearly savings (2 months free)"}</span>
                  <span className="tabular-nums">-{formatTzs(savingsAnnual)}/yr</span>
                </div>
              )}
              <div className="pt-3 border-t border-zinc-800 space-y-1.5 text-zinc-400 font-sans text-xs">
                {calc.includedItems.map((line) => (
                  <div key={line}>&#8226; {line}</div>
                ))}
              </div>
            </div>

            <div className="pt-2 space-y-3">
              <Link
                href={`/auth?mode=signup&role=${calc.roleParam}`}
                className="w-full py-3.5 px-4 rounded-lg bg-white text-zinc-900 hover:bg-zinc-100 font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2"
              >
                <span>{isSw ? "Anza Mpango Huu" : "Start This Plan"}</span>
                <span className="font-mono">&rarr;</span>
              </Link>
              {segment === "enterprise" && (
                <div className="text-center">
                  <Link
                    href="/partners#partner-enquiry"
                    className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors inline-block pt-1"
                  >
                    {isSw
                      ? "Unahitaji msaada wa kuanzisha matawi mengi? Wasiliana nasi \u2192"
                      : "Need help setting up multiple branches? Talk to our team \u2192"}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
