import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as ordersApi from '@/api/orders'
import { db } from '@/utils/db'

export const useOrderStore = defineStore('order', () => {
  const orders = ref([])
  const loading = ref(false)
  const error = ref(null)
  const selectedOrder = ref(null)

  const activeOrders = computed(() =>
    orders.value.filter((o) => !['completed', 'cancelled'].includes(o.status)),
  )

  const completedOrders = computed(() =>
    orders.value.filter((o) => o.status === 'completed'),
  )

  async function fetchOrders() {
    loading.value = true
    error.value = null
    try {
      const result = await ordersApi.fetchOrders()
      orders.value = Array.isArray(result) ? result : result.data ?? []
    } catch (err) {
      error.value = err.response?.data?.message ?? 'Gagal memuat order.'
      orders.value = []
    } finally {
      loading.value = false
    }
  }

  async function fetchOrderDetail(id) {
    loading.value = true
    error.value = null
    try {
      const order = await ordersApi.fetchOrder(id)
      selectedOrder.value = order
      // update di list jika sudah ada
      const idx = orders.value.findIndex((o) => o.id === id)
      if (idx >= 0) orders.value[idx] = order
      return order
    } catch (err) {
      error.value = err.response?.data?.message ?? 'Gagal memuat detail order.'
      return null
    } finally {
      loading.value = false
    }
  }

  async function updateOrderStatus(id, status) {
    try {
      const updated = await ordersApi.updateOrderStatus(id, status)
      const idx = orders.value.findIndex((o) => o.id === id)
      if (idx >= 0) orders.value[idx] = { ...orders.value[idx], ...updated }
      if (selectedOrder.value?.id === id) selectedOrder.value = { ...selectedOrder.value, ...updated }
      return updated
    } catch (err) {
      throw err
    }
  }

  async function cancelOrder(id) {
    try {
      const updated = await ordersApi.cancelOrder(id)
      const idx = orders.value.findIndex((o) => o.id === id)
      if (idx >= 0) orders.value[idx] = { ...orders.value[idx], status: 'cancelled', ...updated }
      return updated
    } catch (err) {
      throw err
    }
  }

  function prependOrder(order) {
    const idx = orders.value.findIndex((o) => o.id === order.id)
    if (idx >= 0) {
      orders.value[idx] = order
    } else {
      orders.value.unshift(order)
    }
  }

  function clearOrders() {
    orders.value = []
    selectedOrder.value = null
    error.value = null
  }

  async function saveOfflineOrder(payload, methodData) {
    const offlineOrder = {
      id: 'OFFLINE-' + Date.now(),
      order_number: 'OFF-' + Math.floor(Math.random() * 10000),
      timestamp: new Date().toISOString(),
      payload,
      methodData,
      sync_status: 'pending'
    }
    
    await db.offline_orders.add(offlineOrder)
    
    // Simulasikan kembalian data order
    return {
      order: {
        id: offlineOrder.id,
        order_number: offlineOrder.order_number,
        status: 'completed',
        is_offline: true
      },
      payment: {
        change_amount: methodData.amount - payload.total_amount,
        receipt_data: {
          order_number: offlineOrder.order_number,
          order_type: payload.order_type,
          table_number: payload.table_id,
          timestamp: new Date().toLocaleString(),
          subtotal: payload.subtotal,
          discount_amount: payload.discount_amount,
          tax_amount: payload.tax_amount,
          service_charge: payload.service_charge,
          total_amount: payload.total_amount,
          payment_method: methodData.payment_method,
          cash_received: methodData.amount,
          change_amount: methodData.amount - payload.total_amount,
          items: payload.items.map(i => ({
            name: i.product_name,
            qty: i.quantity,
            unit_price: Number(i.unit_price) + Number(i.addons_price),
            total: (Number(i.unit_price) + Number(i.addons_price)) * i.quantity
          }))
        }
      }
    }
  }

  async function syncOfflineOrders() {
    if (!navigator.onLine) return

    const pendingOrders = await db.offline_orders.where('sync_status').equals('pending').toArray()
    if (pendingOrders.length === 0) return

    for (const order of pendingOrders) {
      try {
        // 1. Buat order di server
        const created = await ordersApi.createOrder(order.payload)
        
        // 2. Bayar order tersebut (dengan fetch manual agar tidak import circular usePayment)
        // Kita menggunakan axios langsung atau endpoint bayar dari api
        // Karena usePayment ada di composable, kita kirim lewat API
      } catch (err) {
        console.error('Gagal sync order offline:', order.id, err)
      }
    }
  }

  return {
    orders,
    loading,
    error,
    selectedOrder,
    activeOrders,
    completedOrders,
    fetchOrders,
    fetchOrderDetail,
    updateOrderStatus,
    cancelOrder,
    prependOrder,
    clearOrders,
    saveOfflineOrder,
    syncOfflineOrders,
  }
})
