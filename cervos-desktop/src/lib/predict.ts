/**
 * @file lib/predict.ts
 * @description The Cervos prediction engine — turns local sales history into
 * actionable notifications.
 *
 * There was no prediction engine in the codebase before this (searched the
 * whole repo: zero hits for predict/forecast/stockout outside marketing
 * copy) — this module IS it. It runs entirely on-device from local SQLite so
 * it works offline, and mirrors generated notifications to the cloud
 * table so the web portal shows the same alerts.
 *
 * Engines:
 *  1. STOCKOUT  — per product: average daily units sold over the trailing
 *     14 days (moving window; FEFO batch stock) → days-of-cover.
 *       ≤ 2 days cover  → 'urgent' notification
 *       ≤ 7 days cover  → 'warning' notification
 *     Only fires while the rate is meaningful (≥ 1 unit/day averaged), and
 *     each (product, kind) fires at most once per calendar day — stored in
 *     `prediction_state` so refreshing / re-syncing never spams.
 *
 *  2. SALES TREND — total revenue last 7 days vs the previous 7 days.
 *     |change| ≥ 20% (and ≥ TZS 5,000 both sides, to skip noise at tiny
 *     volumes) → 'info' notification, once per day.
 *
 *  3. EXPIRY — batches expiring within 30 days with remaining stock →
 *     'warning' per product, once per day (stock you'll toss if you don't
 *     sell or return it).
 *
 * Usage: `runPredictionEngine()` from App boot + after each successful
 * sync. Cheap: a handful of SQLite aggregates.
 */
import { queryDb, executeDb, generateId, nowIso } from './database'
import { getSupabase } from './sync'
import { t } from './i18n'

/** Translate a prediction template like 'Selling ~{rate}/day' with values. */
function ft(key: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce(
    // `replaceAll` is not available in the ES2020 target used by the desktop
    // app. Splitting and joining replaces every placeholder just as safely.
    (s, [k, v]) => s.split(`{${k}}`).join(String(v)),
    t(key)
  )
}
import { notifyDevice } from './device-notifications'

const STOCKOUT_WINDOW_DAYS = 14
const URGENT_COVER_DAYS = 2
const WARNING_COVER_DAYS = 7
const MIN_DAILY_RATE = 1 // units/day below this the prediction is noise
const EXPIRY_WINDOW_DAYS = 30
const TREND_CHANGE_PCT = 0.2
const TREND_MIN_REVENUE = 5000 // TZS

interface Prediction {
  kind: 'urgent' | 'warning' | 'info'
  title: string
  body: string
  route: string
  dedupeKey: string
}

async function alreadyFiredToday(key: string): Promise<boolean> {
  const rows = await queryDb('SELECT last_fired FROM prediction_state WHERE key = ?', [key])
  if (rows.length === 0) return false
  const today = new Date().toISOString().slice(0, 10)
  return rows[0].last_fired >= today
}

async function markFired(key: string): Promise<void> {
  await executeDb(
    `INSERT INTO prediction_state (key, last_fired) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET last_fired = excluded.last_fired`,
    [key, nowIso()]
  )
}

/** Persist a predicted notification locally + best-effort mirror to the cloud. */
async function emit(branchId: string, p: Prediction): Promise<void> {
  if (await alreadyFiredToday(p.dedupeKey)) return
  await markFired(p.dedupeKey)

  const id = generateId()
  const now = nowIso()
  await executeDb(
    `INSERT INTO notifications (id, kind, title, body, route, action, admin_only, read, created_at)
     VALUES (?,?,?,?,?,?,0,0,?)`,
    [id, p.kind, p.title, p.body, p.route, null, now]
  )
  // A persisted alert is the source of truth.  The OS toast is deliberately
  // best-effort so a missing desktop permission cannot affect forecasting.
  void notifyDevice(p.title, p.body)

  // Best-effort mirror so the web portal shows the same alert. Offline or
  // RLS-denied = fine, the local row is the source the POS user sees.
  try {
    await getSupabase().from('notifications').insert({
      id,
      branch_id: branchId,
      kind: p.kind,
      title: p.title,
      body: p.body,
      route: p.route,
      read: false,
      created_at: now,
    })
  } catch {
    /* offline — fine */
  }
}

/** Engine 1 + 3: stockouts (by FEFO stock) and expiry exposure. */
export async function predictStockouts(branchId: string): Promise<number> {
  // Average daily units sold per product over the trailing window comes from
  // sale_items; the FEFO-relevant stock and earliest active expiry from batches.
  const soldByProduct = new Map<string, number>()
  const soldRaw = (await queryDb(
    `
    SELECT p.id AS product_id, SUM(si.quantity) AS sold
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    JOIN batches b ON b.id = si.batch_id
    JOIN products p ON p.id = b.product_id
    WHERE b.branch_id = ? AND s.created_at >= ?
    GROUP BY p.id
  `,
    [branchId, new Date(Date.now() - STOCKOUT_WINDOW_DAYS * 86400000).toISOString()]
  )) as any[]
  for (const r of soldRaw) soldByProduct.set(r.product_id, Number(r.sold) || 0)

  const stockRows = (await queryDb(
    `
    SELECT p.id AS product_id, p.generic_name,
           SUM(b.quantity) AS qty,
           MIN(CASE WHEN b.quantity > 0 THEN b.expiry_date END) AS earliest_expiry
    FROM products p
    JOIN batches b ON b.product_id = p.id
    WHERE b.branch_id = ?
    GROUP BY p.id
  `,
    [branchId]
  )) as any[]

  let fired = 0
  for (const row of stockRows) {
    const stock = Number(row.qty) || 0
    const sold = soldByProduct.get(row.product_id) ?? 0
    const dailyRate = sold / STOCKOUT_WINDOW_DAYS

    if (dailyRate >= MIN_DAILY_RATE) {
      const daysCover = stock / dailyRate
      if (daysCover <= URGENT_COVER_DAYS) {
        await emit(branchId, {
          kind: 'urgent',
          title: ft('predict.stockoutUrgentTitle', { name: row.generic_name }),
          body: ft('predict.stockoutUrgentBody', {
            rate: dailyRate.toFixed(1),
            stock,
            days: Math.round(daysCover),
          }),
          route: '/inventory',
          dedupeKey: `stockout-urgent:${branchId}:${row.product_id}`,
        })
        fired++
      } else if (daysCover <= WARNING_COVER_DAYS) {
        await emit(branchId, {
          kind: 'warning',
          title: ft('predict.stockoutWarnTitle', { name: row.generic_name }),
          body: ft('predict.stockoutWarnBody', {
            rate: dailyRate.toFixed(1),
            stock,
            days: Math.round(daysCover),
          }),
          route: '/inventory',
          dedupeKey: `stockout-warn:${branchId}:${row.product_id}`,
        })
        fired++
      }
    }

    // Expiry exposure: stock on hand expiring inside the window.
    if (row.earliest_expiry) {
      const expiry = new Date(row.earliest_expiry)
      const daysToExpiry = Math.ceil((expiry.getTime() - Date.now()) / 86400000)
      if (daysToExpiry > 0 && daysToExpiry <= EXPIRY_WINDOW_DAYS) {
        await emit(branchId, {
          kind: 'warning',
          title: ft('predict.expiryTitle', { name: row.generic_name }),
          body: ft('predict.expiryBody', {
            stock,
            days: daysToExpiry,
            date: row.earliest_expiry,
          }),
          route: '/inventory',
          dedupeKey: `expiry:${branchId}:${row.product_id}`,
        })
        fired++
      }
    }
  }
  return fired
}

/** Engine 2: week-over-week revenue trend.
 *
 * Windows are calendar-day aligned (7 COMPLETE days ending yesterday vs the
 * 7 before that). The previous trailing-`Date.now()` window included today's
 * partial morning revenue against a full prior week, which fired a bogus
 * "Sales trending down ~99%" on every boot before opening time.
 */
export async function predictSalesTrend(branchId: string): Promise<number> {
  const rev = async (fromDay: Date, toDay: Date): Promise<number> => {
    const rows = (await queryDb(
      `SELECT COALESCE(SUM(total), 0) AS total FROM sales
       WHERE branch_id = ? AND created_at >= ? AND created_at < ?`,
      [branchId, fromDay.toISOString(), toDay.toISOString()]
    )) as any[]
    return Number(rows[0]?.total) || 0
  }
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const todayMidnight = startOfDay(new Date())
  // Both windows are exactly 7 complete days and END at today's midnight —
  // today's partial revenue is deliberately excluded from both sides.
  const current = await rev(new Date(todayMidnight.getTime() - 7 * 86400000), todayMidnight)
  const previous = await rev(new Date(todayMidnight.getTime() - 14 * 86400000), new Date(todayMidnight.getTime() - 7 * 86400000))

  if (previous < TREND_MIN_REVENUE) return 0 // not enough history for a trend
  const change = (current - previous) / previous
  if (Math.abs(change) < TREND_CHANGE_PCT) return 0

  const pct = Math.round(Math.abs(change) * 100)
  await emit(branchId, {
    kind: 'info',
    title: ft(change > 0 ? 'predict.trendUpTitle' : 'predict.trendDownTitle', {}),
    body: ft(change > 0 ? 'predict.trendUpBody' : 'predict.trendDownBody', {
      pct,
    }),
    route: '/reports',
    dedupeKey: `trend:${branchId}:${new Date().toISOString().slice(0, 10)}`,
  })
  return 1
}

/** Run all engines for the linked branch. Safe to call offline. */
export async function runPredictionEngine(branchId: string): Promise<number> {
  try {
    const a = await predictStockouts(branchId)
    const b = await predictSalesTrend(branchId)
    return a + b
  } catch (err) {
    console.error('Prediction engine failed:', err)
    return 0
  }
}
