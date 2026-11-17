"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import PublicNav from "@/components/PublicNav";
import FlipText from "@/components/FlipText";
import { CERVOS_PARTNERS } from "@/components/PartnersTaperRibbon";
import { IconCheck } from "@/components/LandingIcons";
import { submitSupportTicket } from "@/lib/actions/support";
import { useI18n } from "@/lib/i18n/context";
import { useIsLowEndDevice } from "@/lib/useDeviceTier";

export default function PartnersPage() {
  const { lang } = useI18n();
  const isSw = lang === "SW";
  const isLowEnd = useIsLowEndDevice();

  // Partnership Enquiry Form
  const [orgName, setOrgName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [partnerType, setPartnerType] = useState("Wholesale Distributor");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const outerPartners = CERVOS_PARTNERS.slice(0, 4);
  const midPartners = CERVOS_PARTNERS.slice(4, 8);

  const partnerTypes = [
    {
      num: "01",
      title: isSw ? "Wasambazaji wa Jumla" : "Licensed Wholesale Distributors",
      body: isSw
        ? "Unganisha ghala lako moja kwa moja na maagizo ya kila wiki kutoka maduka halali kote mikoani."
        : "Connect regional depots straight to weekly restock demand from verified community dispensaries.",
    },
    {
      num: "02",
      title: isSw ? "Usafirishaji & Mnyororo wa Baridi" : "Cold-Chain & Regional Fleets",
      body: isSw
        ? "Simamia safari za magari na uhakikishe chanjo na dawa nyeti zinafika katika joto salama."
        : "Coordinate last-mile vans and maintain verified temperature handoffs from warehouse to counter.",
    },
    {
      num: "03",
      title: isSw ? "Malipo ya Kasri\u2122" : "Clearing & Settlement via Kasri\u2122",
      body: isSw
        ? "Linda malipo kati ya mnunuzi na muuzaji ili hakuna kufukuza ankara wala hofu ya uaminifu."
        : "Give buyers and wholesalers certainty that payment clears automatically once batches land safely.",
    },
    {
      num: "04",
      title: isSw ? "Maabara & Mipango ya Afya" : "Clinical Labs & Health Programs",
      body: isSw
        ? "Shirikiana katika utoaji wa vipimo, maagizo ya kliniki, na ufuatiliaji wa upatikanaji wa dawa."
        : "Collaborate on diagnostic referrals, maternal health supplies, and regional availability continuity.",
    },
  ];

  async function handleEnquirySubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await submitSupportTicket({
        category: "other",
        contactEmail: email,
        subject: `[Partnership Enquiry] ${orgName} (${partnerType})`,
        message: `Contact: ${contactName}\nOrganization: ${orgName}\nType: ${partnerType}\n\n${note}`,
      });
      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        setSentTo(email);
        setOrgName("");
        setContactName("");
        setNote("");
      }
    } catch {
      setErrorMsg(
        isSw
          ? "Imeshindwa kutuma ombi kwa sasa. Tafadhali jaribu tena."
          : "Could not send enquiry right now. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col selection:bg-[#1039B9] selection:text-white antialiased overflow-x-clip">
      {/* Dark Style 3 Hero with Real People Backdrop + Concentric Counter-Rotating Orbits */}
      <section className="relative bg-[#0F172A] text-white pt-5 sm:pt-6 pb-20 sm:pb-28 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image
            src="/cervos-people-delivery.jpg"
            alt="Wholesaler driver and pharmacy partner verifying medicines together"
            fill
            className="object-cover object-left opacity-35"
            priority
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(100deg, rgba(15, 23, 42, 0.94) 0%, rgba(15, 23, 42, 0.85) 55%, rgba(15, 23, 42, 0.72) 100%)",
            }}
          />
        </div>

        <div className="relative z-20">
          <PublicNav
            variant="hero"
            ctaHref="/auth?mode=signup"
            ctaLabel={isSw ? "Anza Sasa" : "Get Started"}
            isLowEnd={isLowEnd}
          />
        </div>

        {/* Right-Edge Cropped Concentric Counter-Rotating Orbit Rings */}
        <div
          aria-hidden="true"
          className="pointer-events-none hidden md:flex items-center justify-center absolute -right-52 lg:-right-44 xl:-right-28 top-1/2 -translate-y-1/2 w-[620px] h-[620px] z-10"
        >
          {/* Ambient Subtle Core Glow */}
          <div className="absolute inset-16 rounded-full bg-radial from-[#1039B9]/25 via-[#38BDF8]/10 to-transparent blur-2xl" />

          {/* Outer Orbit Ring (Clockwise) */}
          <div
            className={`${isLowEnd ? "" : "animate-orbit-ring"} relative w-[560px] h-[560px] rounded-full border border-white/15 flex items-center justify-center`}
          >
            {outerPartners.map((p, idx) => {
              const angle = idx * 90;
              return (
                <div
                  key={p.id}
                  style={{
                    transform: `rotate(${angle}deg) translate(280px) rotate(-${angle}deg)`,
                  }}
                  className="absolute"
                >
                  <div
                    className={`${isLowEnd ? "" : "animate-orbit-upright"} w-14 h-14 rounded-2xl bg-white text-[#0F172A] shadow-xl border border-slate-200/80 flex items-center justify-center`}
                    title={p.name}
                  >
                    {p.mark}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Middle Orbit Ring (Counter-Rotating) */}
          <div
            className={`${isLowEnd ? "" : "animate-orbit-ring-reverse"} absolute w-[380px] h-[380px] rounded-full border border-dashed border-[#38BDF8]/30 flex items-center justify-center`}
          >
            {midPartners.map((p, idx) => {
              const angle = idx * 90 + 45;
              return (
                <div
                  key={p.id}
                  style={{
                    transform: `rotate(${angle}deg) translate(190px) rotate(-${angle}deg)`,
                  }}
                  className="absolute"
                >
                  <div
                    className={`${isLowEnd ? "" : "animate-orbit-upright-reverse"} w-12 h-12 rounded-xl bg-white text-[#0F172A] shadow-lg border border-slate-200 flex items-center justify-center`}
                    title={p.name}
                  >
                    {p.mark}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Inner Ring & Cervos Hub */}
          <div className="absolute w-[200px] h-[200px] rounded-full border border-white/15 flex items-center justify-center">
            <div className="relative w-20 h-20 rounded-full bg-white shadow-2xl p-2 flex items-center justify-center ring-4 ring-white/15">
              <div className="relative w-14 h-14">
                <Image
                  src="/cervos-company-logo-circular.svg"
                  alt="Cervos Pharma"
                  fill
                  className="object-contain"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Left Hero Editorial Copy */}
        <div className="max-w-6xl mx-auto px-5 sm:px-6 relative z-20 pt-2">
          <div className="max-w-xl">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#38BDF8] mb-3">
              <FlipText text={isSw ? "WADAU NA USHIRIKA" : "OUR PARTNERS"} flipKey={lang} />
            </div>
            <h1
              className="text-3xl sm:text-5xl lg:text-[52px] font-bold tracking-tight text-white leading-[1.08] mb-5"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              <FlipText
                text={
                  isSw
                    ? "Kujenga mtandao wa dawa wa kuaminika pamoja."
                    : "Built alongside East Africa's medicine supply chain."
                }
                flipKey={lang}
                mode="words"
              />
            </h1>
            <p className="text-sm sm:text-lg text-slate-200 leading-relaxed mb-8">
              <FlipText
                text={
                  isSw
                    ? "Hakuna duka linalosimama peke yake. Tunashirikiana na wasambazaji, mifumo ya malipo ya Kasri\u2122, na timu za usafirishaji ili kila rafu iwe na dawa halali."
                    : "No single pharmacy operates in isolation. We partner with licensed wholesalers, regional fleets, and Kasri\u2122 clearing so every shelf stays stocked with safe medicine."
                }
                flipKey={lang}
                mode="words"
              />
            </p>

            <div className="flex flex-wrap items-center gap-3.5">
              <a
                href="#partner-enquiry"
                className="px-6 py-3 rounded bg-[#1039B9] hover:bg-[#0D2E94] text-white text-xs sm:text-sm font-semibold shadow-md transition-all"
              >
                <FlipText text={isSw ? "Shirikiana Nasi" : "Become a Partner"} flipKey={lang} />
              </a>
              <Link
                href="/about"
                className="px-5 py-3 rounded bg-white/10 hover:bg-white/20 border border-white/25 backdrop-blur-xs text-white text-xs sm:text-sm font-semibold transition-all"
              >
                <FlipText text={isSw ? "Mnyororo Wetu" : "See How Chain Fits"} flipKey={lang} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Why We Partner & Types of Partners We Work With */}
      <main className="flex-1">
        <section className="py-16 sm:py-24 bg-white border-b border-[#E2E8F0]">
          <div className="max-w-6xl mx-auto px-5 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-5">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#006875] mb-2">
                <FlipText text={isSw ? "KWANINI TUNASHIRIKIANA" : "WHY WE PARTNER"} flipKey={lang} />
              </div>
              <h2
                className="text-2xl sm:text-3xl font-bold text-[#0F172A] mb-4 leading-snug"
                style={{ fontFamily: "Outfit, Inter, sans-serif" }}
              >
                <FlipText
                  text={
                    isSw
                      ? "Wadau sahihi wanapunguza gharama na kuongeza imani."
                      : "Stronger partnerships cut waste and build trust at every counter."
                  }
                  flipKey={lang}
                  mode="words"
                />
              </h2>
              <p className="text-sm text-[#475569] leading-relaxed">
                <FlipText
                  text={
                    isSw
                      ? "Tunaposhirikiana na wasambazaji wakubwa, maabara, na huduma za malipo za Kasri\u2122, maduka madogo mtaani yanapata bei nafuu, dawa salama, na uhakika wa mzigo bila kulazimika kusafiri mbali."
                      : "When regional distributors, logistics operators, and Kasri\u2122 align around verified batches, community pharmacies get dependable deliveries, cleaner margins, and zero expired surprises."
                  }
                  flipKey={lang}
                  mode="words"
                />
              </p>
            </div>

            <div className="lg:col-span-7 divide-y divide-[#E2E8F0] border-t border-b border-[#E2E8F0]">
              {partnerTypes.map((t) => (
                <div key={t.num} className="py-6 flex items-start gap-4">
                  <span className="text-xs font-mono font-bold text-[#1039B9] mt-1">{t.num}</span>
                  <div>
                    <h3
                      className="text-base sm:text-lg font-bold text-[#0F172A] mb-1.5"
                      style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                    >
                      <FlipText text={t.title} flipKey={lang} mode="words" />
                    </h3>
                    <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
                      <FlipText text={t.body} flipKey={lang} mode="words" />
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Interested Partnership Enquiry Section */}
        <section id="partner-enquiry" className="py-16 sm:py-24 bg-[#F8FAFC]">
          <div className="max-w-3xl mx-auto px-5 sm:px-6">
            <div className="text-center mb-10">
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#1039B9] mb-2">
                <FlipText text={isSw ? "OMBI LA USHIRIKA" : "PARTNERSHIP ENQUIRY"} flipKey={lang} />
              </div>
              <h2
                className="text-2xl sm:text-3xl font-bold text-[#0F172A]"
                style={{ fontFamily: "Outfit, Inter, sans-serif" }}
              >
                <FlipText
                  text={isSw ? "Ungependa kushirikiana na Cervos Pharma?" : "Interested in partnering with us?"}
                  flipKey={lang}
                  mode="words"
                />
              </h2>
            </div>

            {sentTo ? (
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-8 sm:p-10 text-center shadow-sm">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#00542C] flex items-center justify-center mx-auto mb-4">
                  <IconCheck className="w-6 h-6" />
                </div>
                <h3
                  className="text-xl font-bold text-[#0F172A] mb-2"
                  style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                >
                  <FlipText text={isSw ? "Tumepokea Ombi Lako" : "Enquiry Received"} flipKey={lang} />
                </h3>
                <p className="text-xs sm:text-sm text-[#475569] mb-6 max-w-md mx-auto">
                  {isSw
                    ? `Asante! Timu yetu ya ushirika itawasiliana nawe kupitia ${sentTo} hivi karibuni.`
                    : `Thank you! Our partnerships desk will reach out to ${sentTo} shortly.`}
                </p>
                <button
                  type="button"
                  onClick={() => setSentTo(null)}
                  className="px-5 py-2.5 rounded border border-[#E2E8F0] text-xs font-semibold text-[#0F172A] hover:bg-slate-50 cursor-pointer"
                >
                  {isSw ? "Tuma Ombi Lingine" : "Send Another Enquiry"}
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleEnquirySubmit}
                className="rounded-2xl border border-[#E2E8F0] bg-white p-6 sm:p-8 shadow-sm space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      <FlipText text={isSw ? "Jina la Taasisi / Kampuni" : "Organization Name"} flipKey={lang} />
                    </label>
                    <input
                      type="text"
                      required
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="e.g. Keko Distribution Ltd"
                      className="w-full px-3.5 py-2.5 rounded border border-[#E2E8F0] bg-[#F8FAFC] text-sm text-[#0F172A] focus:outline-none focus:border-[#1039B9] focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      <FlipText text={isSw ? "Jina la Mwakilishi" : "Contact Person"} flipKey={lang} />
                    </label>
                    <input
                      type="text"
                      required
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Neema Hassan"
                      className="w-full px-3.5 py-2.5 rounded border border-[#E2E8F0] bg-[#F8FAFC] text-sm text-[#0F172A] focus:outline-none focus:border-[#1039B9] focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      <FlipText text={isSw ? "Barua Pepe" : "Work Email"} flipKey={lang} />
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="partnerships@company.co.tz"
                      className="w-full px-3.5 py-2.5 rounded border border-[#E2E8F0] bg-[#F8FAFC] text-sm text-[#0F172A] focus:outline-none focus:border-[#1039B9] focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      <FlipText text={isSw ? "Aina ya Ushirika" : "Partnership Type"} flipKey={lang} />
                    </label>
                    <select
                      value={partnerType}
                      onChange={(e) => setPartnerType(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded border border-[#E2E8F0] bg-[#F8FAFC] text-sm text-[#0F172A] focus:outline-none focus:border-[#1039B9] focus:bg-white"
                    >
                      <option value="Wholesale Distributor">Wholesale Distributor</option>
                      <option value="Cold-Chain & Logistics">Cold-Chain & Fleet Logistics</option>
                      <option value="Pharmacy Group">Pharmacy Group / Chain</option>
                      <option value="Clinical Lab & Research">Clinical Lab / Health Program</option>
                      <option value="Financial & Kasri">Financial & Kasri Clearing</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    <FlipText text={isSw ? "Ujumbe Mfupi" : "How can we work together?"} flipKey={lang} />
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={
                      isSw
                        ? "Elezea kwa ufupi maeneo mnayohudumia au ushirika mnaopendekeza..."
                        : "Share the regions you cover or how you would like to collaborate..."
                    }
                    className="w-full px-3.5 py-2.5 rounded border border-[#E2E8F0] bg-[#F8FAFC] text-sm text-[#0F172A] focus:outline-none focus:border-[#1039B9] focus:bg-white resize-none"
                  />
                </div>

                {errorMsg && <p className="text-xs font-medium text-rose-600">{errorMsg}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded bg-[#1039B9] hover:bg-[#0D2E94] disabled:opacity-50 text-white text-xs sm:text-sm font-semibold transition-all cursor-pointer"
                >
                  {submitting
                    ? isSw ? "Inatuma..." : "Sending..."
                    : isSw ? "Tuma Ombi la Ushirika" : "Submit Partnership Enquiry"}
                </button>
              </form>
            )}
          </div>
        </section>
      </main>

      <footer className="bg-[#0F172A] text-slate-300 py-10 border-t border-slate-800 text-xs">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 flex flex-wrap items-center justify-between gap-4">
          <span>Cervos Pharma &middot; Dar es Salaam, Tanzania</span>
          <div className="flex items-center gap-6">
            <Link href="/" className="hover:text-white transition-colors">
              {isSw ? "Mwanzo" : "Home"}
            </Link>
            <Link href="/about" className="hover:text-white transition-colors">
              {isSw ? "Kuhusu" : "About"}
            </Link>
            <Link href="/about/company" className="hover:text-white transition-colors">
              Cervos Pharma
            </Link>
            <Link href="/downloads" className="hover:text-white transition-colors">
              {isSw ? "Pakua" : "Downloads"}
            </Link>
            <Link href="/contact" className="hover:text-white transition-colors">
              {isSw ? "Mawasiliano" : "Contacts"}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
