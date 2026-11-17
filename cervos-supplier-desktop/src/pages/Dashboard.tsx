import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/hooks'
import { fetchAnalytics, fetchOrders, fetchQuotes, fetchPendingCommands, acknowledgeCommand, createPollingInterval } from '../lib/queries'
import { useRemoteCommandsStore } from '../lib/store'
import { AnalyticsData, Order, Quote, RemoteCommand } from '../lib/types'
import { formatDistanceToNow } from 'date-fns'

export default function Dashboard() {
  const { supplier } = useAuth()
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [recentQuotes, setRecentQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const { pendingCommands, setPendingCommands, removeCommand } = useRemoteCommandsStore()

  useEffect(() => {
    if (supplier) {
      Promise.all([
        fetchAnalytics(supplier.id),
        fetchOrders(supplier.id),
        fetchQuotes(supplier.id),
        fetchPendingCommands(supplier.id),
      ])
        .then(([analyticsData, ordersData, quotesData, commandsData]) => {
          setAnalytics(analyticsData)
          setRecentOrders(ordersData.slice(0, 5))
          setRecentQuotes(quotesData.slice(0, 5))
          setPendingCommands(commandsData)
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }, [supplier, setPendingCommands])

  useEffect(() => {
    if (!supplier) return
    const cleanup = createPollingInterval(supplier.id, () => {
      fetchPendingCommands(supplier.id).then(setPendingCommands).catch(console.error)
      fetchOrders(supplier.id).then(data => setRecentOrders(data.slice(0, 5))).catch(console.error)
    }, 30000)
    return cleanup
  }, [supplier, setPendingCommands])

  const handleAcknowledge = async (commandId: string) => {
    try {
      await acknowledgeCommand(commandId)
      removeCommand(commandId)
    } catch (error) {
      console.error('Failed to acknowledge command:', error)
    }
  }

  const getCommandIcon = (type: RemoteCommand['type']) => {
    const icons: Record<RemoteCommand['type'], string> = {
      product_update: 'inventory_2',
      price_adjustment: 'attach_money',
      order_action: 'shopping_cart',
      notification: 'notifications',
      system: 'settings',
    }
    return icons[type] || 'info'
  }

  const getCommandMessage = (command: RemoteCommand) => {
    switch (command.type) {
      case 'product_update':
        return `Product update: ${command.payload.product_name || 'Unknown product'}`
      case 'price_adjustment':
        return `Price adjustment request for ${command.payload.product_name || 'product'}`
      case 'order_action':
        return `Order action required: ${command.payload.action || 'View details'}`
      case 'notification':
        return command.payload.message || 'New notification'
      case 'system':
        return command.payload.message || 'System update'
      default:
        return 'You have a pending command'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-primary-400">Loading dashboard...</div>
      </div>
    )
  }

  const kpis = [
    {
      label: 'Total Quotes',
      value: analytics?.totalQuotes || 0,
      icon: 'request_quote',
      color: 'text-blue-400',
      bg: 'bg-blue-500/20',
    },
    {
      label: 'Total Orders',
      value: analytics?.totalOrders || 0,
      icon: 'shopping_cart',
      color: 'text-green-400',
      bg: 'bg-green-500/20',
    },
    {
      label: 'Total Revenue',
      value: `TZS ${(analytics?.totalRevenue || 0).toLocaleString()}`,
      icon: 'payments',
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/20',
    },
    {
      label: 'Avg Order Value',
      value: `TZS ${(analytics?.averageOrderValue || 0).toLocaleString()}`,
      icon: 'trending_up',
      color: 'text-purple-400',
      bg: 'bg-purple-500/20',
    },
  ]

  return (
    <div className="space-y-6">
      {pendingCommands.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-yellow-400">pending_actions</span>
            <h3 className="text-yellow-400 font-semibold">Pending Commands</h3>
          </div>
          <div className="space-y-2">
            {pendingCommands.slice(0, 3).map((command) => (
              <div
                key={command.id}
                className="flex items-center justify-between p-3 bg-surface rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-gray-400">
                    {getCommandIcon(command.type)}
                  </span>
                  <div>
                    <p className="text-white text-sm">{getCommandMessage(command)}</p>
                    <p className="text-gray-500 text-xs">
                      {formatDistanceToNow(new Date(command.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleAcknowledge(command.id)}
                  className="px-3 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded hover:bg-yellow-500/30 transition-colors"
                >
                  Acknowledge
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">
            Welcome back, {supplier?.contact_name || supplier?.company_name}
          </h2>
          <p className="text-gray-400 mt-1">Here's what's happening with your store</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              supplier?.subscription_status === 'active'
                ? 'bg-green-500/20 text-green-400'
                : supplier?.subscription_status === 'trial'
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-red-500/20 text-red-400'
            }`}
          >
            {supplier?.subscription_status || 'Unknown'}
          </span>
          <span className="text-gray-500 text-sm capitalize">{supplier?.subscription_tier}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-surface-100 rounded-xl border border-surface-300 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg ${kpi.bg}`}>
                <span className={`material-symbols-outlined ${kpi.color}`}>{kpi.icon}</span>
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{kpi.value}</p>
            <p className="text-sm text-gray-400 mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-100 rounded-xl border border-surface-300 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Recent Orders</h3>
            <Link to="/orders" className="text-sm text-accent hover:text-accent2 transition-colors">
              View all
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No orders yet</p>
          ) : (
            <div className="space-y-4">
              {recentOrders.map((order) => (
                <Link
                  key={order.id}
                  to={`/orders/${order.id}`}
                  className="flex items-center justify-between p-4 bg-surface rounded-lg hover:bg-surface-200 transition-colors"
                >
                  <div>
                    <p className="font-medium text-white">{order.order_number}</p>
                    <p className="text-sm text-gray-400">{order.buyer_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-white">TZS {order.total.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-surface-100 rounded-xl border border-surface-300 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Recent Quotes</h3>
            <Link to="/analytics" className="text-sm text-accent hover:text-accent2 transition-colors">
              View all
            </Link>
          </div>
          {recentQuotes.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No quotes yet</p>
          ) : (
            <div className="space-y-4">
              {recentQuotes.map((quote) => (
                <div
                  key={quote.id}
                  className="flex items-center justify-between p-4 bg-surface rounded-lg"
                >
                  <div>
                    <p className="font-medium text-white">{quote.quote_number}</p>
                    <p className="text-sm text-gray-400">{quote.buyer_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-white">TZS {quote.subtotal.toLocaleString()}</p>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                        quote.status === 'accepted'
                          ? 'bg-green-500/20 text-green-400'
                          : quote.status === 'sent'
                          ? 'bg-blue-500/20 text-blue-400'
                          : quote.status === 'rejected'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}
                    >
                      {quote.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
