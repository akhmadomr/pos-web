<script setup>
import { onMounted } from 'vue'
import AppOfflineBanner from '@/components/common/AppOfflineBanner.vue'
import PwaInstallPrompt from '@/components/common/PwaInstallPrompt.vue'
import { useOffline } from '@/composables/useOffline'
import { useOfflineStore } from '@/stores/offline.store'
import { useAuthStore } from '@/stores/auth.store'

useOffline()

const offlineStore = useOfflineStore()
const authStore = useAuthStore()

let shiftPollInterval = null

onMounted(async () => {
  if (!offlineStore.hydrated) {
    await offlineStore.hydrate()
  }

  // Poll current shift status periodically (e.g. every 60s) for cross-device sync
  shiftPollInterval = setInterval(async () => {
    if (authStore.isAuthenticated && authStore.hasActiveShift && !offlineStore.isOffline) {
      await authStore.fetchCurrentShift()
    }
  }, 60000)
})

import { onUnmounted } from 'vue'
onUnmounted(() => {
  if (shiftPollInterval) clearInterval(shiftPollInterval)
})
</script>

<template>
  <AppOfflineBanner />
  <div :class="{ 'pt-10': offlineStore.isOffline }">
    <router-view />
  </div>
  <PwaInstallPrompt />
</template>
