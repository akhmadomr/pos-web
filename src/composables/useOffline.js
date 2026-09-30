import { onMounted, onUnmounted } from 'vue'
import { useOfflineStore } from '@/stores/offline.store'

export function useOffline() {
  const offlineStore = useOfflineStore()

  const handleOnline = async () => {
    // Jika sedang dalam mode online dan koneksi kembali, sinkronkan pesanan pending
    if (!offlineStore.isOffline) {
      await offlineStore.syncPendingOrders()
    }
  }

  onMounted(async () => {
    if (!offlineStore.hydrated) {
      await offlineStore.hydrate()
    }

    window.addEventListener('online', handleOnline)

    if (navigator.onLine && !offlineStore.isOffline) {
      await offlineStore.syncPendingOrders()
    }
  })

  onUnmounted(() => {
    window.removeEventListener('online', handleOnline)
  })
}
