import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as ordersApi from '@/api/orders'

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
  }
})
