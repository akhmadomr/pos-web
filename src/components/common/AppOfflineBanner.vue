<script setup>
import { inject, ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useOfflineStore } from '@/stores/offline.store'
import { getPendingCount } from '@/services/SyncService'

const offlineStore = useOfflineStore()
const { isOffline } = storeToRefs(offlineStore)

// Ambil dari App.vue (provider), fallback ke 0 jika tidak ada
const pendingSyncCount = inject('pendingSyncCount', ref(0))
</script>

<template>
  <Transition
    enter-active-class="transition duration-300"
    enter-from-class="-translate-y-full opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition duration-200"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="-translate-y-full opacity-0"
  >
    <div
      v-if="isOffline"
      class="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-sm font-bold text-white shadow-lg"
    >
      <i class="pi pi-wifi-off animate-pulse" />
      <span>Mode Offline — transaksi akan disinkronkan saat koneksi kembali</span>
      <span v-if="pendingSyncCount > 0" class="rounded-full bg-white/25 px-2 py-0.5 text-xs font-black">
        {{ pendingSyncCount }} menunggu sinkronisasi 
      </span>
    </div>
  </Transition>
</template>
