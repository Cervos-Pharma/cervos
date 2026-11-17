import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SupplierSidebar from "@/components/SupplierSidebar";
import SupplierQuoteAnswersClient from "./SupplierQuoteAnswersClient";

export default async function SupplierQuoteAnswersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, type")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const accountType = account?.type ?? user.user_metadata?.account_type ?? "pharmacy";
  if (accountType !== "supplier") {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen bg-surface-container-lowest">
      <SupplierSidebar accountName={account?.name} />
      <main className="lg:ml-64 flex-1 min-w-0 max-w-5xl mx-auto px-6 py-12">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          }
        >
          <SupplierQuoteAnswersClient />
        </Suspense>
      </main>
    </div>
  );
}
