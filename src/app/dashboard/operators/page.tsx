"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PharmacySidebar from "@/components/PharmacySidebar";
import OperatorsTable from "@/components/OperatorsTable";
import { getOperators } from "@/lib/actions/operators";
import { getBranches } from "@/lib/actions/branches";
import { getT } from "@/lib/i18n/server";
import MobileMenuButton from "@/components/MobileMenuButton";

export default async function OperatorsPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/dashboard/operators");

  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, type")
    .eq("auth_user_id", user.id)
    .single();

  if (account?.type !== "pharmacy") redirect("/dashboard");

  const [operators, branches] = await Promise.all([
    getOperators(account!.id),
    getBranches(account!.id),
  ]);

  const branchNames = branches.map((b) => b.name);
  const firstBranch = branches[0];

  return (
    <div className="flex min-h-screen bg-surface">
      <PharmacySidebar branchName={firstBranch?.name} accountName={account?.name} />
      <div className="lg:ml-64 flex-1 min-w-0 flex flex-col">
        <header className="bg-surface fixed top-0 right-0 h-16 border-b border-outline-variant flex items-center px-8 lg:w-[calc(100%-16rem)] w-full z-10">
          <MobileMenuButton />
          <div>
            <p className="font-mono text-label-md text-on-surface-variant uppercase tracking-widest mb-0.5">
              {t("dash.operators.subtitle")}
            </p>
            <h1 className="font-headline-md text-headline-md text-ink-deep leading-none">
              {t("dash.operators.title")}
            </h1>
          </div>
        </header>
        <div className="pt-16 flex-1">
          <OperatorsTable
            operators={operators}
            branches={branches}
          />
        </div>
      </div>
    </div>
  );
}
