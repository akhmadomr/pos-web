<script setup>
import { onMounted } from 'vue'
import AppOfflineBanner from '@/components/common/AppOfflineBanner.vue'
import { useOffline } from '@/composables/useOffline'
import { useOfflineStore } from '@/stores/offline.store'

useOffline()

const offlineStore = useOfflineStore()

onMounted(async () => {
  if (!offlineStore.hydrated) {
    await offlineStore.hydrate()
  }
})
</script>

<template>
  <AppOfflineBanner />
  <div :class="{ 'pt-10': offlineStore.isOffline }">
    <router-view />
  </div>
</template>
