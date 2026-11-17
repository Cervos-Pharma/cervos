import { useState, useEffect } from 'react'
import { useAuth } from '../lib/hooks'
import { fetchAnalytics } from '../lib/queries'
import { AnalyticsData } from '../lib/types'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts'

const COLORS = ['#7c3aed', '#a855f7', '#c084fc', '#d8b4fe', '#e9d5ff']

export default function Analytics() {
  const { supplier } = useAuth()
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d')

  useEffect(() => {
    if (supplier) {
      loadAnalytics()
    }
  }, [supplier])

  const loadAnalytics = async () => {
    if (!supplier) return
    try {
      const data = await fetchAnalytics(supplier.id)
      setAnalytics(data)
    } catch (error) {
      console.error('Failed to load analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    if (!analytics) return
    const csv = [
      ['Metric', 'Value'],
      ['Total Quotes', analytics.totalQuotes],
      ['Total Orders', analytics.totalOrders],
      ['Total Revenue', analytics.totalRevenue],
      ['Average Order Value', analytics.averageOrderValue],
      [''],
      ['Month', 'Revenue'],
      ...analytics.revenueByMonth.map((r) => [r.month, r.revenue]),
    ]
      .map((row) => row.join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analytics-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-primary-400">Loading analytics...</div>
      </div>
    )
  }

  const orderStatusData = analytics
    ? Object.entries(analytics.ordersByStatus).map(([name, value]) => ({ name, value }))
    : []

  const quoteStatusData = analytics
    ? Object.entries(analytics.quotesByStatus).map(([name, value]) => ({ name, value }))
    : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">Analytics</h2>
          <p className="text-gray-400 mt-1">Track your business performance</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-accent text-white'
                    : 'bg-surface-100 text-gray-400 hover:bg-surface-200'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-surface-100 border border-surface-300 rounded-lg text-white hover:bg-surface-200 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface-100 rounded-xl border border-surface-300 p-6">
          <p className="text-sm text-gray-400">Total Quotes</p>
          <p className="text-3xl font-bold text-white mt-2">{analytics?.totalQuotes || 0}</p>
        </div>
        <div className="bg-surface-100 rounded-xl border border-surface-300 p-6">
          <p className="text-sm text-gray-400">Total Orders</p>
          <p className="text-3xl font-bold text-white mt-2">{analytics?.totalOrders || 0}</p>
        </div>
        <div className="bg-surface-100 rounded-xl border border-surface-300 p-6">
          <p className="text-sm text-gray-400">Total Revenue</p>
          <p className="text-3xl font-bold text-white mt-2">
            ${((analytics?.totalRevenue || 0) / 1000).toFixed(1)}k
          </p>
        </div>
        <div className="bg-surface-100 rounded-xl border border-surface-300 p-6">
          <p className="text-sm text-gray-400">Avg Order Value</p>
          <p className="text-3xl font-bold text-white mt-2">
            ${(analytics?.averageOrderValue || 0).toFixed(0)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-100 rounded-xl border border-surface-300 p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Revenue Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics?.revenueByMonth || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#242430" />
                <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#12121a',
                    border: '1px solid #242430',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#fff' }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  dot={{ fill: '#7c3aed' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface-100 rounded-xl border border-surface-300 p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Orders by Status</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={orderStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {orderStatusData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#12121a',
                    border: '1px solid #242430',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-4 mt-4 justify-center">
            {orderStatusData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                ></span>
                <span className="text-sm text-gray-400 capitalize">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface-100 rounded-xl border border-surface-300 p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Quotes by Status</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={quoteStatusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#242430" />
                <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#12121a',
                    border: '1px solid #242430',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="value" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface-100 rounded-xl border border-surface-300 p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Top Products</h3>
          {analytics?.topProducts && analytics.topProducts.length > 0 ? (
            <div className="space-y-4">
              {analytics.topProducts.map((product, index) => (
                <div key={product.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-gray-600">{index + 1}</span>
                    <span className="text-white">{product.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-medium">TZS {product.revenue.toLocaleString()}</p>
                    <p className="text-sm text-gray-400">{product.quantity} sold</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No product data available</p>
          )}
        </div>
      </div>
    </div>
  )
}
