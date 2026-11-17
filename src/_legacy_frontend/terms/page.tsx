import PublicNav from "@/components/PublicNav";
import Link from "next/link";

const SECTIONS = [
  {
    title: "1. Acceptance of Terms",
    body: `By accessing or using the Cervos platform ("Service"), including the web application, desktop application, and API, you agree to be bound by these Terms of Service. If you are entering into these Terms on behalf of a company or legal entity, you represent that you have the authority to bind that entity. If you do not agree, do not use the Service.`,
  },
  {
    title: "2. Description of Service",
    body: `Cervos provides pharmacy operations software including inventory management, point-of-sale processing, marketplace connectivity, and supply chain logistics tools. The Service is provided "as is" and Cervos reserves the right to modify, suspend, or discontinue any feature at any time with reasonable notice.`,
  },
  {
    title: "3. Account Obligations",
    body: `You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You must (a) provide accurate registration information; (b) promptly update your information if it changes; (c) not share your credentials with unauthorised persons; and (d) notify Cervos immediately at hq@cervos.online of any unauthorised access.`,
  },
  {
    title: "4. Permitted Use",
    body: `You may use the Service solely for lawful pharmacy management and pharmaceutical supply chain purposes within the jurisdictions where you are licensed to operate. You must not: reverse-engineer the software; scrape or bulk-export data without written consent; use the Service to process transactions for unlicensed or counterfeit pharmaceutical products; or attempt to gain unauthorised access to any part of the platform.`,
  },
  {
    title: "5. Fees and Billing",
    body: `Subscription fees are billed monthly or annually as agreed at signup. Fees are non-refundable except where required by applicable law. Cervos reserves the right to change pricing with 30 days' written notice. Failure to pay may result in suspension of your account after a 7-day grace period.`,
  },
  {
    title: "6. Data and Confidentiality",
    body: `You retain ownership of all pharmacy data you input into the Service. Cervos processes this data only to provide the Service and as described in our Privacy Policy. We employ industry-standard encryption, access controls, and audit logging. You agree that Cervos may use anonymised, aggregated statistics derived from platform usage for product improvement and reporting.`,
  },
  {
    title: "7. Intellectual Property",
    body: `The Cervos name, logo, software, documentation, and all associated intellectual property are owned by Cervos and protected by Tanzanian and international law. Nothing in these Terms grants you any rights in the Service other than the limited licence to use it as described herein.`,
  },
  {
    title: "8. Limitation of Liability",
    body: `To the maximum extent permitted by law, Cervos shall not be liable for indirect, incidental, special, or consequential damages arising from your use of the Service, including loss of revenue, patient harm resulting from incorrect dispensing decisions, or data loss. Cervos's total liability for any claim is limited to the fees paid by you in the 12 months preceding the claim.`,
  },
  {
    title: "9. Termination",
    body: `Either party may terminate the agreement with 30 days' written notice. Cervos may terminate immediately if you breach these Terms. Upon termination, you may export your data within 30 days; after which Cervos will securely delete it in accordance with our data retention policy.`,
  },
  {
    title: "10. Governing Law",
    body: `These Terms are governed by the laws of the United Republic of Tanzania. Any disputes shall be resolved first by good-faith negotiation, then by mediation, and finally by binding arbitration in Dar es Salaam under the rules of the Tanzania Institute of Arbitrators.`,
  },
  {
    title: "11. Changes to These Terms",
    body: `Cervos may update these Terms periodically. We will notify you by email and by notice within the platform at least 14 days before material changes take effect. Continued use of the Service after changes constitutes acceptance.`,
  },
  {
    title: "12. Contact",
    body: `Questions about these Terms? Contact us at hq@cervos.online or write to: Cervos, Dar es Salaam, Tanzania.`,
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-surface-base flex flex-col">
      <PublicNav activePath="/terms" />

      {/* Hero */}
      <div className="bg-ink-deep pt-24 pb-12 px-8">
        <div className="max-w-3xl mx-auto">
          <p className="font-label-md text-label-md text-primary uppercase tracking-widest mb-3">Legal</p>
          <h1 className="font-headline-lg text-headline-lg text-on-primary mb-3">Terms of Service</h1>
          <p className="font-body-md text-body-md text-surface-variant/70">
            Last updated: August 2026 · Effective for all Cervos accounts
          </p>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 max-w-3xl mx-auto px-8 py-16 w-full">
        <div className="bg-surface-base border border-outline-variant/30 rounded-lg p-8 md:p-12 shadow-sm">
          <p className="font-body-md text-body-md text-on-surface-variant mb-10 pb-6 border-b border-outline-variant/30">
            Please read these Terms of Service carefully before using the Cervos platform. These Terms constitute a legally binding agreement between you and Cervos.
          </p>

          <div className="space-y-10">
            {SECTIONS.map(s => (
              <div key={s.title}>
                <h2 className="font-headline-md text-headline-md text-ink-deep mb-3">{s.title}</h2>
                <p className="font-body-md text-body-md text-on-surface leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-4 items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-primary font-label-md text-label-md hover:underline">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Home
          </Link>
          <div className="flex gap-6 font-body-sm text-body-sm text-on-surface-variant">
            <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link href="/support" className="hover:text-primary transition-colors">Support</Link>
            <a href="mailto:hq@cervos.online" className="hover:text-primary transition-colors">hq@cervos.online</a>
          </div>
        </div>
      </main>

      <footer className="py-6 px-8 border-t border-outline-variant bg-surface-muted text-center">
        <p className="font-body-sm text-body-sm text-on-surface-variant">© {new Date().getFullYear()} Cervos. All rights reserved.</p>
      </footer>
    </div>
  );
}
