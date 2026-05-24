<script setup>
import { storeToRefs } from 'pinia'
import { useOfflineStore } from '@/stores/offline.store'

const offlineStore = useOfflineStore()
const { isOffline, pendingOrders } = storeToRefs(offlineStore)
</script>

<template>
  <div
    v-if="isOffline"
    class="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-sm font-bold text-white shadow-lg"
  >
    <i class="pi pi-wifi" />
    <span>Mode offline — transaksi akan disinkronkan saat koneksi kembali</span>
    <span v-if="pendingOrders.length" class="rounded-full bg-white/20 px-2 py-0.5 text-xs">
      {{ pendingOrders.length }} pending
    </span>
  </div>
</template>
