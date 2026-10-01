import { defineStore } from 'pinia'
import { ref } from 'vue'
import { idbGet, idbSet } from '@/utils/indexeddb'

const STORAGE_KEY = 'offline-state'

export const useOfflineStore = defineStore('offline', () => {
  const isOffline = ref(false)
  const pendingOrders = ref([])
  const hydrated = ref(false)

  async function persist() {
    // Gunakan JSON.parse(JSON.stringify(...)) agar Vue Proxy ter-serialize
    // ke plain object sebelum masuk ke IndexedDB (structured clone tidak support Proxy)
    await idbSet(STORAGE_KEY, JSON.parse(JSON.stringify({
      isOffline: isOffline.value,
      pendingOrders: pendingOrders.value,
    })))
  }

  async function hydrate() {
    try {
      const saved = await idbGet(STORAGE_KEY)
      if (saved) {
        pendingOrders.value = saved.pendingOrders ?? []
        if (typeof saved.isOffline === 'boolean') {
          isOffline.value = saved.isOffline
        }
      }
    } finally {
      hydrated.value = true
    }
  }

  async function setOffline(value) {
    isOffline.value = value
    await persist()
    if (!value) {
      // Saat beralih ke Online secara manual, jalankan sinkronisasi antrian
      try {
        const { processQueue } = await import('@/services/SyncService')
        await processQueue()
      } catch (e) {
        console.warn('Gagal memproses antrian saat beralih ke online:', e)
      }
    }
  }

  async function toggleOffline() {
    await setOffline(!isOffline.value)
  }

  async function addPendingOrder(order) {
    pendingOrders.value.push({
      id: order.id ?? crypto.randomUUID(),
      payload: order.payload,
      created_at: order.created_at ?? new Date().toISOString(),
    })
    await persist()
  }

  async function removePendingOrder(id) {
    pendingOrders.value = pendingOrders.value.filter((item) => item.id !== id)
    await persist()
  }

  async function syncPendingOrders() {
    if (isOffline.value || pendingOrders.value.length === 0) {
      return { synced: 0, failed: 0 }
    }

    const { createOrder } = await import('@/api/orders')
    let synced = 0
    let failed = 0

    for (const pending of [...pendingOrders.value]) {
      try {
        await createOrder(pending.payload)
        await removePendingOrder(pending.id)
        synced += 1
      } catch (error) {
        failed += 1
        if (!error.response) {
          // Koneksi terputus saat sync, hentikan sisa antrian (jangan ubah mode manual)
          break
        }
      }
    }

    return { synced, failed }
  }

  return {
    isOffline,
    pendingOrders,
    hydrated,
    hydrate,
    setOffline,
    toggleOffline,
    addPendingOrder,
    removePendingOrder,
    syncPendingOrders,
  }
})
