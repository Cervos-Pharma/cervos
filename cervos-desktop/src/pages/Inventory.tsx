import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { queryDb, executeDb, generateId, nowIso } from "../lib/database";
import { getLinkedBranchId, queueForSync, runSyncCycle } from "../lib/sync";
import { PHARMACY_CATEGORIES } from "../lib/branding";
import { useAuthStore } from "../lib/store";
import { useTranslation } from "../lib/i18n";
import type { Product, Batch } from "../types";
import BarcodeScanner from "../components/BarcodeScanner";

declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => {
      detect(source: ImageBitmapSource): Promise<Array<{ rawValue: string }>>;
    };
  }
}

export default function Inventory() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isAdmin, permissions, currentOperator } = useAuthStore()
  const [products, setProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [productBatches, setProductBatches] = useState<Batch[]>([]);
  const [productSales, setProductSales] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    const linkedBranchId = await getLinkedBranchId();
    setBranchId(linkedBranchId);
    if (!linkedBranchId) {
      setProducts([]);
      setBatches([]);
      setSyncError("This POS is not linked to a branch. Link it in Settings before managing inventory.");
      setIsLoading(false);
      return;
    }

    // Pull first so this view reflects the branch selected during onboarding,
    // rather than only an old local cache. Offline use still falls back safely
    // to the last successful local pull.
    const sync = await runSyncCycle();
    setSyncError(sync.ok ? null : (sync.message?.startsWith('offline') ? null : sync.message ?? t('inventory.errRefresh')));

    const prods = await queryDb(
      `SELECT DISTINCT p.* FROM products p
       INNER JOIN batches b ON b.product_id = p.id
       WHERE b.branch_id = ?
       ORDER BY p.generic_name`,
      [linkedBranchId]
    );
    const bats = await queryDb("SELECT * FROM batches WHERE branch_id = ?", [linkedBranchId]);
    // Full local catalog (synced from the web dashboard), independent of
    // whether this branch has stocked it yet — this is what "Add Stock"
    // searches, since a product can exist in the catalog with zero batches
    // here.
    const allProds = await queryDb("SELECT * FROM products ORDER BY generic_name");
    setProducts(prods);
    setBatches(bats);
    setAllProducts(allProds);
    setIsLoading(false);
  }

  async function loadProductDetails(product: Product) {
    const bats = batches.filter((b) => b.product_id === product.id);
    setProductBatches(bats);
    const salesData = await queryDb(`
      SELECT si.*, s.created_at as sale_date, s.payment_method
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE si.batch_id IN (${bats.map(() => '?').join(',') || 'NULL'})
      ORDER BY s.created_at DESC
      LIMIT 50
    `, bats.map(b => b.id));
    setProductSales(salesData);
  }

  function getStockForProduct(productId: string): number {
    return batches
      .filter((b) => b.product_id === productId)
      .reduce((sum, b) => sum + (b.quantity || 0), 0);
  }

  function getLowStockProducts(): Product[] {
    return products.filter((p) => getStockForProduct(p.id) <= (p.low_stock_threshold || 10));
  }

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.generic_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.brand_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode?.includes(searchQuery);
    const matchesCategory = !selectedCategory || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  /**
   * Persist a stock adjustment for one batch: update the local DB, mirror the
   * new quantity to the cloud (update op), and log the reason for the audit
   * trail. Works fully offline — the sync engine pushes the change later.
   */
  async function handleAdjustBatch(
    batch: Batch,
    mode: 'add' | 'remove' | 'set',
    amount: number,
    reason: string
  ) {
    if (!branchId) return;
    const newQty =
      mode === 'set' ? amount : mode === 'add' ? batch.quantity + amount : Math.max(0, batch.quantity - amount);

    await executeDb(`UPDATE batches SET quantity = ?, updated_at = ? WHERE id = ?`, [
      newQty,
      nowIso(),
      batch.id,
    ]);
    await queueForSync("batches", batch.id, "update", {
      id: batch.id,
      branch_id: branchId,
      product_id: batch.product_id,
      batch_number: (batch as any).batch_number ?? null,
      quantity: newQty,
      cost_price: batch.cost_price,
      sale_price: batch.sale_price,
      expiry_date: batch.expiry_date ?? null,
      updated_at: nowIso(),
    });
    // Audit trail row — local to this device ONLY. It is deliberately never
    // queued for cloud sync: the who/why of adjustments is the branch's own
    // business, visible in Records > Audit Log (admin), not HQ data.
    const logId = generateId();
    const prodRows = await queryDb('SELECT generic_name FROM products WHERE id = ?', [batch.product_id]);
    const detail = {
      product_id: batch.product_id,
      product_name: prodRows.length > 0 ? prodRows[0].generic_name : null,
      operator_id: currentOperator?.id ?? null,
      operator_name: currentOperator?.name ?? null,
      mode,
      amount,
      old_quantity: batch.quantity,
      new_quantity: newQty,
      reason: reason || null,
    };
    await executeDb(
      `INSERT INTO activity_log (id, branch_id, action, entity_type, entity_id, detail, created_at) VALUES (?,?,?,?,?,?,?)`,
      [logId, branchId, 'stock_adjustment', 'batch', batch.id, JSON.stringify(detail), nowIso()]
    );

    // Refresh the detail view so the new quantity shows immediately.
    if (viewingProduct) {
      await loadProductDetails(viewingProduct);
    }
    await loadData();
  }

  function handleProductClick(product: Product) {
    if (isAdmin && permissions.canEditInventory) {
      setEditingProduct(product);
    } else if (permissions.canViewInventoryDetail) {
      loadProductDetails(product);
      setViewingProduct(product);
    } else {
      // Fallback: view-only if no edit permission
      loadProductDetails(product);
      setViewingProduct(product);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="material-symbols-outlined animate-spin text-3xl text-primary">
          progress_activity
        </span>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-headline text-2xl font-black text-on-surface">
            Inventory
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {products.length} products Â· {batches.filter((b) => b.quantity > 0).length} batches in stock
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/pos')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-primary text-primary font-semibold hover:bg-primary/10 transition-colors"
          >
            <span className="material-symbols-outlined">point_of_sale</span>
            {t('inventory.makeSale')}
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => setShowAddStockModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-primary text-primary font-semibold hover:bg-primary/10 transition-colors"
              >
                <span className="material-symbols-outlined">inventory</span>
                {t('inventory.addStock')}
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary font-semibold hover:opacity-90 transition-opacity"
              >
                <span className="material-symbols-outlined">add</span>
                {t('inventory.addProduct')}
              </button>
            </>
          )}
        </div>
      </div>

      {syncError && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-sm">
          {syncError} Displaying the latest data stored for this branch.
        </div>
      )}

      {getLowStockProducts().length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2 text-amber-800">
            <span className="material-symbols-outlined">warning</span>
            <span className="font-semibold">
              {getLowStockProducts().length} products low on stock
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {getLowStockProducts().slice(0, 5).map((p) => (
              <span
                key={p.id}
                className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-full"
              >
                {p.generic_name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('inventory.search')}
            className="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-base focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-base focus:outline-none focus:border-primary"
        >
          <option value="">{t('inventory.allCategories')}</option>
          {PHARMACY_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-surface-base border border-outline-variant rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-outline-variant/50">
            <tr className="text-left text-xs font-semibold text-on-surface-variant uppercase">
              <th className="px-4 py-3">{t('inventory.productCol')}</th>
              <th className="px-4 py-3">{t('inventory.categoryCol')}</th>
              <th className="px-4 py-3">{t('inventory.formulationCol')}</th>
              <th className="px-4 py-3">{t('inventory.barcode')}</th>
              <th className="px-4 py-3 text-right">{t('inventory.stock')}</th>
              <th className="px-4 py-3 text-right">{t('inventory.costCol')}</th>
              <th className="px-4 py-3 text-right">{t('inventory.priceCol')}</th>
              {isAdmin && <th className="px-4 py-3"></th>}
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) => {
              const stock = getStockForProduct(product.id);
              const cheapestBatch = batches
                .filter((b) => b.product_id === product.id)
                .sort((a, b) => a.cost_price - b.cost_price)[0];
              const mostExpensiveBatch = batches
                .filter((b) => b.product_id === product.id)
                .sort((a, b) => b.sale_price - a.sale_price)[0];

              return (
                <tr
                  key={product.id}
                  className="border-t border-outline-variant hover:bg-outline-variant/30"
                >
                  <td className="px-4 py-3 cursor-pointer" onClick={() => handleProductClick(product)}>
                    <p className="font-medium text-sm">{product.generic_name}</p>
                    {product.brand_name && (
                      <p className="text-xs text-on-surface-variant">
                        {product.brand_name}
                      </p>
                    )}
                    {product.requires_prescription ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-800 text-xs rounded mt-1">
                        <span className="material-symbols-outlined text-xs">
                          medical_information
                        </span>
                        Rx
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant">
                    {product.category || "Uncategorized"}
                  </td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant">
                    {product.formulation || "â€”"}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono">
                    {product.barcode || "â€”"}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${
                      stock <= 10 ? "text-error" : "text-on-surface"
                    }`}
                  >
                    {stock}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    TZS {cheapestBatch ? cheapestBatch.cost_price.toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    TZS {mostExpensiveBatch ? mostExpensiveBatch.sale_price.toLocaleString() : "—"}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            loadProductDetails(product);
                            setViewingProduct(product);
                          }}
                          title={t('inventory.adjustStock')}
                          className="p-1 rounded hover:bg-primary/10 text-primary transition-colors"
                        >
                          <span className="material-symbols-outlined">visibility</span>
                        </button>
                        <button
                          onClick={() => setEditingProduct(product)}
                          title={t('inventory.editProduct')}
                          className="p-1 rounded hover:bg-primary/10 text-primary transition-colors"
                        >
                          <span className="material-symbols-outlined">edit</span>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-on-surface-variant">
            <span className="material-symbols-outlined text-5xl">inventory_2</span>
            <p className="mt-2 font-medium">{t('inventory.noProducts')}</p>
          </div>
        )}
      </div>

      {viewingProduct && (
        <ProductDetailModal
          product={viewingProduct}
          batches={productBatches}
          sales={productSales}
          onAdjustBatch={handleAdjustBatch}
          onClose={() => {
            setViewingProduct(null);
            setProductBatches([]);
            setProductSales([]);
          }}
        />
      )}

      {(showAddModal || editingProduct) && (
        <ProductModal
          product={editingProduct}
          onClose={() => {
            setShowAddModal(false);
            setEditingProduct(null);
          }}
          onSave={async (productData) => {
            if (!branchId) {
              setSyncError("This POS is not linked to a branch. Inventory cannot be added until it is linked.");
              return;
            }
            const now = nowIso();
            let productId: string;
            if (editingProduct) {
              productId = editingProduct.id;
              await executeDb(
                `UPDATE products SET generic_name = ?, brand_name = ?, category = ?, formulation = ?, requires_prescription = ?, barcode = ?, default_expiry = ?, default_cost_price = ?, default_sale_price = ?, low_stock_threshold = ?, notify_threshold = ?, updated_at = ? WHERE id = ?`,
                [
                  productData.generic_name,
                  productData.brand_name,
                  productData.category,
                  productData.formulation,
                  productData.requires_prescription ? 1 : 0,
                  productData.barcode,
                  productData.default_expiry || null,
                  productData.default_cost_price || null,
                  productData.default_sale_price || null,
                  productData.low_stock_threshold || 10,
                  productData.notify_threshold || 5,
                  now,
                  editingProduct.id,
                ]
              );
              await queueForSync("products", productId, "update", {
                id: productId,
                generic_name: productData.generic_name,
                brand_name: productData.brand_name,
                category: productData.category,
                formulation: productData.formulation,
                requires_prescription: productData.requires_prescription ? 1 : 0,
                barcode: productData.barcode,
                default_expiry: productData.default_expiry || null,
                default_cost_price: productData.default_cost_price || null,
                default_sale_price: productData.default_sale_price || null,
                low_stock_threshold: productData.low_stock_threshold || 10,
                notify_threshold: productData.notify_threshold || 5,
                updated_at: now,
              });
            } else {
              productId = generateId();
              await executeDb(
                `INSERT INTO products (id, generic_name, brand_name, category, formulation, requires_prescription, barcode, default_expiry, default_cost_price, default_sale_price, low_stock_threshold, notify_threshold, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                [
                  productId,
                  productData.generic_name,
                  productData.brand_name,
                  productData.category,
                  productData.formulation,
                  productData.requires_prescription ? 1 : 0,
                  productData.barcode,
                  productData.default_expiry || null,
                  productData.default_cost_price || null,
                  productData.default_sale_price || null,
                  productData.low_stock_threshold || 10,
                  productData.notify_threshold || 5,
                  now,
                ]
              );
              await queueForSync("products", productId, "insert", {
                id: productId,
                generic_name: productData.generic_name,
                brand_name: productData.brand_name,
                category: productData.category,
                formulation: productData.formulation,
                requires_prescription: productData.requires_prescription ? 1 : 0,
                barcode: productData.barcode,
                default_expiry: productData.default_expiry || null,
                default_cost_price: productData.default_cost_price || null,
                default_sale_price: productData.default_sale_price || null,
                low_stock_threshold: productData.low_stock_threshold || 10,
                notify_threshold: productData.notify_threshold || 5,
                updated_at: now,
              });
            }

            if (productData.quantity > 0) {
              const batchId = generateId();
              await executeDb(
                `INSERT INTO batches (id, branch_id, product_id, batch_number, quantity, cost_price, sale_price, expiry_date, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`,
                [
                  batchId,
                  branchId,
                  productId,
                  null,
                  productData.quantity,
                  productData.default_cost_price || 0,
                  productData.default_sale_price || 0,
                  productData.default_expiry || null,
                  now,
                ]
              );
              await queueForSync("batches", batchId, "insert", {
                id: batchId,
                branch_id: branchId,
                product_id: productId,
                batch_number: null,
                quantity: productData.quantity,
                cost_price: productData.default_cost_price || 0,
                sale_price: productData.default_sale_price || 0,
                expiry_date: productData.default_expiry || null,
                sync_version: 1,
                updated_at: now,
              });
            }
            loadData();
            setShowAddModal(false);
            setEditingProduct(null);
            runSyncCycle().catch(() => {});
          }}
        />
      )}

      {showAddStockModal && (
        <AddStockModal
          catalog={allProducts}
          onClose={() => setShowAddStockModal(false)}
          onSave={async (data) => {
            if (!branchId) {
              setSyncError("This POS is not linked to a branch. Inventory cannot be added until it is linked.");
              return;
            }
            const now = nowIso();
            let productId = data.productId;

            if (!productId) {
              // New product — same path "Add Product" uses, just inline here
              // so the operator doesn't have to leave the Add Stock flow.
              productId = generateId();
              await executeDb(
                `INSERT INTO products (id, generic_name, brand_name, category, formulation, requires_prescription, barcode, default_expiry, default_cost_price, default_sale_price, low_stock_threshold, notify_threshold, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                [
                  productId,
                  data.newGenericName || "",
                  data.newBrandName || "",
                  data.newCategory || "",
                  null,
                  0,
                  null,
                  null,
                  data.costPrice ?? null,
                  data.salePrice ?? null,
                  10,
                  5,
                  now,
                ]
              );
              await queueForSync("products", productId, "insert", {
                id: productId,
                generic_name: data.newGenericName || "",
                brand_name: data.newBrandName || "",
                category: data.newCategory || "",
                formulation: null,
                requires_prescription: 0,
                barcode: null,
                default_expiry: null,
                default_cost_price: data.costPrice ?? null,
                default_sale_price: data.salePrice ?? null,
                low_stock_threshold: 10,
                notify_threshold: 5,
                updated_at: now,
              });
            }

            const batchId = generateId();
            await executeDb(
              `INSERT INTO batches (id, branch_id, product_id, batch_number, quantity, cost_price, sale_price, expiry_date, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`,
              [
                batchId,
                branchId,
                productId,
                data.batchNumber || null,
                data.quantity,
                data.costPrice ?? 0,
                data.salePrice ?? 0,
                data.expiryDate,
                now,
              ]
            );
            await queueForSync("batches", batchId, "insert", {
              id: batchId,
              branch_id: branchId,
              product_id: productId,
              batch_number: data.batchNumber || null,
              quantity: data.quantity,
              cost_price: data.costPrice ?? 0,
              sale_price: data.salePrice ?? 0,
              expiry_date: data.expiryDate,
              sync_version: 1,
              updated_at: now,
            });

            loadData();
            setShowAddStockModal(false);
            runSyncCycle().catch(() => {});
          }}
        />
      )}
    </div>
  );
}

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
  onSave: (data: {
    generic_name: string;
    brand_name: string;
    category: string;
    formulation: string;
    requires_prescription: boolean;
    barcode: string;
    quantity: number;
    default_expiry?: string;
    default_cost_price?: number;
    default_sale_price?: number;
    low_stock_threshold: number;
    notify_threshold: number;
  }) => void;
}

const FORMULATIONS = ["Tablet", "Capsule", "Syrup", "Injection", "Cream", "Ointment", "Drops", "Inhaler", "Suppository", "Powder", "Solution", "Suspension", "Gel", "Patch", "Other"]

function ProductModal({ product, onClose, onSave }: ProductModalProps) {
  const { t } = useTranslation();
  const [genericName, setGenericName] = useState(product?.generic_name || "");
  const [brandName, setBrandName] = useState(product?.brand_name || "");
  const [category, setCategory] = useState(product?.category || "");
  const [formulation, setFormulation] = useState(product?.formulation || "");
  const [requiresPrescription, setRequiresPrescription] = useState(
    !!product?.requires_prescription
  );
  const [barcode, setBarcode] = useState(product?.barcode || "");
  const [defaultExpiry, setDefaultExpiry] = useState(product?.default_expiry || "");
  const [defaultCostPrice, setDefaultCostPrice] = useState(product?.default_cost_price?.toString() || "");
  const [defaultSalePrice, setDefaultSalePrice] = useState(product?.default_sale_price?.toString() || "");
  const [quantity, setQuantity] = useState(product ? "0" : "1");
  const [lowStockThreshold, setLowStockThreshold] = useState(product?.low_stock_threshold?.toString() || "10");
  const [notifyThreshold, setNotifyThreshold] = useState(product?.notify_threshold?.toString() || "5");
  const [showScanner, setShowScanner] = useState(false);

  const inputClass =
    "w-full px-3 py-2.5 rounded-md border border-outline-variant bg-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary";
  const labelClass = "block text-xs font-semibold text-on-surface-variant mb-1";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      generic_name: genericName.trim(),
      brand_name: brandName.trim(),
      category,
      formulation,
      requires_prescription: requiresPrescription,
      barcode: barcode.trim(),
      quantity: parseInt(quantity, 10) || 0,
      default_expiry: defaultExpiry || undefined,
      default_cost_price: defaultCostPrice ? parseFloat(defaultCostPrice) : undefined,
      default_sale_price: defaultSalePrice ? parseFloat(defaultSalePrice) : undefined,
      low_stock_threshold: parseInt(lowStockThreshold, 10) || 10,
      notify_threshold: parseInt(notifyThreshold, 10) || 5,
    });
  }

  function handleBarcodeScanned(scannedBarcode: string) {
    setBarcode(scannedBarcode);
    setShowScanner(false);
  }

  return (
    <>
      {showScanner && (
        <BarcodeScanner onScan={handleBarcodeScanned} onClose={() => setShowScanner(false)} />
      )}
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-surface-base rounded-2xl shadow-xl w-full max-w-md max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-6 pb-4 shrink-0">
            <h2 className="font-headline text-xl font-bold text-on-surface">
              {product ? t('inventory.editProduct') : t('inventory.addProduct')}
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-outline-variant transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-6 space-y-4">
            <div>
              <label className={labelClass}>{t('inventory.genericName')} *</label>
              <input
                type="text"
                value={genericName}
                onChange={(e) => setGenericName(e.target.value)}
                className={inputClass}
                placeholder="e.g. Paracetamol"
                required
              />
            </div>

            <div>
              <label className={labelClass}>{t('inventory.brandName')}</label>
              <input
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                className={inputClass}
                placeholder="e.g. Panadol"
              />
            </div>

            <div>
              <label className={labelClass}>{t('inventory.category')}</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={inputClass}
              >
                <option value="">{t('inventory.selectCategory')}</option>
                {PHARMACY_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>{t('inventory.formulation')}</label>
              <select
                value={formulation}
                onChange={(e) => setFormulation(e.target.value)}
                className={inputClass}
              >
                <option value="">{t('inventory.selectFormulation')}</option>
                {FORMULATIONS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>{t('inventory.barcode')}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. 1234567890123"
                />
                <button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  className="px-3 py-2.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  title={t('inventory.scanBarcode')}
                >
                  <span className="material-symbols-outlined">qr_code_scanner</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className={labelClass}>{t('inventory.defaultExpiry')}</label>
                <input
                  type="date"
                  value={defaultExpiry}
                  onChange={(e) => setDefaultExpiry(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>{t('inventory.costPerUnit')}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={defaultCostPrice}
                  onChange={(e) => setDefaultCostPrice(e.target.value)}
                  className={inputClass}
                  placeholder="0.00"
                />
              </div>
              <div>
              <label className={labelClass}>{t('inventory.sellPerUnit')}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={defaultSalePrice}
                onChange={(e) => setDefaultSalePrice(e.target.value)}
                className={inputClass}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className={labelClass}>{t('inventory.stockQty')}</label>
              <input
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={inputClass}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t('inventory.lowStockThreshold')}</label>
              <input
                type="number"
                min="0"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                className={inputClass}
                placeholder="10"
              />
              <p className="text-xs text-on-surface-variant mt-1">{t('inventory.alertBelow')}</p>
            </div>
            <div>
              <label className={labelClass}>{t('inventory.notifyThreshold')}</label>
              <input
                type="number"
                min="0"
                value={notifyThreshold}
                onChange={(e) => setNotifyThreshold(e.target.value)}
                className={inputClass}
                placeholder="5"
              />
              <p className="text-xs text-on-surface-variant mt-1">{t('inventory.urgentBelow')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="requires_prescription"
              checked={requiresPrescription}
              onChange={(e) => setRequiresPrescription(e.target.checked)}
              className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary"
            />
            <label
              htmlFor="requires_prescription"
              className="text-sm text-on-surface"
            >
              Requires prescription
            </label>
          </div>

            </div>
          <div className="shrink-0 flex gap-3 border-t border-outline-variant px-6 py-4 bg-surface-base">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-md border border-outline-variant text-on-surface font-medium hover:bg-outline-variant/30 transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-md bg-primary text-on-primary font-semibold hover:opacity-90 transition-opacity"
            >
              {product ? t('inventory.update') : t('inventory.addProduct')}
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
}

interface AddStockModalProps {
  catalog: Product[];
  onClose: () => void;
  onSave: (data: {
    productId?: string;
    newGenericName?: string;
    newBrandName?: string;
    newCategory?: string;
    batchNumber?: string;
    quantity: number;
    costPrice?: number;
    salePrice?: number;
    expiryDate: string;
  }) => void;
}

function AddStockModal({ catalog, onClose, onSave }: AddStockModalProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [newGenericName, setNewGenericName] = useState("");
  const [newBrandName, setNewBrandName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [quantity, setQuantity] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [error, setError] = useState("");

  const inputClass =
    "w-full px-3 py-2.5 rounded-md border border-outline-variant bg-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary";
  const labelClass = "block text-xs font-semibold text-on-surface-variant mb-1";

  const filteredCatalog = productSearch.trim()
    ? catalog.filter((p) => {
        const q = productSearch.toLowerCase();
        return (
          p.generic_name?.toLowerCase().includes(q) ||
          p.brand_name?.toLowerCase().includes(q)
        );
      })
    : catalog;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (mode === "existing" && !selectedProduct) {
      setError(t('inventory.errSelectProduct'));
      return;
    }
    if (mode === "new" && !newGenericName.trim()) {
      setError(t('inventory.errGenericName'));
      return;
    }
    const qty = parseInt(quantity, 10);
    if (!qty || qty <= 0) {
      setError(t('inventory.errQuantity'));
      return;
    }
    if (!expiryDate) {
      setError(t('inventory.errExpiry'));
      return;
    }
    onSave({
      productId: mode === "existing" ? selectedProduct!.id : undefined,
      newGenericName: mode === "new" ? newGenericName.trim() : undefined,
      newBrandName: mode === "new" ? newBrandName.trim() : undefined,
      newCategory: mode === "new" ? newCategory : undefined,
      batchNumber: batchNumber.trim() || undefined,
      quantity: qty,
      costPrice: costPrice ? parseFloat(costPrice) : undefined,
      salePrice: salePrice ? parseFloat(salePrice) : undefined,
      expiryDate,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-surface-base rounded-2xl shadow-xl w-full max-w-md max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-6 pb-4 shrink-0">
          <h2 className="font-headline text-xl font-bold text-on-surface">{t('inventory.addStock')}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-outline-variant transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-6 space-y-4">
            {error && (
              <div className="p-3 rounded-md bg-error/10 border border-error/20 text-error text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 p-1 bg-surface rounded-lg border border-outline-variant">
              <button
                type="button"
                onClick={() => setMode("existing")}
                className={`py-2 rounded-md text-sm font-semibold transition-all ${
                  mode === "existing" ? "bg-primary text-white" : "text-on-surface-variant"
                }`}
              >
                Existing product
              </button>
              <button
                type="button"
                onClick={() => setMode("new")}
                className={`py-2 rounded-md text-sm font-semibold transition-all ${
                  mode === "new" ? "bg-primary text-white" : "text-on-surface-variant"
                }`}
              >
                New product
              </button>
            </div>

            {mode === "existing" ? (
              <div>
                <label className={labelClass}>{t('inventory.productRequired')}</label>
                <input
                  type="text"
                  value={selectedProduct ? `${selectedProduct.generic_name}${selectedProduct.brand_name ? " — " + selectedProduct.brand_name : ""}` : productSearch}
                  onChange={(e) => {
                    setSelectedProduct(null);
                    setProductSearch(e.target.value);
                  }}
                  placeholder={t('inventory.searchCatalog')}
                  className={inputClass}
                  autoFocus
                />
                {!selectedProduct && productSearch.trim() && (
                  <div className="mt-1 max-h-40 overflow-y-auto border border-outline-variant rounded-md divide-y divide-outline-variant/60">
                    {filteredCatalog.length === 0 ? (
                      <p className="p-3 text-sm text-on-surface-variant">{t('inventory.noCatalogMatch')}</p>
                    ) : (
                      filteredCatalog.slice(0, 20).map((p) => (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() => {
                            setSelectedProduct(p);
                            setProductSearch("");
                            if (p.default_cost_price) setCostPrice(String(p.default_cost_price));
                            if (p.default_sale_price) setSalePrice(String(p.default_sale_price));
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-surface-container-low"
                        >
                          <span className="font-medium">{p.generic_name}</span>
                          {p.brand_name && <span className="text-on-surface-variant"> — {p.brand_name}</span>}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div>
                  <label className={labelClass}>{t('inventory.genericName')} *</label>
                  <input
                    type="text"
                    value={newGenericName}
                    onChange={(e) => setNewGenericName(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Paracetamol"
                  />
                </div>
                <div>
                  <label className={labelClass}>{t('inventory.brandName')}</label>
                  <input
                    type="text"
                    value={newBrandName}
                    onChange={(e) => setNewBrandName(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Panadol"
                  />
                </div>
                <div>
                  <label className={labelClass}>{t('inventory.category')}</label>
                  <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className={inputClass}>
                    <option value="">{t('inventory.selectCategory')}</option>
                    {PHARMACY_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div>
              <label className={labelClass}>{t('inventory.batchNumber')}</label>
              <input
                type="text"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                className={inputClass}
                placeholder={t('inventory.optional')}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>{t('inventory.quantityRequired')}</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className={inputClass}
                  placeholder="0"
                />
              </div>
              <div>
                <label className={labelClass}>{t('inventory.costPerUnit')}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  className={inputClass}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className={labelClass}>{t('inventory.sellPerUnit')}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  className={inputClass}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>{t('inventory.expiryRequired')}</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="shrink-0 flex gap-3 border-t border-outline-variant px-6 py-4 bg-surface-base">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-md border border-outline-variant text-on-surface font-medium hover:bg-outline-variant/30 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-md bg-primary text-on-primary font-semibold hover:opacity-90 transition-opacity"
            >
              Add Stock
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ProductDetailModalProps {
  product: Product;
  batches: Batch[];
  sales: any[];
  onClose: () => void;
  onAdjustBatch: (batch: Batch, mode: 'add' | 'remove' | 'set', amount: number, reason: string) => void;
}

function ProductDetailModal({ product, batches, sales, onClose, onAdjustBatch }: ProductDetailModalProps) {
  const { t } = useTranslation();
  const [adjustingBatch, setAdjustingBatch] = useState<Batch | null>(null);
  const totalStock = batches.reduce((sum, b) => sum + (b.quantity || 0), 0);
  const totalSales = sales.reduce((sum, s) => sum + (s.quantity || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-base rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-headline text-xl font-bold text-on-surface">
            Product Details
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-outline-variant transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-6">
          <div className="bg-surface p-4 rounded-xl border border-outline-variant">
            <h3 className="font-semibold text-lg">{product.generic_name}</h3>
            {product.brand_name && (
              <p className="text-sm text-on-surface-variant">{product.brand_name}</p>
            )}
            <div className="flex gap-4 mt-3 text-sm">
              <span className="text-on-surface-variant">{t('inventory.category')}: <span className="text-on-surface">{product.category || 'N/A'}</span></span>
              <span className="text-on-surface-variant">{t('inventory.barcode')}: <span className="text-on-surface font-mono">{product.barcode || 'N/A'}</span></span>
            </div>
            {product.requires_prescription ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded mt-2">
                <span className="material-symbols-outlined text-xs">medical_information</span>
                Requires Prescription
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-surface p-4 rounded-xl border border-outline-variant text-center">
              <p className="text-xs font-semibold text-on-surface-variant uppercase">{t('inventory.totalStock')}</p>
              <p className={`font-headline text-2xl font-black mt-1 ${totalStock <= 10 ? 'text-error' : 'text-on-surface'}`}>
                {totalStock}
              </p>
            </div>
            <div className="bg-surface p-4 rounded-xl border border-outline-variant text-center">
              <p className="text-xs font-semibold text-on-surface-variant uppercase">{t('inventory.unitsSold')}</p>
              <p className="font-headline text-2xl font-black text-on-surface mt-1">{totalSales}</p>
            </div>
            <div className="bg-surface p-4 rounded-xl border border-outline-variant text-center">
              <p className="text-xs font-semibold text-on-surface-variant uppercase">{t('inventory.batchCount')}</p>
              <p className="font-headline text-2xl font-black text-on-surface mt-1">{batches.length}</p>
            </div>
          </div>

          <div>
            <h3 className="font-headline font-bold text-on-surface mb-3">{t('inventory.batchHistory')}</h3>
            <div className="bg-surface rounded-xl border border-outline-variant overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-outline-variant/50">
                  <tr className="text-left text-xs font-semibold text-on-surface-variant uppercase">
                    <th className="px-4 py-2">{t('inventory.batchId')}</th>
                    <th className="px-4 py-2 text-right">{t('inventory.expiryCol')}</th>
                    <th className="px-4 py-2 text-right">{t('inventory.qtyCol')}</th>
                    <th className="px-4 py-2 text-right">{t('inventory.costCol')}</th>
                    <th className="px-4 py-2 text-right">{t('inventory.priceCol')}</th>
                    <th className="px-4 py-2 text-right">{t('inventory.adjust')}</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-on-surface-variant">{t('inventory.batches')}: 0</td>
                    </tr>
                  ) : (
                    batches.map((batch) => (
                      <tr key={batch.id} className="border-t border-outline-variant">
                        <td className="px-4 py-2 font-mono text-xs">{batch.id.slice(0, 8)}...</td>
                        <td className="px-4 py-2 text-right">{batch.expiry_date ? new Date(batch.expiry_date).toLocaleDateString() : 'N/A'}</td>
                        <td className={`px-4 py-2 text-right font-semibold ${batch.quantity <= 10 ? 'text-error' : ''}`}>{batch.quantity}</td>
                        <td className="px-4 py-2 text-right">TZS ${batch.cost_price.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right">TZS ${batch.sale_price.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => setAdjustingBatch(batch)}
                            className="px-2 py-1 rounded-md text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                          >
                            {t('inventory.adjust')}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {sales.length > 0 && (
            <div>
              <h3 className="font-headline font-bold text-on-surface mb-3">{t('inventory.recentSales')}</h3>
              <div className="bg-surface rounded-xl border border-outline-variant overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-outline-variant/50">
                    <tr className="text-left text-xs font-semibold text-on-surface-variant uppercase">
                      <th className="px-4 py-2">{t('inventory.dateCol')}</th>
                      <th className="px-4 py-2 text-right">{t('inventory.qtyCol')}</th>
                      <th className="px-4 py-2 text-right">{t('inventory.unitPriceCol')}</th>
                      <th className="px-4 py-2 text-right">{t('inventory.paymentCol')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.slice(0, 10).map((sale, idx) => (
                      <tr key={idx} className="border-t border-outline-variant">
                        <td className="px-4 py-2">{sale.sale_date ? new Date(sale.sale_date).toLocaleDateString() : 'N/A'}</td>
                        <td className="px-4 py-2 text-right">{sale.quantity}</td>
                        <td className="px-4 py-2 text-right">TZS ${sale.unit_price.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right">{sale.payment_method || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {adjustingBatch && (
          <StockAdjustModal
            batch={adjustingBatch}
            onClose={() => setAdjustingBatch(null)}
            onSave={(mode, amount, reason) => {
              onAdjustBatch(adjustingBatch, mode, amount, reason);
              setAdjustingBatch(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

interface StockAdjustModalProps {
  batch: Batch;
  onClose: () => void;
  /** Called with (+delta) or an absolute set-quantity plus the reason. */
  onSave: (mode: 'add' | 'remove' | 'set', amount: number, reason: string) => void;
}

const ADJUST_REASONS = [
  'inventory.adjustReasonDamaged',
  'inventory.adjustReasonExpired',
  'inventory.adjustReasonCount',
  'inventory.adjustReasonRestock',
  'inventory.adjustReasonReturn',
] as const;

/** Full-screen modal (scrollable, phone-friendly) to adjust one batch's stock. */
function StockAdjustModal({ batch, onClose, onSave }: StockAdjustModalProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'add' | 'remove' | 'set'>('add');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const amountN = parseInt(amount, 10) || 0;
  const newTotal =
    mode === 'set' ? amountN : mode === 'add' ? batch.quantity + amountN : Math.max(0, batch.quantity - amountN);
  const valid =
    mode === 'set' ? amountN >= 0 && amountN !== batch.quantity : amountN > 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    onSave(mode, amountN, reason.trim());
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-surface-base rounded-2xl shadow-xl w-full max-w-md max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-6 pb-4 shrink-0">
          <h2 className="font-headline text-lg font-bold text-on-surface">
            {t('inventory.adjustTitle')}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-outline-variant transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
            <div className="flex items-center justify-between bg-surface p-3 rounded-lg border border-outline-variant">
              <div>
                <p className="text-sm font-semibold text-on-surface">{(batch as any).batch_number || batch.id.slice(0, 8)}</p>
                {batch.expiry_date && (
                  <p className="text-xs text-on-surface-variant">{t('inventory.expiry')}: {new Date(batch.expiry_date).toLocaleDateString()}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-on-surface-variant">{t('inventory.adjustCurrent')}</p>
                <p className="font-headline text-xl font-black text-on-surface">{batch.quantity}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 p-1 bg-surface rounded-lg border border-outline-variant">
              {(['add', 'remove', 'set'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setAmount(''); }}
                  className={`px-2 py-2 rounded-md text-sm font-semibold transition-colors ${
                    mode === m ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-outline-variant/40'
                  }`}
                >
                  {m === 'add' ? t('inventory.adjustAdd') : m === 'remove' ? t('inventory.adjustRemove') : t('inventory.adjustSet')}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                {mode === 'set' ? t('inventory.adjustNewQty') : t('inventory.adjustAmount')} *
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2.5 rounded-md border border-outline-variant bg-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder={mode === 'set' ? String(batch.quantity) : '0'}
                required
                autoFocus
              />
              {valid && (
                <p className="text-xs text-on-surface-variant mt-1">
                  {t('inventory.adjustNewTotal')}: <span className="font-semibold text-on-surface">{newTotal}</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">{t('inventory.adjustReason')}</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {ADJUST_REASONS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setReason(t(key))}
                    className={`px-2 py-1 rounded-full text-xs border transition-colors ${
                      reason === t(key)
                        ? 'bg-primary/10 border-primary text-primary font-semibold'
                        : 'border-outline-variant text-on-surface-variant hover:bg-outline-variant/30'
                    }`}
                  >
                    {t(key)}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2.5 rounded-md border border-outline-variant bg-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder={t('inventory.adjustReasonPh')}
              />
            </div>
          </div>

          <div className="flex gap-3 p-6 pt-2 border-t border-outline-variant shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-outline-variant text-on-surface-variant font-semibold hover:bg-outline-variant/30 transition-colors"
            >
              {t('inventory.adjustCancel')}
            </button>
            <button
              type="submit"
              disabled={!valid}
              className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-on-primary font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {t('inventory.adjustConfirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
