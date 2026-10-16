import { useState, useEffect, useCallback } from 'react'
import { queryDb } from '../lib/database'
import { useTranslation } from '../lib/i18n'
import { exportReceiptPng, exportReceiptPdf, exportReceiptBundle, ReceiptMeta } from '../lib/exports'

interface ReceiptData {
  id: string
  sale_id: string
  receipt_number: string
  created_at: string
  total: number
  tax: number
  discount: number
  tender: number
  change_due: number
  payment_method: string | null
  operator_name: string | null
  items: { product_name: string; quantity: number; unit_price: number }[]
}

interface AuditEntry {
  id: string
  action: string
  actor: string | null
  entity_type: string | null
  detail: string | null
  created_at: string
  synced: number
}

type RecordsTab = 'receipts' | 'audit'

export default function Records() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<RecordsTab>('receipts')
  const [receipts, setReceipts] = useState<ReceiptData[]>([])
  const [filteredReceipts, setFilteredReceipts] = useState<ReceiptData[]>([])
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [filteredAudit, setFilteredAudit] = useState<AuditEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)
  const [exportNote, setExportNote] = useState<string | null>(null)

  useEffect(() => {
    loadReceipts()
    loadAudit()
  }, [])

  useEffect(() => {
    filterReceipts()
  }, [receipts, searchQuery, dateFilter])

  useEffect(() => {
    filterAudit()
  }, [auditEntries, searchQuery, dateFilter])

  async function loadReceipts() {
    setIsLoading(true)
    const salesData = await queryDb(`
      SELECT s.*, r.receipt_number, r.id as receipt_id, o.name as operator_name
      FROM sales s
      LEFT JOIN receipts r ON r.sale_id = s.id
      LEFT JOIN operators o ON o.id = s.operator_id
      ORDER BY s.created_at DESC
    `)

    const receiptPromises = salesData.map(async (sale: any) => {
      const items = await queryDb(`
        SELECT si.quantity, si.unit_price, p.generic_name
        FROM sale_items si
        LEFT JOIN batches b ON b.id = si.batch_id
        LEFT JOIN products p ON p.id = b.product_id
        WHERE si.sale_id = ?
      `, [sale.id])

      return {
        id: sale.receipt_id,
        sale_id: sale.id,
        receipt_number: sale.receipt_number || 'N/A',
        created_at: sale.created_at,
        total: sale.total,
        tax: sale.tax,
        discount: sale.discount,
        tender: sale.tender,
        change_due: sale.change_due,
        payment_method: sale.payment_method,
        operator_name: sale.operator_name,
        items: items.map((item: any) => ({
          product_name: item.generic_name || 'Unknown Product',
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
      }
    })

    const allReceipts = await Promise.all(receiptPromises)
    setReceipts(allReceipts)
    setIsLoading(false)
  }

  /** Pharmacy/branch branding read from app_settings (offline-safe). */
  const meta = useCallback(async (): Promise<ReceiptMeta> => {
    const meta: ReceiptMeta = {}
    try {
      const rows = await queryDb(
        "SELECT key, value FROM app_settings WHERE key IN ('pharmacy_name', 'branch_name', 'branch_id_name', 'account_name', 'centre_name')"
      )
      for (const row of rows as { key: string; value: string }[]) {
        try {
          const v = JSON.parse(row.value)
          if (row.key === 'pharmacy_name') meta.pharmacyName = v
          if (row.key === 'branch_name' || row.key === 'branch_id_name') meta.branchName = v
          if (row.key === 'account_name') meta.branchName = meta.branchName || v
          if (row.key === 'centre_name') meta.address = v
        } catch { /* skip malformed row */ }
      }
    } catch { /* db not ready — default branding */ }
    return meta
  }, [])

  async function loadAudit() {
    // Local audit trail: every logged action on this POS (stock adjustments
    // and more), newest first. Stays visible offline; the same rows sync to
    // the cloud in the background.
    const rows = await queryDb(`
      SELECT a.id, a.action, a.entity_type, a.detail, a.created_at, a.synced,
             COALESCE(o.name, a.actor) as actor
      FROM activity_log a
      LEFT JOIN operators o ON o.id = a.operator_id
      ORDER BY a.created_at DESC
      LIMIT 500
    `)
    // Older rows have no operator stamped in the detail; newer rows carry
    // operator_name in detail — prefer it when the join came up empty.
    const withNames = (rows as AuditEntry[]).map((r) => {
      if (r.actor) return r
      try {
        const d = r.detail ? JSON.parse(r.detail) : {}
        if (d.operator_name) return { ...r, actor: d.operator_name }
      } catch { /* fall through */ }
      return r
    })
    setAuditEntries(withNames)
  }

  function parseDetail(detail: string | null): Record<string, any> {
    if (!detail) return {}
    try {
      return JSON.parse(detail)
    } catch {
      return {}
    }
  }

  function auditActionLabel(action: string): string {
    if (action === 'stock_adjustment') return t('records.auditActionStock')
    return action.replace(/_/g, ' ')
  }

  function filterReceipts() {
    let filtered = receipts

    if (searchQuery) {
      filtered = filtered.filter(r =>
        r.receipt_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.operator_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.items.some(item => item.product_name.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }

    if (dateFilter) {
      filtered = filtered.filter(r => r.created_at.startsWith(dateFilter))
    }

    setFilteredReceipts(filtered)
  }

  function filterAudit() {
    let filtered = auditEntries

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(a => {
        const d = parseDetail(a.detail)
        return (
          a.action.toLowerCase().includes(q) ||
          auditActionLabel(a.action).toLowerCase().includes(q) ||
          a.actor?.toLowerCase().includes(q) ||
          (typeof d.reason === 'string' && d.reason.toLowerCase().includes(q))
        )
      })
    }

    if (dateFilter) {
      filtered = filtered.filter(a => a.created_at.startsWith(dateFilter))
    }

    setFilteredAudit(filtered)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="material-symbols-outlined animate-spin text-3xl text-primary">
          progress_activity
        </span>
      </div>
    )
  }

  const selectedRows = filteredReceipts.filter((r) => checked.has(r.id || r.sale_id))

  function toggleChecked(receipt: ReceiptData) {
    const id = receipt.id || receipt.sale_id
    setChecked((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  async function runExport(fn: () => Promise<void>) {
    setExporting(true)
    setExportNote(null)
    try {
      await fn()
      setExportNote(t('records.exportDone'))
    } catch {
      setExportNote(t('records.exportFailed'))
    } finally {
      setExporting(false)
      setTimeout(() => setExportNote(null), 4000)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-headline text-2xl font-black text-on-surface">
            {t('records.title')}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {tab === 'receipts'
              ? `${filteredReceipts.length} receipts`
              : `${filteredAudit.length} entries`}
          </p>
        </div>
        {tab === 'receipts' && (
          <div className="flex items-center gap-2 flex-wrap">
            {exportNote && <span className="text-xs font-medium text-secondary">{exportNote}</span>}
            <button
              type="button"
              disabled={exporting || selectedRows.length === 0}
              onClick={() => runExport(() => exportReceiptBundle(selectedRows, 'png', {}))}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-outline-variant text-sm font-semibold text-on-surface hover:bg-outline-variant/30 disabled:opacity-40 transition-colors"
            >
              <span className="material-symbols-outlined text-base">image</span>
              {t('records.exportBundlePng').replace('{count}', String(selectedRows.length))}
            </button>
            <button
              type="button"
              disabled={exporting || selectedRows.length === 0}
              onClick={() => runExport(() => exportReceiptBundle(selectedRows, 'pdf', {}))}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-colors"
            >
              <span className="material-symbols-outlined text-base">picture_as_pdf</span>
              {t('records.exportBundlePdf').replace('{count}', String(selectedRows.length))}
            </button>
          </div>
        )}
      </div>

      {/* Tab switch: Receipts | Audit Log */}
      <div className="inline-flex p-1 bg-surface rounded-lg border border-outline-variant mb-6">
        <button
          type="button"
          onClick={() => { setTab('receipts'); setChecked(new Set()) }}
          className={`flex items-center justify-center gap-2 py-2.5 px-5 rounded-md text-sm font-semibold transition-all ${
            tab === 'receipts'
              ? 'bg-primary text-white shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-lg">receipt_long</span>
          {t('records.tabReceipts')}
        </button>
        <button
          type="button"
          onClick={() => setTab('audit')}
          className={`flex items-center justify-center gap-2 py-2.5 px-5 rounded-md text-sm font-semibold transition-all ${
            tab === 'audit'
              ? 'bg-primary text-white shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-lg">history</span>
          {t('records.tabAudit')}
        </button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={tab === 'receipts' ? t('records.search') : t('records.auditSearch')}
            className="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-base focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-base focus:outline-none focus:border-primary"
        />
      </div>

      {tab === 'receipts' && (
      <div className="bg-surface-base border border-outline-variant rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-outline-variant/50">
            <tr className="text-left text-xs font-semibold text-on-surface-variant uppercase">
              <th className="px-4 py-3">{t('records.receiptNo')}</th>
              <th className="px-4 py-3">{t('records.dateCol')}</th>
              <th className="px-4 py-3">{t('records.operator')}</th>
              <th className="px-4 py-3">{t('records.itemsCol')}</th>
              <th className="px-4 py-3 text-right">{t('records.totalCol')}</th>
              <th className="px-4 py-3">{t('records.paymentCol')}</th>
              <th className="px-4 py-3"></th>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  aria-label={t('records.selectAll')}
                  checked={filteredReceipts.length > 0 && selectedRows.length === filteredReceipts.length}
                  onChange={(e) =>
                    setChecked(
                      e.target.checked
                        ? new Set(filteredReceipts.map((r) => r.id || r.sale_id))
                        : new Set()
                    )
                  }
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredReceipts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-5xl">receipt_long</span>
                  <p className="mt-2 font-medium">{t('records.noReceipts')}</p>
                </td>
              </tr>
            ) : (
              filteredReceipts.map((receipt) => (
                <tr key={receipt.id || receipt.sale_id} className="border-t border-outline-variant hover:bg-outline-variant/30">
                  <td className="px-4 py-3 font-mono text-sm">{receipt.receipt_number}</td>
                  <td className="px-4 py-3 text-sm">
                    {new Date(receipt.created_at).toLocaleDateString()} {new Date(receipt.created_at).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-3 text-sm">{receipt.operator_name || 'Unknown'}</td>
                  <td className="px-4 py-3 text-sm">{receipt.items.length} items</td>
                  <td className="px-4 py-3 text-right font-semibold">TZS {receipt.total.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-outline-variant/50 rounded text-xs font-medium">
                      {receipt.payment_method?.replace('_', ' ').toUpperCase() || 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedReceipt(receipt)}
                      className="p-1 rounded hover:bg-primary/10 text-primary transition-colors"
                    >
                      <span className="material-symbols-outlined">visibility</span>
                    </button>
                    <button
                      onClick={async () => {
                        await runExport(async () => exportReceiptPdf(receipt, await meta()))
                      }}
                      title={t('records.exportPdf')}
                      className="p-1 rounded hover:bg-primary/10 text-on-surface-variant hover:text-primary transition-colors"
                    >
                      <span className="material-symbols-outlined">picture_as_pdf</span>
                    </button>
                    <button
                      onClick={async () => {
                        await runExport(async () => exportReceiptPng(receipt, await meta()))
                      }}
                      title={t('records.exportPng')}
                      className="p-1 rounded hover:bg-primary/10 text-on-surface-variant hover:text-primary transition-colors"
                    >
                      <span className="material-symbols-outlined">image</span>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={t('records.selectOne')}
                      checked={checked.has(receipt.id || receipt.sale_id)}
                      onChange={() => toggleChecked(receipt)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
      )}

      {tab === 'audit' && (
        <div className="space-y-3">
          {filteredAudit.length === 0 ? (
            <div className="bg-surface-base border border-outline-variant rounded-xl px-4 py-12 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-5xl">history</span>
              <p className="mt-2 font-medium">{t('records.auditEmpty')}</p>
              <p className="mt-1 text-sm">{t('records.auditEmptyHint')}</p>
            </div>
          ) : (
            filteredAudit.map((entry) => {
              const d = parseDetail(entry.detail)
              const hasQtyChange =
                typeof d.old_quantity === 'number' && typeof d.new_quantity === 'number'
              return (
                <div
                  key={entry.id}
                  className="bg-surface-base border border-outline-variant rounded-xl px-4 py-3 flex items-start justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        <span className="material-symbols-outlined text-xs">edit</span>
                        {auditActionLabel(entry.action)}
                      </span>
                      <span className="text-sm font-medium text-on-surface">
                        {d.product_name || entry.entity_type || ''}
                      </span>
                    </div>
                    {hasQtyChange && (
                      <p className="text-sm text-on-surface-variant mt-1">
                        {t('records.auditChange')}:{' '}
                        <span className="font-semibold text-on-surface">
                          {d.old_quantity} → {d.new_quantity}
                        </span>
                        {typeof d.amount === 'number' && (
                          <span className="ml-2">
                            ({d.amount > 0 ? '+' : ''}{d.amount})
                          </span>
                        )}
                      </p>
                    )}
                    <p className="text-xs text-on-surface-variant mt-1">
                      {t('records.auditActor')}: {entry.actor || 'Unknown'}
                      {' · '}
                      {new Date(entry.created_at).toLocaleDateString()} {new Date(entry.created_at).toLocaleTimeString()}
                    </p>
                    <p className="text-xs mt-1">
                      <span className="text-on-surface-variant">{t('records.auditReason')}: </span>
                      <span className={d.reason ? 'text-on-surface' : 'text-on-surface-variant/60 italic'}>
                        {d.reason || t('records.auditNoReason')}
                      </span>
                    </p>
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full ${
                      entry.synced
                        ? 'bg-secondary/10 text-secondary'
                        : 'bg-warning/10 text-warning'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xs">
                      {entry.synced ? 'cloud_done' : 'cloud_upload'}
                    </span>
                    {entry.synced ? t('records.synced') : t('records.pending')}
                  </span>
                </div>
              )
            })
          )}
        </div>
      )}

      {selectedReceipt && tab === 'receipts' && (
        <ReceiptModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  )
}

interface ReceiptModalProps {
  receipt: ReceiptData
  onClose: () => void
}

function ReceiptModal({ receipt, onClose }: ReceiptModalProps) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-base rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-headline text-xl font-bold text-on-surface">
            Receipt {receipt.receipt_number}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                const rows = await queryDb(
                  "SELECT key, value FROM app_settings WHERE key IN ('pharmacy_name', 'branch_name', 'branch_id_name', 'account_name')"
                )
                const m: ReceiptMeta = {}
                for (const row of rows as { key: string; value: string }[]) {
                  try {
                    const v = JSON.parse(row.value)
                    if (row.key === 'pharmacy_name') m.pharmacyName = v
                    if (row.key === 'branch_name' || row.key === 'branch_id_name') m.branchName = v
                    if (row.key === 'account_name') m.branchName = m.branchName || v
                  } catch { /* skip malformed row */ }
                }
                await exportReceiptPdf(receipt, m)
              }}
              title={t('records.exportPdf')}
              className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-colors"
            >
              <span className="material-symbols-outlined">picture_as_pdf</span>
            </button>
            <button
              onClick={async () => {
                const rows = await queryDb(
                  "SELECT key, value FROM app_settings WHERE key IN ('pharmacy_name', 'branch_name', 'branch_id_name', 'account_name')"
                )
                const m: ReceiptMeta = {}
                for (const row of rows as { key: string; value: string }[]) {
                  try {
                    const v = JSON.parse(row.value)
                    if (row.key === 'pharmacy_name') m.pharmacyName = v
                    if (row.key === 'branch_name' || row.key === 'branch_id_name') m.branchName = v
                    if (row.key === 'account_name') m.branchName = m.branchName || v
                  } catch { /* skip malformed row */ }
                }
                await exportReceiptPng(receipt, m)
              }}
              title={t('records.exportPng')}
              className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-colors"
            >
              <span className="material-symbols-outlined">image</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-outline-variant transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-on-surface-variant">{t('records.dateCol')}</span>
            <span className="font-medium">{new Date(receipt.created_at).toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-on-surface-variant">{t('records.operator')}</span>
            <span className="font-medium">{receipt.operator_name || 'Unknown'}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-on-surface-variant">{t('records.paymentMethod')}</span>
            <span className="font-medium">{receipt.payment_method?.replace('_', ' ').toUpperCase() || 'N/A'}</span>
          </div>

          <div className="border-t border-outline-variant pt-4">
            <h3 className="font-semibold text-sm mb-2">{t('records.itemsCol')}</h3>
            <div className="space-y-2">
              {receipt.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-on-surface">{item.product_name} x{item.quantity}</span>
                  <span className="font-medium">TZS {(item.unit_price * item.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-outline-variant pt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-on-surface-variant">{t('records.subtotal')}</span>
              <span>TZS {(receipt.total - receipt.tax).toLocaleString()}</span>
            </div>
            {receipt.tax > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-on-surface-variant">{t('records.tax')}</span>
                <span>TZS {receipt.tax.toLocaleString()}</span>
              </div>
            )}
            {receipt.discount > 0 && (
              <div className="flex items-center justify-between text-sm text-secondary">
                <span>{t('records.discount')}</span>
                <span>-TZS {receipt.discount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex items-center justify-between font-bold text-lg pt-2 border-t border-outline-variant">
              <span>{t('receipt.total')}</span>
              <span>TZS {receipt.total.toLocaleString()}</span>
            </div>
            {receipt.tender > 0 && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-on-surface-variant">{t('records.tendered')}</span>
                  <span>TZS {receipt.tender.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-on-surface-variant">{t('receipt.change')}</span>
                  <span className="text-secondary font-semibold">TZS {receipt.change_due.toLocaleString()}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}