/**
 * @route /dashboard/inventory
 * @access Authenticated pharmacy accounts only.
 * @description FEFO batch & product inventory view across pharmacy branches.
 *   Displays active branch details, live POS connection status, and POS-synced stock batches.
 *   Supports search, branch filter, expiry filter, column sorting, and view toggle (Batches vs Products).
 *
 * @data Live Supabase query — batches JOIN products JOIN branches, scoped to
 *   the pharmacy's branch IDs.
 */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PharmacySidebar from "@/components/PharmacySidebar";
import InventoryTable, { type BatchRow, type BranchItem } from "@/components/InventoryTable";
import AddStockModal from "@/components/AddStockModal";
import { getBranchProducts } from "@/lib/actions/branch";
import { getT } from "@/lib/i18n/server";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams?: Promise<{ branch?: string }> | { branch?: string };
}) {
  const t = await getT();
  const resolvedParams = searchParams ? await Promise.resolve(searchParams) : undefined;
  const initialBranchId = resolvedParams?.branch;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/dashboard/inventory");

  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, type, download_enabled")
    .eq("auth_user_id", user.id)
    .single();

  // Enforce pharmacy-only access — supplier users are redirected to their own portal
  if (account?.type !== "pharmacy") redirect("/supplier");

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name, address, subscription_status, pos_activated_at")
    .eq("account_id", account?.id ?? "")
    .order("name");

  const branchList = (branches ?? []) as BranchItem[];
  const branchIds = branchList.map((b) => b.id);
  const branchNameMap = new Map(branchList.map((b) => [b.id, b.name]));

  // Active branch for sidebar display (either matching initialBranchId or first branch)
  const activeBranch = branchList.find((b) => b.id === initialBranchId) || branchList[0];

  // Fetch all batches across branches (FEFO sorted), joined with product + branch metadata.
  type RawBatch = {
    id: string;
    product_id: string;
    quantity: number;
    expiry_date: string;
    batch_number: string | null;
    branch_id: string;
    cost_price: number | null;
    sale_price: number | null;
    products: { id?: string; generic_name: string; brand_name: string | null; category?: string | null } | null;
    branches: { name: string } | null;
  };

  const { data: rawBatches } = branchIds.length === 0
    ? { data: [] }
    : await supabase
        .from("batches")
        .select("id, product_id, quantity, expiry_date, batch_number, branch_id, cost_price, sale_price, products(id, generic_name, brand_name, category), branches(name)")
        .in("branch_id", branchIds)
        .order("expiry_date", { ascending: true });

  const now = Date.now();
  const toDaysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - now) / 86400000);

  const batches: BatchRow[] = ((rawBatches ?? []) as unknown as RawBatch[]).map((row) => {
    const products = row.products;
    const branches = row.branches;
    return {
      id: row.id,
      productId: row.product_id || products?.id,
      productName: products?.brand_name ?? products?.generic_name ?? "—",
      genericName: products?.generic_name ?? "—",
      category: products?.category ?? "General",
      batchNo: row.batch_number ?? "—",
      branchId: row.branch_id,
      branch: branches?.name ?? branchNameMap.get(row.branch_id) ?? "—",
      quantity: row.quantity,
      costPrice: row.cost_price ?? undefined,
      salePrice: row.sale_price ?? undefined,
      expiryDate: row.expiry_date,
      daysLeft: toDaysLeft(row.expiry_date),
    };
  });

  const criticalCount = batches.filter((b) => b.daysLeft <= 14).length;
  const catalogProducts = await getBranchProducts();
  const branchOptions = branchList.map((b) => ({ id: b.id, name: b.name }));

  return (
    <div className="flex min-h-screen bg-surface">
      <PharmacySidebar
        branchName={activeBranch?.name}
        accountName={account?.name}
      />
      <div className="ml-64 flex-1 flex flex-col">
        <header className="bg-surface fixed top-0 right-0 h-16 border-b border-outline-variant flex items-center justify-between px-8 w-[calc(100%-16rem)] z-10">
          <div>
            <p className="font-mono text-label-md text-on-surface-variant uppercase tracking-widest mb-0.5">
              {t("dash.inventory.subtitle")}
            </p>
            <h1 className="font-headline-md text-headline-md text-ink-deep leading-none">{t("dash.inventory.title")}</h1>
          </div>
          <div className="flex items-center gap-4">
            {criticalCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
                <span className="font-mono text-label-md text-error uppercase">
                  {t(criticalCount === 1 ? "dash.inventory.critical" : "dash.inventory.critical.p").replace("{n}", String(criticalCount))}
                </span>
              </div>
            )}
            <AddStockModal branches={branchOptions} products={catalogProducts} />
          </div>
        </header>
        <div className="pt-16 flex-1 flex">
          <InventoryTable
            batches={batches}
            branches={branchList}
            initialBranchId={initialBranchId}
          />
        </div>
      </div>
    </div>
  );
}
