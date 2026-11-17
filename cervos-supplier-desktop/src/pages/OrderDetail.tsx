import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchOrder, updateOrderStatus } from '../lib/queries'
import { Order } from '../lib/types'
import { formatDistanceToNow } from 'date-fns'
import { showToast } from '../components/ToastContainer'

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      loadOrder()
    }
  }, [id])

  const loadOrder = async () => {
    if (!id) return
    try {
      const data = await fetchOrder(id)
      setOrder(data)
    } catch (error) {
      console.error('Failed to load order:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (newStatus: Order['status']) => {
    if (!id || !order) return
    try {
      const updated = await updateOrderStatus(id, newStatus)
      setOrder({ ...order, status: updated.status })
      showToast('success', 'Order status updated')
    } catch (error) {
      showToast('error', 'Failed to update order status')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-primary-400">Loading...</div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Order not found</p>
        <button onClick={() => navigate('/orders')} className="mt-4 text-accent hover:text-accent2">
          Back to Orders
        </button>
      </div>
    )
  }

  const statusColors: Record<Order['status'], string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    confirmed: 'bg-blue-500/20 text-blue-400',
    processing: 'bg-purple-500/20 text-purple-400',
    shipped: 'bg-indigo-500/20 text-indigo-400',
    delivered: 'bg-green-500/20 text-green-400',
    cancelled: 'bg-red-500/20 text-red-400',
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/orders')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back to Orders
        </button>
        <span className={`px-4 py-2 rounded-full text-sm font-medium capitalize ${statusColors[order.status]}`}>
          {order.status}
        </span>
      </div>

      <div className="bg-surface-100 rounded-xl border border-surface-300 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-white">{order.order_number}</h2>
            <p className="text-sm text-gray-400 mt-1">
              {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
            </p>
          </div>
          <select
            value={order.status}
            onChange={(e) => handleStatusChange(e.target.value as Order['status'])}
            className={`px-4 py-2 rounded-lg text-sm font-medium border-0 focus:ring-2 focus:ring-accent ${statusColors[order.status]}`}
          >
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-sm text-gray-400 mb-1">Customer</p>
            <p className="text-white font-medium">{order.buyer_name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-1">Shipping Address</p>
            <p className="text-white">{order.shipping_address}</p>
          </div>
          {order.tracking_number && (
            <div>
              <p className="text-sm text-gray-400 mb-1">Tracking Number</p>
              <p className="text-white font-mono text-sm">{order.tracking_number}</p>
            </div>
          )}
        </div>

        <div className="border-t border-surface-300 pt-6">
          <h3 className="font-medium text-white mb-4">Order Items</h3>
          <div className="space-y-3">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-3 border-b border-surface-300 last:border-0">
                <div>
                  <p className="text-white">{item.product_name}</p>
                  <p className="text-sm text-gray-400">Qty: {item.quantity} Ã— ${item.unit_price.toFixed(2)}</p>
                </div>
                <p className="text-white font-medium">TZS {item.total.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-surface-300 mt-6 pt-6 space-y-2">
          <div className="flex justify-between text-gray-400">
            <span>Subtotal</span>
            <span>TZS {order.subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-gray-400">
            <span>Shipping</span>
            <span>TZS {order.shipping_cost.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-gray-400">
            <span>Tax</span>
            <span>TZS {order.tax.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-white font-semibold text-lg pt-2">
            <span>Total</span>
            <span>TZS {order.total.toLocaleString()}</span>
          </div>
        </div>

        {order.notes && (
          <div className="mt-6 p-4 bg-surface rounded-lg">
            <p className="text-sm text-gray-400 mb-1">Notes</p>
            <p className="text-white">{order.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}
