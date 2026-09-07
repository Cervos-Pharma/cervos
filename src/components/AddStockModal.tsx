"use client";

/**
 * @file components/AddStockModal.tsx
 * @description Lets a pharmacy owner add a stock batch to one of their own
 * branches directly from the web portal, without needing the desktop POS.
 * Calls addPharmacyBranchBatch (lib/actions/branch.ts), which verifies branch
 * ownership server-side before writing.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { addPharmacyBranchBatch } from "@/lib/actions/branch";

interface CatalogProduct {
  id: string;
  name: string;
}

interface BranchOption {
  id: string;
  name: string;
}

export default function AddStockModal({
  branches,
  products,
}: {
  branches: BranchOption[];
  products: CatalogProduct[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [genericName, setGenericName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [batchNumber, setBatchNumber] = useState("");

  function reset() {
    setError(null);
    setQuantity("");
    setCostPrice("");
    setSalePrice("");
    setExpiryDate("");
    setBatchNumber("");
    setGenericName("");
    setBrandName("");
    setCategory("");
    setMode("existing");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!branchId) return setError("Select a branch.");
    if (!quantity || Number(quantity) <= 0) return setError("Enter a valid quantity.");
    if (!expiryDate) return setError("Expiry date is required.");
    if (mode === "existing" && !productId) return setError("Select a product.");
    if (mode === "new" && !genericName.trim()) return setError("Enter a generic name for the new product.");

    setSaving(true);
    const result = await addPharmacyBranchBatch({
      branchId,
      productId: mode === "existing" ? productId : undefined,
      newProduct: mode === "new" ? { genericName, brandName, category } : undefined,
      quantity: Number(quantity),
      expiryDate,
      costPrice: costPrice ? Number(costPrice) : undefined,
      salePrice: salePrice ? Number(salePrice) : undefined,
      batchNumber: batchNumber || undefined,
    });
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setOpen(false);
    reset();
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-primary-container text-on-primary-container font-mono text-label-md uppercase px-4 py-2 flex items-center gap-2 hover:opacity-90"
      >
        <span className="material-symbols-outlined text-[18px]">add</span>
        Add Stock
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-container-lowest border border-outline-variant w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-outline-variant flex items-center justify-between">
              <h2 className="font-headline-md text-headline-md text-ink-deep">Add Stock</h2>
              <button onClick={() => { setOpen(false); reset(); }} className="text-on-surface-variant hover:text-error">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
              <div>
                <label className="font-mono text-label-md text-on-surface-variant uppercase block mb-1">Branch</label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-base border border-outline-variant text-sm"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode("existing")}
                  className={`flex-1 py-2 text-sm font-semibold border ${mode === "existing" ? "border-primary text-primary bg-primary-container/20" : "border-outline-variant text-on-surface-variant"}`}
                >
                  Existing product
                </button>
                <button
                  type="button"
                  onClick={() => setMode("new")}
                  className={`flex-1 py-2 text-sm font-semibold border ${mode === "new" ? "border-primary text-primary bg-primary-container/20" : "border-outline-variant text-on-surface-variant"}`}
                >
                  New product
                </button>
              </div>

              {mode === "existing" ? (
                <div>
                  <label className="font-mono text-label-md text-on-surface-variant uppercase block mb-1">Product</label>
                  <select
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-base border border-outline-variant text-sm"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <input
                    value={genericName}
                    onChange={(e) => setGenericName(e.target.value)}
                    placeholder="Generic name (required)"
                    className="w-full px-3 py-2 bg-surface-base border border-outline-variant text-sm"
                  />
                  <input
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="Brand name (optional)"
                    className="w-full px-3 py-2 bg-surface-base border border-outline-variant text-sm"
                  />
                  <input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Category (optional)"
                    className="w-full px-3 py-2 bg-surface-base border border-outline-variant text-sm"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-mono text-label-md text-on-surface-variant uppercase block mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-base border border-outline-variant text-sm"
                  />
                </div>
                <div>
                  <label className="font-mono text-label-md text-on-surface-variant uppercase block mb-1">Expiry date</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-base border border-outline-variant text-sm"
                  />
                </div>
                <div>
                  <label className="font-mono text-label-md text-on-surface-variant uppercase block mb-1">Cost price (TZS)</label>
                  <input
                    type="number"
                    min="0"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-base border border-outline-variant text-sm"
                  />
                </div>
                <div>
                  <label className="font-mono text-label-md text-on-surface-variant uppercase block mb-1">Sale price (TZS)</label>
                  <input
                    type="number"
                    min="0"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-base border border-outline-variant text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="font-mono text-label-md text-on-surface-variant uppercase block mb-1">Batch number (optional)</label>
                <input
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-base border border-outline-variant text-sm"
                />
              </div>

              {error && <p className="text-sm text-error">{error}</p>}

              <button
                type="submit"
                disabled={saving || branches.length === 0}
                className="mt-2 bg-primary-container text-on-primary-container font-mono text-label-md uppercase py-3 disabled:opacity-60"
              >
                {saving ? "Adding…" : "Add to inventory"}
              </button>
              {branches.length === 0 && (
                <p className="text-xs text-on-surface-variant text-center">You need a branch before you can add stock.</p>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
