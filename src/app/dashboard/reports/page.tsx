"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PharmacySidebar from "@/components/PharmacySidebar";
import ReportsChart from "@/components/ReportsChart";
import { getSalesReport } from "@/lib/actions/reports";
import { getBranches } from "@/lib/actions/branches";
import { getT } from "@/lib/i18n/server";
import MobileMenuButton from "@/components/MobileMenuButton";

export default async function ReportsPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/dashboard/reports");

  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, type")
    .eq("auth_user_id", user.id)
    .single();

  if (account?.type !== "pharmacy") redirect("/dashboard");

  const branches = await getBranches(account!.id);

  const now = new Date();
  const dateFrom = new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0];
  const dateTo = now.toISOString().split("T")[0];

  const report = await getSalesReport(account!.id, dateFrom, dateTo);

  return (
    <div className="flex min-h-screen bg-surface">
      <PharmacySidebar branchName={branches[0]?.name} accountName={account?.name} />
      <div className="lg:ml-64 flex-1 min-w-0 flex flex-col">
        <header className="bg-surface fixed top-0 right-0 h-16 border-b border-outline-variant flex items-center px-8 lg:w-[calc(100%-16rem)] w-full z-10">
          <MobileMenuButton />
          <div>
            <p className="font-mono text-label-md text-on-surface-variant uppercase tracking-widest mb-0.5">
              {t("dash.reports.subtitle")}
            </p>
            <h1 className="font-headline-md text-headline-md text-ink-deep leading-none">
              {t("dash.reports.title")}
            </h1>
          </div>
        </header>
        <div className="pt-16 flex-1">
          <ReportsChart
            initialReport={report}
            branches={branches}
            accountId={account!.id}
          />
        </div>
      </div>
    </div>
  );
}
