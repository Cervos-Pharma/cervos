import { useState, useEffect } from 'react'
import { queryDb, executeDb, generateId, nowIso } from '../lib/database'
import { runSyncCycle, queueForSync } from '../lib/sync'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

export interface StockDetailItem {
  id: string
  productName: string
  brandName: string
  category: string
  batchNumber: string | null
  quantity: number
  costPrice: number
  salePrice: number
  totalCostValue: number
  totalSaleValue: number
  expiryDate: string | null
}

interface ExpenseRow {
  id: string
  category: string
  description: string | null
  amount: number
  expense_date: string
}

interface ReportData {
  sales: {
    totalRevenue: number
    totalSales: number
    avgTransaction: number
    totalTax: number
    totalDiscount: number
    byPaymentMethod: { name: string; value: number }[]
    chartData: { label: string; revenue: number; sales: number }[]
  }
  finance: {
    revenue: number
    cogs: number
    grossProfit: number
    expenses: number
    expensesByCategory: { name: string; value: number }[]
    expenseRows: ExpenseRow[]
    netProfit: number
    margin: number
  }
  inventory: {
    totalProducts: number
    totalBatches: number
    totalStockValue: number
    lowStockItems: { name: string; stock: number }[]
    outOfStock: number
    stockDetails: StockDetailItem[]
  }
  products: {
    topByRevenue: { name: string; revenue: number }[]
    topByQuantity: { name: string; quantity: number }[]
  }
  expiry: {
    expired: number
    expiring7days: number
    expiring30days: number
    expiring90days: number
    expiringList: { name: string; batchId: string; expiry: string; stock: number; daysLeft: number }[]
  }
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981']

export default function Reports() {
  const [data, setData] = useState<ReportData | null>(null)
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10))
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'sales' | 'finance' | 'inventory' | 'products' | 'expiry'>('sales')
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expenseCategory, setExpenseCategory] = useState('rent')
  const [expenseDesc, setExpenseDesc] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [expenseSaving, setExpenseSaving] = useState(false)
  const [expenseFeedback, setExpenseFeedback] = useState<string | null>(null)
  const [stockSearch, setStockSearch] = useState('')
  const [branchInfo, setBranchInfo] = useState<{ branchName: string; centreName: string; lastSyncedAt: string | null }>({
    branchName: '',
    centreName: '',
    lastSyncedAt: null,
  })
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [dateFrom, dateTo])

  async function loadData() {
    setIsLoading(true)
    try {
      const [sales, batches, products, expenseRows, branchRes, centreRes, syncRes] = await Promise.all([
        queryDb(
          `SELECT s.*, si.quantity, si.unit_price, p.generic_name, b.cost_price AS item_cost_price FROM sales s
           LEFT JOIN sale_items si ON si.sale_id = s.id
           LEFT JOIN batches b ON b.id = si.batch_id
           LEFT JOIN products p ON p.id = b.product_id
           WHERE s.created_at >= ? AND s.created_at <= ?
           ORDER BY s.created_at DESC`,
          [`${dateFrom}T00:00:00`, `${dateTo}T23:59:59`]
        ),
        queryDb('SELECT * FROM batches'),
        queryDb('SELECT * FROM products'),
        queryDb(
          `SELECT id, category, description, amount, expense_date FROM expenses
           WHERE expense_date >= ? AND expense_date <= ?
           ORDER BY expense_date DESC, created_at DESC`,
          [dateFrom, dateTo]
        ),
        queryDb("SELECT value FROM app_settings WHERE key = 'branch_name'"),
        queryDb("SELECT value FROM app_settings WHERE key = 'centre_name'"),
        queryDb("SELECT value FROM app_settings WHERE key = 'last_synced_at'"),
      ])

      const bName = branchRes.length > 0 ? JSON.parse(branchRes[0].value) : 'This Branch'
      const cName = centreRes.length > 0 ? JSON.parse(centreRes[0].value) : 'Main Pharmacy'
      const sAt = syncRes.length > 0 ? JSON.parse(syncRes[0].value) : null
      setBranchInfo({ branchName: bName, centreName: cName, lastSyncedAt: sAt })

      const totalRevenue = sales.reduce((sum: number, s: any) => sum + (s.total || 0), 0)
      const totalSales = sales.length
      const avgTransaction = totalSales > 0 ? totalRevenue / totalSales : 0
      const totalTax = sales.reduce((sum: number, s: any) => sum + (s.tax || 0), 0)
      const totalDiscount = sales.reduce((sum: number, s: any) => sum + (s.discount || 0), 0)

      // ── Finance (profit & loss) ─────────────────────────────────────
      // COGS: what the sold units cost the branch, from each sold batch's
      // cost price. Falls back to the product's default cost when a sold
      // batch row is missing (e.g. legacy data).
      const totalCogs = sales.reduce((sum: number, s: any) => {
        if (s.item_cost_price != null) return sum + (s.item_cost_price || 0) * (s.quantity || 0)
        // Batch row missing (legacy data): fall back to the product's default
        // cost via batch_id -> batch -> product.
        const batch = batches.find((b: any) => b.id === s.batch_id)
        const product = batch ? products.find((p: any) => p.id === batch.product_id) : null
        return sum + (product?.default_cost_price || 0) * (s.quantity || 0)
      }, 0)
      const totalExpenses = expenseRows.reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
      const expenseCategoryMap = new Map<string, number>()
      for (const e of expenseRows) {
        const cat = (e.category || 'other').toLowerCase()
        expenseCategoryMap.set(cat, (expenseCategoryMap.get(cat) || 0) + (e.amount || 0))
      }
      const expensesByCategory = Array.from(expenseCategoryMap.entries())
        .map(([name, value]) => ({ name: name.toUpperCase(), value }))
        .sort((a, b) => b.value - a.value)
      const grossProfit = totalRevenue - totalCogs
      const netProfit = grossProfit - totalExpenses
      const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

      const paymentMap = new Map<string, number>()
      for (const s of sales) {
        const method = s.payment_method || 'unknown'
        paymentMap.set(method, (paymentMap.get(method) || 0) + (s.total || 0))
      }
      const byPaymentMethod = Array.from(paymentMap.entries()).map(([name, value]) => ({
        name: name.replace('_', ' ').toUpperCase(),
        value,
      }))

      const dayMap = new Map<string, { revenue: number; sales: number }>()
      for (const s of sales) {
        const day = s.created_at?.slice(0, 10) || ''
        const existing = dayMap.get(day) || { revenue: 0, sales: 0 }
        existing.revenue += s.total || 0
        existing.sales += 1
        dayMap.set(day, existing)
      }
      const chartData = Array.from(dayMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([day, vals]) => ({
          label: day.slice(5),
          revenue: vals.revenue,
          sales: vals.sales,
        }))

      const productRevenueMap = new Map<string, number>()
      const productQuantityMap = new Map<string, number>()
      for (const s of sales) {
        if (s.generic_name) {
          productRevenueMap.set(
            s.generic_name,
            (productRevenueMap.get(s.generic_name) || 0) + (s.unit_price || 0) * (s.quantity || 0)
          )
          productQuantityMap.set(
            s.generic_name,
            (productQuantityMap.get(s.generic_name) || 0) + (s.quantity || 0)
          )
        }
      }
      const topByRevenue = Array.from(productRevenueMap.entries())
        .map(([name, revenue]) => ({ name, revenue }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
      const topByQuantity = Array.from(productQuantityMap.entries())
        .map(([name, quantity]) => ({ name, quantity }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10)

      const stockMap = new Map<string, number>()
      for (const b of batches) {
        stockMap.set(b.product_id, (stockMap.get(b.product_id) || 0) + (b.quantity || 0))
      }
      const totalStockValue = batches.reduce(
        (sum: number, b: any) => sum + (b.cost_price || 0) * (b.quantity || 0),
        0
      )
      const lowStockItems = Array.from(stockMap.entries())
        .filter(([_, qty]) => qty > 0 && qty <= 10)
        .map(([pid, stock]) => {
          const prod = products.find((p: any) => p.id === pid)
          return { name: prod?.generic_name || 'Unknown', stock }
        })
        .slice(0, 10)
      const outOfStock = Array.from(stockMap.entries()).filter(([_, qty]) => qty <= 0).length

      // Comprehensive stock details list
      const stockDetails: StockDetailItem[] = batches.map((b: any) => {
        const prod = products.find((p: any) => p.id === b.product_id)
        const quantity = b.quantity || 0
        const costPrice = b.cost_price || 0
        const salePrice = b.sale_price || 0
        return {
          id: b.id,
          productName: prod?.generic_name || 'Unknown Product',
          brandName: prod?.brand_name || '',
          category: prod?.category || 'General',
          batchNumber: b.batch_number || b.id.slice(0, 8),
          quantity,
          costPrice,
          salePrice,
          totalCostValue: quantity * costPrice,
          totalSaleValue: quantity * salePrice,
          expiryDate: b.expiry_date || null,
        }
      })

      const now = Date.now()
      const expiringList: { name: string; batchId: string; expiry: string; stock: number; daysLeft: number }[] = []
      let expired = 0,
        expiring7days = 0,
        expiring30days = 0,
        expiring90days = 0

      for (const b of batches) {
        if (!b.expiry_date) continue
        const expiryDate = new Date(b.expiry_date).getTime()
        const daysLeft = Math.ceil((expiryDate - now) / 86400000)
        const prod = products.find((p: any) => p.id === b.product_id)

        if (daysLeft < 0) expired++
        else if (daysLeft <= 7) {
          expiring7days++
          expiringList.push({
            name: prod?.generic_name || 'Unknown',
            batchId: b.id,
            expiry: b.expiry_date,
            stock: b.quantity || 0,
            daysLeft,
          })
        } else if (daysLeft <= 30) expiring30days++
        else if (daysLeft <= 90) expiring90days++
      }

      expiringList.sort((a, b) => a.daysLeft - b.daysLeft)

      setData({
        sales: { totalRevenue, totalSales, avgTransaction, totalTax, totalDiscount, byPaymentMethod, chartData },
        inventory: {
          totalProducts: products.length,
          totalBatches: batches.length,
          totalStockValue,
          lowStockItems,
          outOfStock,
          stockDetails,
        },
        products: { topByRevenue, topByQuantity },
        expiry: { expired, expiring7days, expiring30days, expiring90days, expiringList },
        finance: {
          revenue: totalRevenue,
          cogs: totalCogs,
          grossProfit,
          expenses: totalExpenses,
          expensesByCategory,
          expenseRows: expenseRows as ExpenseRow[],
          netProfit,
          margin,
        },
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function saveExpense() {
    const amount = parseFloat(expenseAmount)
    if (!amount || amount <= 0) {
      setExpenseFeedback('Enter an amount greater than zero.')
      return
    }
    setExpenseSaving(true)
    setExpenseFeedback(null)
    try {
      const id = generateId()
      const branchRes = await queryDb("SELECT value FROM app_settings WHERE key = 'branch_id'")
      const branchId = branchRes.length > 0 ? JSON.parse(branchRes[0].value) : null
      await executeDb(
        `INSERT INTO expenses (id, branch_id, category, description, amount, expense_date, created_at, synced) VALUES (?,?,?,?,?,?,?,0)`,
        [id, branchId, expenseCategory, expenseDesc.trim() || null, amount, expenseDate, nowIso()]
      )
      // Queue for sync to the pharmacy portal — best effort; the row is
      // already durable in the local DB.
      try {
        await queueForSync('expenses', id, 'INSERT', {
          id,
          branch_id: branchId,
          category: expenseCategory,
          description: expenseDesc.trim() || null,
          amount,
          expense_date: expenseDate,
        })
      } catch {
        // sync queue unavailable (offline) — local row is authoritative
      }
      setExpenseDesc('')
      setExpenseAmount('')
      setExpenseFeedback('Expense saved.')
      setShowExpenseForm(false)
      loadData()
    } catch (err) {
      console.error('saveExpense failed:', err)
      setExpenseFeedback('Could not save the expense. Try again.')
    } finally {
      setExpenseSaving(false)
    }
  }

  async function deleteExpense(id: string) {
    try {
      await executeDb('DELETE FROM expenses WHERE id = ?', [id])
      try {
        await queueForSync('expenses', id, 'DELETE', { id })
      } catch {
        // offline — deletion is still durable locally
      }
      loadData()
    } catch (err) {
      console.error('deleteExpense failed:', err)
    }
  }

  async function handleSync() {
    setIsSyncing(true)
    setSyncFeedback(null)
    try {
      const res = await runSyncCycle()
      if (res.ok) {
        setSyncFeedback('Successfully synced branch data to main pharmacy.')
      } else {
        setSyncFeedback(`Sync completed with status: ${res.message || 'Updated'}`)
      }
      await loadData()
    } catch (e: any) {
      setSyncFeedback(e?.message || 'Sync failed. Terminal is operating offline.')
    } finally {
      setIsSyncing(false)
      setTimeout(() => setSyncFeedback(null), 5000)
    }
  }

  function exportCSV() {
    if (!data) return
    const lines = [`Branch Report: ${branchInfo.branchName} (${branchInfo.centreName})`, `Period: ${dateFrom} to ${dateTo}`, '']
    lines.push('=== SALES SUMMARY ===')
    lines.push(`Total Revenue,TZS ${data.sales.totalRevenue.toLocaleString()}`)
    lines.push(`Total Transactions,${data.sales.totalSales}`)
    lines.push(`Average Transaction,TZS ${data.sales.avgTransaction.toLocaleString()}`)
    lines.push(`Tax,TZS ${data.sales.totalTax.toLocaleString()}`)
    lines.push(`Discount,TZS ${data.sales.totalDiscount.toLocaleString()}`, '')
    lines.push('=== INVENTORY SUMMARY ===')
    lines.push(`Total Products,${data.inventory.totalProducts}`)
    lines.push(`Total Batches,${data.inventory.totalBatches}`)
    lines.push(`Stock Value,TZS ${data.inventory.totalStockValue.toLocaleString()}`)
    lines.push(`Out of Stock,${data.inventory.outOfStock}`, '')
    lines.push('=== STOCK DETAILS BREAKDOWN ===')
    lines.push('Product,Brand,Category,Batch Number,Quantity,Cost Price (TZS),Sale Price (TZS),Total Cost Value (TZS),Expiry')
    data.inventory.stockDetails.forEach((s) => {
      lines.push(
        `"${s.productName}","${s.brandName}","${s.category}","${s.batchNumber || ''}",${s.quantity},${s.costPrice},${s.salePrice},${s.totalCostValue},"${s.expiryDate || 'N/A'}"`
      )
    })
    lines.push('', '=== EXPIRY ===')
    lines.push(`Expired,${data.expiry.expired}`)
    lines.push(`Expiring within 7 days,${data.expiry.expiring7days}`)
    lines.push(`Expiring within 30 days,${data.expiry.expiring30days}`)
    lines.push(`Expiring within 90 days,${data.expiry.expiring90days}`, '')
    lines.push('Date,Revenue (TZS),Transactions')
    data.sales.chartData.forEach((d) => lines.push(`${d.label},TZS ${d.revenue.toLocaleString()},${d.sales}`))

    const csv = lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `branch-report-${dateFrom}-${dateTo}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
      </div>
    )
  }

  const filteredStock = data.inventory.stockDetails.filter((s) => {
    if (!stockSearch.trim()) return true
    const q = stockSearch.toLowerCase()
    return (
      s.productName.toLowerCase().includes(q) ||
      s.brandName.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      (s.batchNumber && s.batchNumber.toLowerCase().includes(q))
    )
  })

  return (
    <div className="p-6 flex flex-col gap-5">
      {/* Branch & Main Pharmacy Connection Banner */}
      <div className="bg-surface-base border border-outline-variant rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined">hub</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-on-surface text-base">{branchInfo.branchName || 'Current Branch'}</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/15 text-secondary font-semibold">
                Connected
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              Main Pharmacy: <span className="font-medium text-on-surface">{branchInfo.centreName || 'Pharmacy Network'}</span>
              {branchInfo.lastSyncedAt ? (
                <> • Last synced: {new Date(branchInfo.lastSyncedAt).toLocaleString()}</>
              ) : (
                <> • Never synced</>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {syncFeedback && (
            <span className="text-xs font-medium text-secondary animate-fadeIn">{syncFeedback}</span>
          )}
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-primary/40 bg-primary/5 text-primary text-sm font-semibold hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-base ${isSyncing ? 'animate-spin' : ''}`}>sync</span>
            {isSyncing ? 'Syncing to Pharmacy...' : 'Sync to Pharmacy'}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline text-2xl font-black text-on-surface">Reports & Analytics</h1>
          <p className="text-sm text-on-surface-variant">Live branch records connected to the pharmacy portal</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-lg border border-outline-variant bg-surface-base text-sm"
          />
          <span className="text-on-surface-variant text-sm">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-lg border border-outline-variant bg-surface-base text-sm"
          />
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white font-semibold hover:opacity-90"
          >
            <span className="material-symbols-outlined">download</span>
            Export CSV
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-outline-variant overflow-x-auto">
        {(['sales', 'finance', 'inventory', 'products', 'expiry'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-semibold capitalize whitespace-nowrap transition-colors ${
              activeTab === tab ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'sales' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-surface-base border border-outline-variant rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Total Revenue</p>
              <p className="font-headline text-2xl font-black text-primary mt-1">
                TZS {data.sales.totalRevenue.toLocaleString()}
              </p>
            </div>
            <div className="bg-surface-base border border-outline-variant rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Transactions</p>
              <p className="font-headline text-2xl font-black text-on-surface mt-1">{data.sales.totalSales}</p>
            </div>
            <div className="bg-surface-base border border-outline-variant rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Avg Transaction</p>
              <p className="font-headline text-2xl font-black text-on-surface mt-1">
                TZS {data.sales.avgTransaction.toLocaleString()}
              </p>
            </div>
            <div className="bg-surface-base border border-outline-variant rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Total Tax</p>
              <p className="font-headline text-2xl font-black text-on-surface mt-1">
                TZS {data.sales.totalTax.toLocaleString()}
              </p>
            </div>
            <div className="bg-surface-base border border-outline-variant rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Discounts Given</p>
              <p className="font-headline text-2xl font-black text-on-surface mt-1">
                TZS {data.sales.totalDiscount.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-surface-base border border-outline-variant rounded-xl p-5">
              <h3 className="font-headline font-bold text-on-surface mb-4">Revenue Trend</h3>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.sales.chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => [`TZS ${value.toLocaleString()}`, 'Revenue']} />
                    <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-surface-base border border-outline-variant rounded-xl p-5">
              <h3 className="font-headline font-bold text-on-surface mb-4">Payment Methods</h3>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.sales.byPaymentMethod}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {data.sales.byPaymentMethod.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`TZS ${value.toLocaleString()}`, 'Revenue']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'finance' && data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-surface-base border border-outline-variant rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Revenue</p>
              <p className="font-headline text-2xl font-black text-primary mt-1">
                TZS {data.finance.revenue.toLocaleString()}
              </p>
            </div>
            <div className="bg-surface-base border border-outline-variant rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Cost of Goods Sold</p>
              <p className="font-headline text-2xl font-black text-on-surface mt-1">
                TZS {data.finance.cogs.toLocaleString()}
              </p>
            </div>
            <div className="bg-surface-base border border-outline-variant rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Gross Profit</p>
              <p className={`font-headline text-2xl font-black mt-1 ${data.finance.grossProfit >= 0 ? 'text-secondary' : 'text-error'}`}>
                TZS {data.finance.grossProfit.toLocaleString()}
              </p>
            </div>
            <div className="bg-surface-base border border-outline-variant rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Expenditure</p>
              <p className="font-headline text-2xl font-black text-warning mt-1">
                TZS {data.finance.expenses.toLocaleString()}
              </p>
            </div>
            <div className="bg-surface-base border border-outline-variant rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                Net {data.finance.netProfit >= 0 ? 'Profit' : 'Loss'} · {data.finance.margin.toFixed(1)}% margin
              </p>
              <p className={`font-headline text-2xl font-black mt-1 ${data.finance.netProfit >= 0 ? 'text-secondary' : 'text-error'}`}>
                TZS {data.finance.netProfit.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-surface-base border border-outline-variant rounded-xl p-5">
              <h3 className="font-headline font-bold text-on-surface mb-4">Profit &amp; Loss Breakdown</h3>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={[
                      { name: 'Revenue', amount: data.finance.revenue },
                      { name: 'COGS', amount: data.finance.cogs },
                      { name: 'Gross Profit', amount: data.finance.grossProfit },
                      { name: 'Expenditure', amount: data.finance.expenses },
                      { name: 'Net', amount: data.finance.netProfit },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => [`TZS ${value.toLocaleString()}`, 'Amount']} />
                    <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                      {[0, 1, 2, 3, 4].map((i) => (
                        <Cell
                          key={`plc-${i}`}
                          fill={i === 0 ? '#6366f1' : i === 1 || i === 3 ? '#f59e0b' : data.finance.netProfit >= 0 ? '#10b981' : '#ef4444'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-surface-base border border-outline-variant rounded-xl p-5">
              <h3 className="font-headline font-bold text-on-surface mb-4">Expenditure by Category</h3>
              {data.finance.expensesByCategory.length > 0 ? (
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.finance.expensesByCategory}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {data.finance.expensesByCategory.map((_, index) => (
                          <Cell key={`exc-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`TZS ${value.toLocaleString()}`, 'Spent']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-on-surface-variant">No expenses recorded for this period.</p>
              )}
            </div>
          </div>

          {/* Expense recording */}
          <div className="bg-surface-base border border-outline-variant rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-headline font-bold text-on-surface">Branch Expenditure</h3>
              <button
                onClick={() => setShowExpenseForm((v) => !v)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                Add Expense
              </button>
            </div>

            {showExpenseForm && (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5 p-4 rounded-lg bg-surface border border-outline-variant">
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-outline-variant bg-surface-base text-sm text-on-surface"
                >
                  {['rent', 'utilities', 'salaries', 'transport', 'supplies', 'marketing', 'maintenance', 'other'].map((c) => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
                <input
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  placeholder="Description (optional)"
                  className="px-3 py-2 rounded-lg border border-outline-variant bg-surface-base text-sm text-on-surface col-span-2"
                />
                <input
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                  inputMode="decimal"
                  placeholder="Amount (TZS)"
                  className="px-3 py-2 rounded-lg border border-outline-variant bg-surface-base text-sm text-on-surface"
                />
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-outline-variant bg-surface-base text-sm text-on-surface"
                  />
                  <button
                    onClick={saveExpense}
                    disabled={expenseSaving || !expenseAmount}
                    className="px-4 py-2 rounded-lg bg-secondary text-on-secondary text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity whitespace-nowrap"
                  >
                    {expenseSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
                {expenseFeedback && (
                  <p className="col-span-2 lg:col-span-5 text-xs text-on-surface-variant">{expenseFeedback}</p>
                )}
              </div>
            )}

            {data.finance.expenseRows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-on-surface-variant border-b border-outline-variant">
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">Category</th>
                      <th className="py-2 pr-4">Description</th>
                      <th className="py-2 pr-4 text-right">Amount</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.finance.expenseRows.map((e) => (
                      <tr key={e.id} className="border-b border-outline-variant/50">
                        <td className="py-2 pr-4 whitespace-nowrap">{e.expense_date}</td>
                        <td className="py-2 pr-4 capitalize">{e.category}</td>
                        <td className="py-2 pr-4 text-on-surface-variant">{e.description || '—'}</td>
                        <td className="py-2 pr-4 text-right font-semibold">TZS {(e.amount || 0).toLocaleString()}</td>
                        <td className="py-2 text-right">
                          <button
                            onClick={() => deleteExpense(e.id)}
                            title="Delete expense"
                            className="p-1.5 rounded-md text-error hover:bg-error/10 transition-colors"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-on-surface-variant">
                No expenditure recorded in this period. Use “Add Expense” to log rent, salaries, utilities and other branch costs.
              </p>
            )}
          </div>
        </>
      )}

      {activeTab === 'inventory' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface-base border border-outline-variant rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Total Products</p>
              <p className="font-headline text-2xl font-black text-on-surface mt-1">{data.inventory.totalProducts}</p>
            </div>
            <div className="bg-surface-base border border-outline-variant rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Total Batches</p>
              <p className="font-headline text-2xl font-black text-on-surface mt-1">{data.inventory.totalBatches}</p>
            </div>
            <div className="bg-surface-base border border-outline-variant rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Stock Value</p>
              <p className="font-headline text-2xl font-black text-secondary mt-1">
                TZS {data.inventory.totalStockValue.toLocaleString()}
              </p>
            </div>
            <div className="bg-surface-base border border-outline-variant rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Out of Stock</p>
              <p className="font-headline text-2xl font-black text-error mt-1">{data.inventory.outOfStock}</p>
            </div>
          </div>

          <div className="bg-surface-base border border-outline-variant rounded-xl p-5">
            <h3 className="font-headline font-bold text-on-surface mb-3">Low Stock Alerts (≤ 10 units)</h3>
            {data.inventory.lowStockItems.length === 0 ? (
              <p className="text-sm text-on-surface-variant">All items are sufficiently stocked.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {data.inventory.lowStockItems.map((item, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-surface-container rounded-lg">
                    <span className="font-medium text-sm text-on-surface">{item.name}</span>
                    <span className="text-error text-sm font-bold">{item.stock} units left</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Full Stock Details Table */}
          <div className="bg-surface-base border border-outline-variant rounded-xl p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h3 className="font-headline font-bold text-on-surface">Branch Stock Details</h3>
                <p className="text-xs text-on-surface-variant">Synchronized batch records for this branch</p>
              </div>
              <input
                type="text"
                placeholder="Search stock by product, brand, batch..."
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-outline-variant bg-surface text-sm w-72"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-outline-variant/30 text-xs uppercase font-semibold text-on-surface-variant">
                  <tr>
                    <th className="p-3">Product Name</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Batch #</th>
                    <th className="p-3 text-right">In Stock</th>
                    <th className="p-3 text-right">Cost (TZS)</th>
                    <th className="p-3 text-right">Sale (TZS)</th>
                    <th className="p-3 text-right">Total Value</th>
                    <th className="p-3">Expiry</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40">
                  {filteredStock.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-on-surface-variant">
                        No matching stock records found.
                      </td>
                    </tr>
                  ) : (
                    filteredStock.map((s) => (
                      <tr key={s.id} className="hover:bg-outline-variant/10 transition-colors">
                        <td className="p-3">
                          <p className="font-semibold text-on-surface">{s.productName}</p>
                          {s.brandName && <p className="text-xs text-on-surface-variant">{s.brandName}</p>}
                        </td>
                        <td className="p-3 text-xs text-on-surface-variant">{s.category}</td>
                        <td className="p-3 font-mono text-xs">{s.batchNumber || '—'}</td>
                        <td className="p-3 text-right">
                          <span
                            className={`font-bold ${
                              s.quantity <= 0 ? 'text-error' : s.quantity <= 10 ? 'text-amber-500' : 'text-on-surface'
                            }`}
                          >
                            {s.quantity}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono text-xs">TZS {s.costPrice.toLocaleString()}</td>
                        <td className="p-3 text-right font-mono text-xs">TZS {s.salePrice.toLocaleString()}</td>
                        <td className="p-3 text-right font-mono text-xs font-semibold text-primary">
                          TZS {s.totalCostValue.toLocaleString()}
                        </td>
                        <td className="p-3 text-xs">
                          {s.expiryDate ? new Date(s.expiryDate).toLocaleDateString() : 'N/A'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'products' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-surface-base border border-outline-variant rounded-xl p-5">
            <h3 className="font-headline font-bold text-on-surface mb-4">Top Products by Revenue</h3>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.products.topByRevenue.slice(0, 8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip formatter={(value: number) => [`TZS ${value.toLocaleString()}`, 'Revenue']} />
                  <Bar dataKey="revenue" fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-surface-base border border-outline-variant rounded-xl p-5">
            <h3 className="font-headline font-bold text-on-surface mb-4">Top Products by Quantity Sold</h3>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.products.topByQuantity.slice(0, 8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip formatter={(value: number) => [value, 'Units Sold']} />
                  <Bar dataKey="quantity" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'expiry' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface-base border border-outline-variant rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Expired</p>
              <p className="font-headline text-2xl font-black text-error mt-1">{data.expiry.expired}</p>
            </div>
            <div className="bg-surface-base border border-outline-variant rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Expiring ≤ 7 Days</p>
              <p className="font-headline text-2xl font-black text-amber-500 mt-1">{data.expiry.expiring7days}</p>
            </div>
            <div className="bg-surface-base border border-outline-variant rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Expiring ≤ 30 Days</p>
              <p className="font-headline text-2xl font-black text-amber-400 mt-1">{data.expiry.expiring30days}</p>
            </div>
            <div className="bg-surface-base border border-outline-variant rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Expiring ≤ 90 Days</p>
              <p className="font-headline text-2xl font-black text-on-surface mt-1">{data.expiry.expiring90days}</p>
            </div>
          </div>
          <div className="bg-surface-base border border-outline-variant rounded-xl p-5">
            <h3 className="font-headline font-bold text-on-surface mb-4">Expiring Soon (Next 7 Days)</h3>
            {data.expiry.expiringList.length === 0 ? (
              <p className="text-on-surface-variant">No batches expiring soon</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase text-on-surface-variant">
                    <th className="pb-2">Product</th>
                    <th className="pb-2">Batch</th>
                    <th className="pb-2">Expiry</th>
                    <th className="pb-2 text-right">Stock</th>
                    <th className="pb-2 text-right">Days Left</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {data.expiry.expiringList.map((item) => (
                    <tr key={item.batchId}>
                      <td className="py-2 font-medium">{item.name}</td>
                      <td className="py-2 text-sm text-on-surface-variant font-mono">{item.batchId.slice(0, 8)}...</td>
                      <td className="py-2 text-sm">{new Date(item.expiry).toLocaleDateString()}</td>
                      <td className="py-2 text-right font-semibold">{item.stock}</td>
                      <td className="py-2 text-right">
                        <span
                          className={`px-2 py-1 rounded text-xs font-bold ${
                            item.daysLeft <= 3 ? 'bg-error-container text-error' : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {item.daysLeft} days
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
