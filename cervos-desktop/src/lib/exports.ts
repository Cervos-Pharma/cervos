/**
 * @file lib/exports.ts
 * @description Offline-first export engine for the POS.
 *
 * Receipts can be exported individually or as a bundle (multi-select) →
 * PNG image(s) or PDF. Reports export as CSV or a real multi-page PDF that
 * includes a rule-based narrative ("analysis"), time-sensitive graphs
 * (period revenue time series drawn as a line chart), data snapshots
 * (summary tables) and an event list (recent sales / audit events).
 *
 * Everything is generated client-side from the local SQLite mirror so it
 * works fully offline. PDFs via jsPDF; PNGs drawn manually onto a canvas
 * (no html2canvas: receipts are plain text layout, canvas is crisper and
 * dependency-free).
 */
import { jsPDF } from 'jspdf'
import { queryDb } from './database'
import { APP_NAME } from './branding'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ReceiptLike {
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

export interface ReceiptMeta {
  pharmacyName?: string
  branchName?: string
  address?: string
  phone?: string
}

/** What a Reports page period analysis is built from. */
export interface ReportContext {
  branchName: string
  centreName?: string
  dateFrom: string
  dateTo: string
  sales: {
    totalRevenue: number
    totalSales: number
    avgTransaction: number
    totalTax: number
    totalDiscount: number
    chartData: { label: string; revenue: number; sales: number }[]
  }
  inventory: {
    totalProducts: number
    totalBatches: number
    totalStockValue: number
    outOfStock: number
    stockDetails: {
      productName: string
      brandName?: string
      category?: string
      quantity: number
      costPrice: number
      salePrice: number
      totalCostValue: number
      expiryDate?: string | null
    }[]
  }
  expiry: { expired: number; expiring7days: number; expiring30days: number; expiring90days: number }
}

// ── Small helpers ────────────────────────────────────────────────────────────

const TZS = (n: number) => `TZS ${Math.round(n).toLocaleString('en-US')}`

function explodeBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

function downloadSavingPrompt(filename: string): void {
  console.debug('export:', filename)
}

export function saveBlob(blob: Blob, filename: string): void {
  downloadSavingPrompt(filename)
  explodeBlob(blob, filename)
}

function sanitizeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

// ── Receipt rendering (canvas → thermal-receipt look) ───────────────────────

const RECEIPT_W_PTS = 384 // 80mm thermal head @ ~120dpi
const R_PT = 1.6 // device scale factor for crispness

interface Line {
  text: string
  align?: 'left' | 'center' | 'right'
  bold?: boolean
  meta?: string
  amount?: string
}

function receiptLines(r: ReceiptLike, m: ReceiptMeta): Line[] {
  const L: Line[] = []
  const push = (l: Line) => L.push(l)

  push({ text: (m.pharmacyName || 'Cervos Pharmacy').toUpperCase(), align: 'center', bold: true })
  if (m.branchName) push({ text: m.branchName, align: 'center' })
  if (m.address) push({ text: m.address, align: 'center' })
  if (m.phone) push({ text: m.phone, align: 'center' })
  push({ text: APP_NAME, align: 'center' })

  const d = new Date(r.created_at)
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  push({ text: '' })
  push({ text: r.receipt_number, meta: 'No.' })
  push({ text: stamp, meta: 'Date' })
  push({ text: r.operator_name || '—', meta: 'Operator' })
  push({ text: (r.payment_method || 'N/A').replace('_', ' ').toUpperCase(), meta: 'Paid via' })
  push({ text: '' })
  push({ text: '- ITEMS -', align: 'center' })
  for (const it of r.items) {
    push({ text: it.product_name.slice(0, 30), amount: `${it.quantity} x ${it.unit_price.toLocaleString('en-US')}` })
  }
  push({ text: '' })
  const subtotal = Math.max(0, r.total - r.tax)
  push({ text: subtotal.toLocaleString('en-US'), meta: 'Subtotal' })
  if (r.tax > 0) push({ text: r.tax.toLocaleString('en-US'), meta: 'Tax' })
  if (r.discount > 0) push({ text: `- ${r.discount.toLocaleString('en-US')}`, meta: 'Discount' })
  push({ text: r.total.toLocaleString('en-US'), meta: 'TOTAL', bold: true })
  if (r.tender > 0) {
    push({ text: r.tender.toLocaleString('en-US'), meta: 'Tendered' })
    push({ text: r.change_due.toLocaleString('en-US'), meta: 'Change' })
  }
  push({ text: '' })
  push({ text: 'Karibu tena — Thank you!', align: 'center' })
  push({ text: 'Powered by Cervos', align: 'center' })
  return L
}

/** Draws a receipt onto a fresh canvas and returns it. */
function drawReceipt(r: ReceiptLike, m: ReceiptMeta): HTMLCanvasElement {
  const lines = receiptLines(r, m)
  const fontSize = 12 * R_PT
  const lineH = fontSize * 1.42
  const padX = 10 * R_PT

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  ctx.font = `${fontSize}px monospace`
  const width = RECEIPT_W_PTS * R_PT
  let y = 20 * R_PT

  for (const l of lines) {
    if (l.meta && l.amount !== undefined) continue
    y += l.text === '' ? lineH * 0.6 : lineH
  }

  canvas.width = width
  canvas.height = Math.ceil(y + 24 * R_PT)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.font = `${fontSize}px monospace`
  ctx.fillStyle = '#111111'
  y = 20 * R_PT

  const drawRow = (left: string, right: string, bold = false) => {
    if (bold) ctx.font = `bold ${fontSize}px monospace`
    const rightW = ctx.measureText(right).width
    ctx.textAlign = 'left'
    ctx.fillText(left, padX, y)
    ctx.fillText(right, width - padX - rightW, y)
    if (bold) ctx.font = `${fontSize}px monospace`
  }

  for (const l of lines) {
    if (l.text === '') {
      y += lineH * 0.6
      continue
    }
    if (l.meta && l.amount === undefined && l.align !== 'center') {
      const text = l.text.length > 34 ? l.text.slice(0, 34) : l.text
      drawRow(l.meta + ': ', text, l.bold)
      y += lineH
      continue
    }
    ctx.font = (l.bold ? `bold ${fontSize}` : `${fontSize}`) + 'px monospace'
    const w = ctx.measureText(l.text).width
    const x = l.align === 'center' ? (width - w) / 2 : l.align === 'right' ? width - padX - w : padX
    ctx.textAlign = 'left'
    ctx.fillText(l.text, x, y)
    y += lineH
    ctx.font = `${fontSize}px monospace`
  }

  return canvas
}

// ── Receipt exports ──────────────────────────────────────────────────────────

/** One receipt → PNG blob. */
export function receiptToPngBlob(r: ReceiptLike, m: ReceiptMeta = {}): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = drawReceipt(r, m)
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png')
    } catch (e) {
      reject(e)
    }
  })
}

export async function exportReceiptPng(r: ReceiptLike, m: ReceiptMeta = {}): Promise<void> {
  const blob = await receiptToPngBlob(r, m)
  saveBlob(blob, `receipt-${sanitizeFilename(r.receipt_number)}.png`)
}

/** One receipt → single-page PDF. */
export async function exportReceiptPdf(r: ReceiptLike, m: ReceiptMeta = {}): Promise<void> {
  const canvas = drawReceipt(r, m)
  // Page sized to the receipt aspect, 80 mm wide thermal format.
  const hMm = Math.ceil(canvas.height / (canvas.width / 80) / R_PT) + 10
  const pdf = new jsPDF({ unit: 'mm', format: [80, hMm] })
  const imgH = (canvas.height / R_PT) * 0.2645833
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 5, 80, imgH)
  saveBlob(pdf.output('blob'), `receipt-${sanitizeFilename(r.receipt_number)}.pdf`)
}

/**
 * Bundle N receipts. PDF = one receipt per page. PNG = all receipts stacked
 * vertically into one long image (thermal-journal style).
 */
export async function exportReceiptBundle(
  receipts: ReceiptLike[],
  format: 'png' | 'pdf',
  m: ReceiptMeta = {}
): Promise<void> {
  if (receipts.length === 0) return
  if (receipts.length === 1) {
    return format === 'pdf' ? exportReceiptPdf(receipts[0], m) : exportReceiptPng(receipts[0], m)
  }

  // Pre-render the receipt canvases.
  const canvases = receipts.map((r) => drawReceipt(r, m))
  const sep = 16 * R_PT

  if (format === 'pdf') {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
    for (let idx = 0; idx < canvases.length; idx++) {
      if (idx > 0) pdf.addPage()
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const c = canvases[idx]
      const w = Math.min(110, pageW - 40)
      const h = (c.height / c.width) * w
      // Fit: scale down so the full receipt fits one page.
      const scale = Math.min(1, (pageH - 40) / h)
      pdf.addImage(c.toDataURL('image/png'), 'PNG', (pageW - w * scale) / 2, 20, w * scale, h * scale)
    }
    saveBlob(
      pdf.output('blob'),
      `receipts-bundle-${receipts.length}-${new Date().toISOString().slice(0, 10)}.pdf`
    )
    return
  }

  // PNG bundle: stack canvases.
  const width = Math.max(...canvases.map((c) => c.width))
  const height = canvases.reduce((s, c) => s + c.height + sep, 0) - sep
  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  const ctx = out.getContext('2d')!
  ctx.fillStyle = '#e5e7eb'
  ctx.fillRect(0, 0, width, height)
  let y = 0
  for (const c of canvases) {
    ctx.drawImage(c, (width - c.width) / 2, y)
    y += c.height + sep
  }
  await new Promise<void>((resolve, reject) =>
    out.toBlob((b) => (b ? (saveBlob(b, `receipts-bundle-${receipts.length}-${new Date().toISOString().slice(0, 10)}.png`), resolve()) : reject(new Error('PNG encode failed'))), 'image/png')
  )
}

// ── Rule-based narrative engine ──────────────────────────────────────────────

export interface Finding {
  severity: 'critical' | 'warn' | 'info' | 'good'
  title: string
  body: string
}

/**
 * Rule-based analyst: turns the period report into plain-language findings.
 * Pure heuristics — no network, no LLM. Each rule is explicit so the
 * narrative is auditable.
 */
export function analyseReport(ctx: ReportContext): Finding[] {
  const f: Finding[] = []
  const s = ctx.sales

  // Revenue trend across the period's daily series.
  if (s.chartData.length >= 4) {
    const half = Math.floor(s.chartData.length / 2)
    const first = s.chartData.slice(0, half).reduce((a, d) => a + d.revenue, 0)
    const second = s.chartData.slice(half).reduce((a, d) => a + d.revenue, 0)
    if (first > 0) {
      const delta = (second - first) / first
      const pct = Math.round(Math.abs(delta) * 100)
      if (delta >= 0.2) f.push({ severity: 'good', title: 'Momentum building', body: `Revenue in the second half of the period is up ${pct}% on the first half (${TZS(second)} vs ${TZS(first)}). Consider stocking up fast movers before the trend peaks.` })
      else if (delta <= -0.2) f.push({ severity: 'warn', title: 'Demand cooling off', body: `Second-half revenue fell ${pct}% vs the first half (${TZS(second)} vs ${TZS(first)}). Check stockouts of top sellers and footfall — discounts may be masking a wider slide.` })
      else f.push({ severity: 'info', title: 'Steady trading', body: `Revenue is stable across the period (half-on-half change ${pct}%).` })
    }
  }

  // Average basket.
  if (s.totalSales > 0) {
    f.push({ severity: 'info', title: 'Basket size', body: `${s.totalSales} transactions averaged ${TZS(s.avgTransaction)}.` })
    const ex = ctx.expiry
    if (ex.expired > 0) f.push({ severity: 'critical', title: 'Expired stock on shelves', body: `${ex.expired} batch(es) already expired. Quarantine and write them off — selling expired medicine is a regulatory offence. Void remaining stock against the batch.` })
    if (ex.expiring7days > 0) f.push({ severity: 'warn', title: 'Expiry inside 7 days', body: `${ex.expiring7days} batch(es) expire within 7 days. Push promotions now or arrange a supplier return today; after 7 days the value is lost.` })
    else if (ex.expiring30days > 0) f.push({ severity: 'info', title: 'Expiry watchlist', body: `${ex.expiring30days} batch(es) expire within 30 days — schedule them into first-shift selling (FEFO).` })
  }

  // Stockout risk: sell fast vs on-hand? Cost-basis proxy (software sees local qty only).
  const details = ctx.inventory.stockDetails
  const sorted = [...details].sort((a, b) => b.totalCostValue - a.totalCostValue).slice(0, 3)
  if (ctx.inventory.outOfStock > 0) {
    f.push({ severity: 'critical', title: 'Stockout exposure', body: `${ctx.inventory.outOfStock} product(s) sit at zero stock. Every zero-stock day on a moving product is lost revenue — reorder priority: the items customers ask for by name.` })
  }
  if (sorted.length > 0) {
    f.push({ severity: 'info', title: 'Capital concentration', body: `Top 3 lines by cost value (${sorted.map((d) => d.productName).join(', ')}) hold ${TZS(sorted.reduce((a, d) => a + d.totalCostValue, 0))} — ${( (sorted.reduce((a, d) => a + d.totalCostValue, 0) / Math.max(1, ctx.inventory.totalStockValue)) * 100).toFixed(0)}% of stock value. Ensure these are moving, not dead capital.` })
  }
  if (s.totalDiscount > s.totalRevenue * 0.1 && s.totalRevenue > 0) {
    f.push({ severity: 'warn', title: 'Discount leakage', body: `Discounts consumed ${Math.round((s.totalDiscount / s.totalRevenue) * 100)}% of gross revenue above the 10% guardrail. Audit operator-applied discounts for the period.` })
  }
  if (f.length === 0) f.push({ severity: 'good', title: 'Clean sheet', body: 'No exceptions triggered for this period.' })
  return f
}

// ── Report CSV ───────────────────────────────────────────────────────────────

export function buildReportCsv(ctx: ReportContext): string {
  const q = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const rows: string[] = []
  const find = analyseReport(ctx)

  rows.push(`Cervos Branch Report,${q(ctx.branchName)},${q(ctx.dateFrom)},${q(ctx.dateTo)}`)
  rows.push('')
  rows.push('SECTION,' + 'KEY,VALUE,CURRENCY')
  rows.push(['SALES SUMMARY', 'Total revenue', ctx.sales.totalRevenue, 'TZS'].map(q).join(','))
  rows.push(['SALES SUMMARY', 'Transactions', ctx.sales.totalSales, ''].map(q).join(','))
  rows.push(['SALES SUMMARY', 'Average transaction', ctx.sales.avgTransaction, 'TZS'].map(q).join(','))
  rows.push(['SALES SUMMARY', 'Tax', ctx.sales.totalTax, 'TZS'].map(q).join(','))
  rows.push(['SALES SUMMARY', 'Discounts', ctx.sales.totalDiscount, 'TZS'].map(q).join(','))
  rows.push(['INVENTORY', 'Products', ctx.inventory.totalProducts, ''].map(q).join(','))
  rows.push(['INVENTORY', 'Batches', ctx.inventory.totalBatches, ''].map(q).join(','))
  rows.push(['INVENTORY', 'Stock value (cost)', ctx.inventory.totalStockValue, 'TZS'].map(q).join(','))
  rows.push(['INVENTORY', 'Out of stock products', ctx.inventory.outOfStock, ''].map(q).join(','))
  rows.push(['EXPIRY', 'Expired', ctx.expiry.expired, 'batches'].map(q).join(','))
  rows.push(['EXPIRY', 'Expiring 7 days', ctx.expiry.expiring7days, 'batches'].map(q).join(','))
  rows.push(['EXPIRY', 'Expiring 30 days', ctx.expiry.expiring30days, 'batches'].map(q).join(','))
  rows.push(['EXPIRY', 'Expiring 90 days', ctx.expiry.expiring90days, 'batches'].map(q).join(','))
  rows.push('')
  rows.push('ANALYSIS,FINDING,DETAIL')
  find.forEach((x) => rows.push(['ANALYSIS', x.title, x.body].map(q).join(',')))
  rows.push('')
  rows.push('DAILY SERIES,DATE,REVENUE (TZS),TRANSACTIONS')
  ctx.sales.chartData.forEach((d) => rows.push(['DAILY', d.label, Math.round(d.revenue), d.sales].map(q).join(',')))
  rows.push('')
  rows.push('STOCK,PRODUCT,BRAND,CATEGORY,QTY,COST PRICE,SALE PRICE,TOTAL COST VALUE,EXPIRY')
  ctx.inventory.stockDetails.forEach((x) =>
    rows.push(['STOCK', x.productName, x.brandName || '', x.category || '', x.quantity, x.costPrice, x.salePrice, x.totalCostValue, x.expiryDate || ''].map(q).join(','))
  )
  return rows.join('\n') + '\n'
}

export function exportReportCsv(ctx: ReportContext): void {
  saveBlob(new Blob([buildReportCsv(ctx)], { type: 'text/csv;charset=utf-8' }),
    `branch-report-${ctx.branchName.replace(/\s+/g, '-')}-${ctx.dateFrom}-to-${ctx.dateTo}.csv`)
}

// ── Report PDF ───────────────────────────────────────────────────────────────

const A4W: number = 210
const A4H: number = 297
const M = 16 // mm margins

function heading(doc: jsPDF, text: string, y: number, size = 15, bold = true): number {
  doc.setFont('helvetica', bold ? 'bold' : 'normal')
  doc.setFontSize(size)
  const lines = doc.splitTextToSize(text, A4W - M * 2)
  doc.text(lines, M, y)
  return y + lines.length * size * 0.5 + 3
}

function body(doc: jsPDF, text: string, y: number, size = 9.5): number {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(size)
  const lines = doc.splitTextToSize(text, A4W - M * 2)
  if (y + lines.length * (size * 0.45) > A4H - M) {
    doc.addPage()
    y = M + 6
  }
  doc.text(lines, M, y)
  return y + lines.length * (size * 0.45) + 2.4
}

/** Draws a simple revenue line chart over the period directly with PDF text+lines. */
function drawTrendChart(doc: jsPDF, series: { label: string; revenue: number }[], y0: number): number {
  const cw = A4W - M * 2
  const ch = 52
  if (y0 + ch + 10 > A4H - M) {
    doc.addPage()
    y0 = M + 6
  }
  y0 = heading(doc, 'Revenue by day', y0, 11.5)
  const max = Math.max(1, ...series.map((d) => d.revenue))
  const x0 = M + 12
  const gw = cw - 12
  // axes
  doc.setDrawColor(160)
  doc.line(x0, y0, x0 + gw, y0) // x axis
  doc.line(x0, y0 - ch, x0, y0)
  doc.setFontSize(6.6)
  doc.setTextColor(90)
  const ticks = 4
  for (let i = 1; i <= ticks; i++) {
    const v = (max / ticks) * i
    const yy = y0 - ch * (v / max)
    doc.setDrawColor(220)
    doc.setLineDashPattern([0.7, 0.9], 0)
    doc.line(x0, yy, x0 + gw, yy)
    doc.setLineDashPattern([], 0)
    doc.text(`${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : Math.round(v)}`, M + 1, yy + 1)
  }
  // series line
  if (series.length > 1) {
    doc.setDrawColor(79, 70, 229)
    doc.setLineWidth(0.6)
    for (let i = 1; i < series.length; i++) {
      const xA = x0 + (gw * (i - 1)) / (series.length - 1)
      const xB = x0 + (gw * i) / (series.length - 1)
      const yA = y0 - ch * (series[i - 1].revenue / max)
      const yB = y0 - ch * (series[i].revenue / max)
      doc.line(xA, yA, xB, yB)
    }
    doc.setFillColor(79, 70, 229)
    series.forEach((d, i) => {
      const x = x0 + (gw * i) / (series.length - 1)
      const y = y0 - ch * (d.revenue / max)
      doc.circle(x, y, 0.7, 'F')
    })
    doc.setTextColor(60)
    const step = Math.ceil(series.length / 10)
    series.forEach((d, i) => {
      if (i % step === 0 || i === series.length - 1) {
        const x = x0 + (gw * i) / (series.length - 1)
        doc.text(String(d.label).slice(0, 5), x, y0 + 4)
      }
    })
  } else {
    doc.setTextColor(120)
    doc.text('Not enough points to chart', M + 16, y0 - ch / 2)
  }
  doc.setTextColor(0)
  doc.setLineWidth(0.2)
  return y0 + 8
}

function snapshotTable(doc: jsPDF, y0: number, rows: [string, string][]): number {
  doc.setFontSize(9)
  rows.forEach(([k, v], i) => {
    if (y0 + 5 > A4H - M) {
      doc.addPage()
      y0 = M + 6
    }
    if (i % 2 === 0) {
      doc.setFillColor(243, 244, 246)
      doc.rect(M, y0 - 3.4, A4W - M * 2, 5.2, 'F')
    }
    doc.setFont('helvetica', 'bold')
    doc.text(k, M + 2, y0)
    doc.setFont('helvetica', 'normal')
    doc.text(v, A4W - M - 2, y0, { align: 'right' })
    y0 += 5.2
  })
  return y0 + 3
}

/**
 * Full analysis PDF: cover section → rule-based narrative → time-series
 * chart → data snapshots (sales, inventory, expiry) → stock detail table →
 * event list (period sales from the local mirror).
 */
export async function exportReportPdf(ctx: ReportContext): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const find = analyseReport(ctx)
  const genAt = new Date().toISOString().replace('T', ' ').slice(0, 19)

  // ── Cover / header
  doc.setFillColor(79, 70, 229)
  doc.rect(0, 0, A4W, 30, 'F')
  doc.setTextColor(255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.text('Cervos Branch Report', M, 13)
  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'normal')
  doc.text(`${ctx.branchName}${ctx.centreName ? ` • ${ctx.centreName}` : ''}`, M, 19.5)
  doc.text(`Period ${ctx.dateFrom} → ${ctx.dateTo}   |   Generated ${genAt}   |   ${APP_NAME}`, M, 25)
  doc.setTextColor(0)

  let y = 40
  y = heading(doc, 'Analysis (rule-based)', y, 13)
  const SEV_COLOR: Record<string, [number, number, number]> = {
    critical: [190, 18, 60],
    warn: [180, 83, 9],
    info: [55, 65, 81],
    good: [5, 122, 85],
  }
  for (const f of find) {
    doc.setFillColor(...SEV_COLOR[f.severity])
    doc.circle(M + 1.2, y - 1.2, 1.2, 'F')
    y = heading(doc, f.title, y, 10.5)
    y = body(doc, f.body, y, 9)
    y += 1.5
  }

  y = drawTrendChart(doc, ctx.sales.chartData, y + 4)

  // ── Data snapshots
  y = heading(doc, 'Data snapshot', y, 13)
  y = heading(doc, 'Sales', y, 10.5)
  y = snapshotTable(doc, y, [
    ['Total revenue', TZS(ctx.sales.totalRevenue)],
    ['Transactions', String(ctx.sales.totalSales)],
    ['Average transaction', TZS(ctx.sales.avgTransaction)],
    ['Tax collected', TZS(ctx.sales.totalTax)],
    ['Discounts given', TZS(ctx.sales.totalDiscount)],
  ])
  y = heading(doc, 'Inventory', y, 10.5)
  y = snapshotTable(doc, y, [
    ['Products / batches', `${ctx.inventory.totalProducts} / ${ctx.inventory.totalBatches}`],
    ['Stock value (cost)', TZS(ctx.inventory.totalStockValue)],
    ['Out of stock products', String(ctx.inventory.outOfStock)],
  ])
  y = heading(doc, 'Expiry exposure', y, 10.5)
  y = snapshotTable(doc, y, [
    ['Expired', String(ctx.expiry.expired)],
    ['Within 7 days', String(ctx.expiry.expiring7days)],
    ['Within 30 days', String(ctx.expiry.expiring30days)],
    ['Within 90 days', String(ctx.expiry.expiring90days)],
  ])

  // ── Event list: period sales transactions from local mirror
  try {
    const since = `${ctx.dateFrom}T00:00:00.000Z`
    const untilEx = new Date(new Date(`${ctx.dateTo}T23:59:59.999Z`).getTime()).toISOString()
    const events = (await queryDb(
      `SELECT s.id, s.created_at, s.total, s.payment_method, COALESCE(o.name,'—') AS operator
       FROM sales s LEFT JOIN operators o ON o.id = s.operator_id
       WHERE s.created_at >= ? AND s.created_at <= ?
       ORDER BY s.created_at DESC LIMIT 40`,
      [since, untilEx]
    )) as any[]
    if (events.length > 0) {
      if (y + 20 > A4H - M) { doc.addPage(); y = M + 8 }
      y = heading(doc, `Event list — ${events.length} most recent transaction(s) in period`, y, 13)
      y = heading(doc, `Date · operator · payment · amount`, y, 8.5, false)
      for (const ev of events) {
        if (y + 5 > A4H - M) { doc.addPage(); y = M + 8 }
        doc.setFontSize(8.2)
        doc.setFont('helvetica', 'normal')
        const d = new Date(ev.created_at)
        const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
        const pay = (ev.payment_method || 'n/a').replace('_', ' ')
        doc.text(`${stamp}  ·  ${String(ev.operator).slice(0, 18)}  ·  ${pay.padEnd(14)}  ·  ${TZS(Number(ev.total))}`, M, y)
        y += 4.6
      }
    }
  } catch {
    /* local db unavailable — skip events page */
  }

  doc.setFontSize(7.5)
  doc.setTextColor(120)
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.text(`${APP_NAME} · branch report · page ${p}/${pages}`, A4W - M, A4H - 8, { align: 'right' })
  }

  saveBlob(doc.output('blob'), `branch-report-${ctx.branchName.replace(/\s+/g, '-')}-${ctx.dateFrom}-to-${ctx.dateTo}.pdf`)
}
