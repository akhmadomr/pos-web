import { onMounted, onUnmounted } from 'vue'
import { useOfflineStore } from '@/stores/offline.store'

export function useOffline() {
  const offlineStore = useOfflineStore()

  const handleOnline = async () => {
    await offlineStore.setOffline(false)
    await offlineStore.syncPendingOrders()
  }

  const handleOffline = async () => {
    await offlineStore.setOffline(true)
  }

  onMounted(async () => {
    if (!offlineStore.hydrated) {
      await offlineStore.hydrate()
    }

    await offlineStore.setOffline(!navigator.onLine)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    if (navigator.onLine) {
      await offlineStore.syncPendingOrders()
    }
  })

  onUnmounted(() => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  })
}
