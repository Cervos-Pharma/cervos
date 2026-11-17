import PublicNav from "@/components/PublicNav";
import Link from "next/link";

const SECTIONS = [
  {
    title: "1. Who We Are",
    body: `Cervos operates the Cervos pharmacy management platform ("Service"). We are committed to protecting your personal information and being transparent about how we collect and use it. For questions, contact our Data Protection Officer at privacy@cervos.online.`,
  },
  {
    title: "2. Information We Collect",
    body: `We collect information you provide directly: account registration details (name, email, phone, entity name, account type); payment and billing information (processed securely by our payment provider); pharmacy and branch operational data you enter into the Service (inventory, transactions, staff); and supplier catalogue and order data. We also collect automatically: usage logs, IP addresses, device identifiers, and session data through cookies and similar technologies.`,
  },
  {
    title: "3. How We Use Your Information",
    body: `We use your information to: provide, maintain and improve the Service; process transactions and send related notices; send operational and security alerts; respond to your support requests; comply with legal obligations; and detect and prevent fraud or abuse. We do not sell your personal data to third parties. We may use anonymised, aggregated data for product research and public reporting.`,
  },
  {
    title: "4. Legal Basis for Processing (GDPR & Tanzania PDPA)",
    body: `Where applicable, we process personal data on the following legal bases: performance of a contract (providing the Service); compliance with legal obligations (financial record-keeping, regulatory reporting); legitimate interests (security monitoring, fraud prevention, product improvement); and consent (marketing communications, which you may withdraw at any time).`,
  },
  {
    title: "5. Data Sharing",
    body: `We share your data only with: (a) trusted service providers who process data on our behalf (cloud hosting, payment processing, email delivery) under strict data processing agreements; (b) regulators or law enforcement where required by law; and (c) a buyer or successor entity in the event of a merger or acquisition, with prior notice to you. We never sell your data for advertising purposes.`,
  },
  {
    title: "6. Data Retention",
    body: `We retain your account data for the duration of your subscription and for up to 7 years thereafter for financial and compliance purposes, or as required by Tanzanian law. Operational pharmacy data (transaction logs, inventory records) is retained for the period you maintain an account plus 5 years for audit purposes. You may request earlier deletion of non-legally-required data by contacting privacy@cervos.online.`,
  },
  {
    title: "7. Security",
    body: `We protect your data with TLS encryption in transit, AES-256 encryption at rest, role-based access controls, multi-factor authentication options, regular penetration testing, and comprehensive audit logging. If we become aware of a data breach affecting your personal data, we will notify you and the relevant authorities within 72 hours as required by law.`,
  },
  {
    title: "8. Your Rights",
    body: `Depending on your jurisdiction, you have rights to: access your personal data; correct inaccurate data; request deletion of data we are not required to retain; object to or restrict certain processing; port your data in a machine-readable format; and withdraw consent at any time. To exercise these rights, email privacy@cervos.online. We will respond within 30 days.`,
  },
  {
    title: "9. Cookies",
    body: `We use strictly necessary cookies to maintain your session and authentication state. We use analytics cookies (with your consent) to understand how the Service is used. You can manage cookie preferences in your browser settings. Disabling necessary cookies will prevent you from logging in to the platform.`,
  },
  {
    title: "10. International Transfers",
    body: `Your data is primarily stored on servers in the European Union (Supabase infrastructure). Where data is transferred outside Tanzania or the EEA, we ensure adequate protections are in place through standard contractual clauses approved by relevant data protection authorities.`,
  },
  {
    title: "11. Children's Privacy",
    body: `The Service is not intended for use by persons under 18. We do not knowingly collect personal data from children. If you believe a child has provided us with personal data, please contact privacy@cervos.online and we will promptly delete it.`,
  },
  {
    title: "12. Changes to This Policy",
    body: `We will notify you of material changes to this Policy by email and in-platform notice at least 14 days before they take effect. The current version is always available at cervos.online/privacy.`,
  },
  {
    title: "13. Contact Us",
    body: `Data Protection Officer: privacy@cervos.online · General: hq@cervos.online · Cervos, Dar es Salaam, United Republic of Tanzania.`,
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-surface-base flex flex-col">
      <PublicNav activePath="/privacy" />

      <div className="bg-ink-deep pt-24 pb-12 px-8">
        <div className="max-w-3xl mx-auto">
          <p className="font-label-md text-label-md text-secondary uppercase tracking-widest mb-3">Legal</p>
          <h1 className="font-headline-lg text-headline-lg text-on-primary mb-3">Privacy Policy</h1>
          <p className="font-body-md text-body-md text-surface-variant/70">
            Last updated: August 2026 · Applies to all Cervos products and services
          </p>
        </div>
      </div>

      <main className="flex-1 max-w-3xl mx-auto px-8 py-16 w-full">
        <div className="bg-surface-base border border-outline-variant/30 rounded-lg p-8 md:p-12 shadow-sm">
          <p className="font-body-md text-body-md text-on-surface-variant mb-10 pb-6 border-b border-outline-variant/30">
            Your privacy matters. This Policy explains what personal data Cervos collects, how we use it, and the choices and rights you have.
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
            <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
            <Link href="/support" className="hover:text-primary transition-colors">Support</Link>
            <a href="mailto:privacy@cervos.online" className="hover:text-primary transition-colors">privacy@cervos.online</a>
          </div>
        </div>
      </main>

      <footer className="py-6 px-8 border-t border-outline-variant bg-surface-muted text-center">
        <p className="font-body-sm text-body-sm text-on-surface-variant">© {new Date().getFullYear()} Cervos. All rights reserved.</p>
      </footer>
    </div>
  );
}
