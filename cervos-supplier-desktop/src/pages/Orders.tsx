import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/hooks'
import { fetchOrders, updateOrderStatus } from '../lib/queries'
import { Order } from '../lib/types'
import { formatDistanceToNow } from 'date-fns'
import { showToast } from '../components/ToastContainer'

export default function Orders() {
  const { supplier } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    if (supplier) {
      loadOrders()
    }
  }, [supplier])

  const loadOrders = async () => {
    if (!supplier) return
    try {
      const data = await fetchOrders(supplier.id)
      setOrders(data)
    } catch (error) {
      console.error('Failed to load orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (orderId: string, newStatus: Order['status']) => {
    try {
      await updateOrderStatus(orderId, newStatus)
      setOrders(orders.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)))
      showToast('success', 'Order status updated')
    } catch (error) {
      showToast('error', 'Failed to update order status')
    }
  }

  const filteredOrders = statusFilter === 'all' ? orders : orders.filter((o) => o.status === statusFilter)

  const statusColors: Record<Order['status'], string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    confirmed: 'bg-blue-500/20 text-blue-400',
    processing: 'bg-purple-500/20 text-purple-400',
    shipped: 'bg-indigo-500/20 text-indigo-400',
    delivered: 'bg-green-500/20 text-green-400',
    cancelled: 'bg-red-500/20 text-red-400',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-primary-400">Loading orders...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">Orders</h2>
          <p className="text-gray-400 mt-1">{orders.length} total orders</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['all', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map(
          (status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                statusFilter === status
                  ? 'bg-accent text-white'
                  : 'bg-surface-100 text-gray-400 hover:bg-surface-200'
              }`}
            >
              {status}
            </button>
          )
        )}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="bg-surface-100 rounded-xl border border-surface-300 p-12 text-center">
          <span className="material-symbols-outlined text-6xl text-gray-600">shopping_cart</span>
          <h3 className="text-xl font-semibold text-white mt-4">No orders found</h3>
          <p className="text-gray-400 mt-2">
            {statusFilter === 'all' ? "You haven't received any orders yet" : `No ${statusFilter} orders`}
          </p>
        </div>
      ) : (
        <div className="bg-surface-100 rounded-xl border border-surface-300 overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Order
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-300">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-surface-200 transition-colors">
                  <td className="px-6 py-4">
                    <Link
                      to={`/orders/${order.id}`}
                      className="font-medium text-white hover:text-accent transition-colors"
                    >
                      {order.order_number}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-gray-400">{order.buyer_name}</td>
                  <td className="px-6 py-4 text-gray-400">
                    {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={order.status}
                      onChange={(e) => handleStatusChange(order.id, e.target.value as Order['status'])}
                      className={`px-3 py-1 rounded-full text-xs font-medium border-0 focus:ring-2 focus:ring-accent ${statusColors[order.status]}`}
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="processing">Processing</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-white font-medium">TZS {order.total.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      to={`/orders/${order.id}`}
                      className="p-2 text-gray-400 hover:text-white transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">visibility</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
