/**
 * @route /support
 * @access Public (no auth required — anonymous users can submit tickets)
 * @description Public support page with a ticket submission form.
 * Pre-fills contact email for signed-in users and shows their prior tickets below.
 */
import PublicNav from "@/components/PublicNav";
import SupportForm from "./SupportForm";
import { createClient } from "@/lib/supabase/server";
import { getMyTickets, PublicTicket } from "@/lib/actions/support";
import { getT } from "@/lib/i18n/server";

export default async function SupportPage() {
  const t = await getT();
  // Attempt to pre-fill the email for signed-in users.
  // Gracefully falls back to empty string if Supabase isn't configured.
  let prefillEmail = "";
  let existingTickets: PublicTicket[] = [];

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      prefillEmail = user.email;
      existingTickets = await getMyTickets();
    }
  } catch {
    // Supabase not configured — continue anonymously
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <PublicNav activePath="/support" />
      <main className="flex-1 pt-16">
        <div className="max-w-2xl mx-auto px-6 py-16">
          {/* Header */}
          <div className="mb-10">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mb-1">
              {t("support.label")}
            </p>
            <h1 className="font-headline-lg text-headline-lg text-ink-deep mb-3">
              {t("support.title")}
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              {t("support.body")}{" "}
              <a
                href="mailto:hq@cervos.online"
                className="text-primary hover:underline"
              >
                hq@cervos.online
              </a>
              .
            </p>
          </div>

          <SupportForm
            prefillEmail={prefillEmail}
            existingTickets={existingTickets}
          />
        </div>
      </main>
      <footer className="py-6 px-8 border-t border-outline-variant text-center">
        <p className="text-body-sm text-on-surface-variant">
          © {new Date().getFullYear()} Cervos · hq@cervos.online
        </p>
      </footer>
    </div>
  );
}
