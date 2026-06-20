import { defineStore } from 'pinia'
import { ref } from 'vue'
import { idbGet, idbSet } from '@/utils/indexeddb'

const STORAGE_KEY = 'offline-state'

export const useOfflineStore = defineStore('offline', () => {
  const isOffline = ref(!navigator.onLine)
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
        if (typeof saved.isOffline === 'boolean' && navigator.onLine) {
          isOffline.value = saved.isOffline
        }
      }
    } finally {
      if (!navigator.onLine) {
        isOffline.value = true
      }
      hydrated.value = true
    }
  }

  async function setOffline(value) {
    isOffline.value = value
    await persist()
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
        if (!error.response) {
          await setOffline(true)
          break
        }
        failed += 1
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
    addPendingOrder,
    removePendingOrder,
    syncPendingOrders,
  }
})
