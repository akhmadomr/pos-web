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
      const serverOrders = Array.isArray(result) ? result : result.data ?? []
      
      // Cache ke IndexedDB untuk offline
      try {
        const plain = JSON.parse(JSON.stringify(serverOrders))
        await db.offline_orders.bulkPut(plain.map(o => ({
          id: o.id,
          order_number: o.order_number,
          payload: o,
          methodData: { payment_method: o.payment_method, amount: o.total_amount },
          sync_status: 'synced',
          created_at: o.created_at,
        })))
      } catch { /* silent */ }
      
      // Ambil transaksi offline lokal yang belum tersinkronisasi
      let pendingOrders = []
      try {
        const localOrders = await db.offline_orders.toArray()
        pendingOrders = localOrders
          .filter(o => o.sync_status !== 'synced' && o.sync_status !== 'cancelled')
          .map(o => ({
            ...(o.payload ?? {}),
            id: o.id,
            order_number: o.order_number ?? o.payload?.order_number,
            status: o.payload?.status ?? 'completed',
            total_amount: o.methodData?.amount ?? o.payload?.total_amount ?? 0,
            payment_method: o.methodData?.payment_method ?? o.payload?.payment_method,
            created_at: o.created_at ?? o.payload?.created_at,
            is_offline: true,
            order_items: o.payload?.order_items ?? o.payload?.items?.map(i => ({
              product_name: i.name ?? i.product_name,
              quantity: i.qty ?? i.quantity,
              unit_price: i.unit_price,
              total_price: i.total ?? i.total_price,
            })) ?? [],
          }))
      } catch { /* silent */ }

      // Gabungkan data pending offline ke paling atas
      orders.value = [...pendingOrders.reverse(), ...serverOrders]
    } catch (err) {
      const isNetworkError = !navigator.onLine ||
        err?.message === 'Network Error' ||
        err?.name === 'TypeError'

      if (isNetworkError) {
        // Offline: baca dari IndexedDB, gabungkan server cache + pending
        try {
          const localOrders = await db.offline_orders.toArray()
          orders.value = localOrders.map(o => ({
            // Jika ini dari cache server, ambil payload langsung
            ...(o.payload ?? {}),
            id: o.id,
            order_number: o.order_number ?? o.payload?.order_number,
            status: o.payload?.status ?? 'completed',
            total_amount: o.methodData?.amount ?? o.payload?.total_amount ?? 0,
            payment_method: o.methodData?.payment_method ?? o.payload?.payment_method,
            created_at: o.created_at ?? o.payload?.created_at,
            is_offline: o.sync_status !== 'synced',
            order_items: o.payload?.order_items ?? o.payload?.items?.map(i => ({
              product_name: i.name ?? i.product_name,
              quantity: i.qty ?? i.quantity,
              unit_price: i.unit_price,
              total_price: i.total ?? i.total_price,
            })) ?? [],
          })).reverse()
          error.value = null
        } catch {
          orders.value = []
          error.value = 'Gagal memuat riwayat pesanan.'
        }
        return
      }

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

  async function saveOfflineOrder(payload, methodData, orderTotal = 0, cartItems = []) {
    const offlineOrder = {
      order_number: 'OFF-' + Math.floor(Math.random() * 10000),
      timestamp: new Date().toISOString(),
      payload,
      methodData,
      sync_status: 'pending'
    }
    
    // Gunakan JSON.parse(JSON.stringify()) untuk menghilangkan Vue Proxy (mencegah DataCloneError)
    const rawOfflineOrder = JSON.parse(JSON.stringify(offlineOrder))
    const generatedId = await db.offline_orders.add(rawOfflineOrder)
    
    // Simulasikan kembalian data order
    return {
      order: {
        id: generatedId,
        order_number: offlineOrder.order_number,
        status: 'completed',
        is_offline: true
      },
      payment: {
        change_amount: methodData.amount - orderTotal,
        receipt_data: {
          order_number: offlineOrder.order_number,
          order_type: payload.order_type,
          table_number: payload.table_id,
          timestamp: new Date().toLocaleString(),
          subtotal: orderTotal,
          discount_amount: 0,
          tax_amount: 0,
          service_charge: 0,
          total_amount: orderTotal,
          payment_method: methodData.payment_method,
          cash_received: methodData.amount,
          change_amount: methodData.amount - orderTotal,
          items: cartItems.map(i => ({
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
