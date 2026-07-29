<script setup>
import { onMounted, ref, provide } from 'vue'
import AppOfflineBanner from '@/components/common/AppOfflineBanner.vue'
import PwaInstallPrompt from '@/components/common/PwaInstallPrompt.vue'
import { useOffline } from '@/composables/useOffline'
import { useOfflineStore } from '@/stores/offline.store'
import { useAuthStore } from '@/stores/auth.store'
import { processQueue, getPendingCount } from '@/services/SyncService'

useOffline()

const offlineStore = useOfflineStore()
const authStore = useAuthStore()

const pendingSyncCount = ref(0)
let shiftPollInterval = null
let syncInterval = null

async function updatePendingCount() {
  pendingSyncCount.value = await getPendingCount()
}

onMounted(async () => {
  if (!offlineStore.hydrated) {
    await offlineStore.hydrate()
  }

  // Sinkronisasi saat koneksi pulih
  window.addEventListener('online', async () => {
    offlineStore.setOffline(false)
    await processQueue()
    await updatePendingCount()
  })

  // Cek status shift setiap 60 detik (cross-device sync)
  shiftPollInterval = setInterval(async () => {
    if (authStore.isAuthenticated && authStore.hasActiveShift && !offlineStore.isOffline) {
      await authStore.fetchCurrentShift()
    }
  }, 60000)

  // Coba sync antrian setiap 2 menit jika online
  syncInterval = setInterval(async () => {
    if (navigator.onLine && authStore.isAuthenticated) {
      await processQueue()
      await updatePendingCount()
    }
  }, 120000)

  // Update jumlah pending saat pertama kali
  await updatePendingCount()
})

import { onUnmounted } from 'vue'
onUnmounted(() => {
  if (shiftPollInterval) clearInterval(shiftPollInterval)
  if (syncInterval) clearInterval(syncInterval)
})

provide('pendingSyncCount', pendingSyncCount)
</script>

<template>
  <AppOfflineBanner />
  <div :class="{ 'pt-10': offlineStore.isOffline }">
    <router-view />
  </div>
  <PwaInstallPrompt />
</template>
