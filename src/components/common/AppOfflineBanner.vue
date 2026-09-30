<script setup>
import { inject, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useOfflineStore } from '@/stores/offline.store'

const offlineStore = useOfflineStore()
const { isOffline } = storeToRefs(offlineStore)

// Ambil dari App.vue (provider), fallback ke 0 jika tidak ada
const pendingSyncCount = inject('pendingSyncCount', ref(0))
const isSwitching = ref(false)

const handleSwitchToOnline = async () => {
  isSwitching.value = true
  try {
    await offlineStore.setOffline(false)
  } finally {
    isSwitching.value = false
  }
}
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
      class="fixed inset-x-0 top-0 z-[100] flex flex-wrap items-center justify-center gap-2 sm:gap-3 bg-amber-500 px-4 py-2 text-center text-xs sm:text-sm font-bold text-white shadow-lg"
    >
      <div class="flex items-center gap-1.5">
        <i class="pi pi-wifi-off animate-pulse" />
        <span>Mode Offline (Manual) — Transaksi disimpan lokal</span>
      </div>
      <span v-if="pendingSyncCount > 0" class="rounded-full bg-white/25 px-2 py-0.5 text-xs font-black">
        {{ pendingSyncCount }} menunggu sinkronisasi
      </span>
      <button
        type="button"
        @click="handleSwitchToOnline"
        :disabled="isSwitching"
        class="ml-1 sm:ml-2 rounded-lg bg-white px-2.5 py-1 text-xs font-black text-amber-700 hover:bg-amber-50 active:scale-95 transition shadow-sm flex items-center gap-1.5 cursor-pointer"
        title="Klik untuk beralih kembali ke Mode Online"
      >
        <i class="pi" :class="isSwitching ? 'pi-spin pi-spinner' : 'pi-wifi'" />
        <span>{{ isSwitching ? 'Menghubungkan...' : 'Beralih ke Online' }}</span>
      </button>
    </div>
  </Transition>
</template>
