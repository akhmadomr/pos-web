<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { fetchShiftSummary } from '@/api/shifts'
import { useAuthStore } from '@/stores/auth.store'
import { useOfflineStore } from '@/stores/offline.store'
import { formatRupiah } from '@/utils/currency'
import { db } from '@/utils/db'

const authStore = useAuthStore()
const offlineStore = useOfflineStore()

const summary = ref(null)
const loading = ref(false)
const localStats = ref({ orders: 0, cups: 0, snacks: 0, cash: 0 })
let refreshTimer = null

// Baca data offline order langsung dari IndexedDB yang belum tersinkron
async function refreshLocalStats() {
  try {
    const allOrders = await db.offline_orders.toArray()
    const pendingOrders = allOrders.filter(o => o.sync_status !== 'synced' && o.sync_status !== 'cancelled')
    
    localStats.value = pendingOrders.reduce((acc, o) => {
      acc.orders += 1
      const items = o.payload?.items ?? o.payload?.order_items ?? []
      
      // Hitung cups dan snacks dari items
      items.forEach(item => {
        if (item.category_id === 3 || item.category_id === 4) {
          acc.snacks += Number(item.quantity || 0)
        } else {
          acc.cups += Number(item.quantity || 0)
        }
      })
      
      // Kas hanya dari tunai
      if (o.methodData?.payment_method === 'cash') {
        acc.cash += Number(o.methodData?.amount || 0)
      }
      return acc
    }, { orders: 0, cups: 0, snacks: 0, cash: 0 })
  } catch {
    localStats.value = { orders: 0, cups: 0, snacks: 0, cash: 0 }
  }
}

// Saat offline/online, jumlah adalah data server + data lokal yang belum tersinkron
const orderCount = computed(() => (summary.value?.total_transactions ?? 0) + localStats.value.orders)
const cupCount = computed(() => (summary.value?.total_cups ?? 0) + localStats.value.cups)
const snackCount = computed(() => (summary.value?.total_snacks ?? 0) + localStats.value.snacks)
const kasFisikLabel = computed(() => {
  if (offlineStore.isOffline && !summary.value?.system_cash) {
    const opening = Number(authStore.shift?.opening_cash ?? 0)
    return formatRupiah(opening + localStats.value.cash)
  }
  return formatRupiah((summary.value?.system_cash ?? 0) + localStats.value.cash)
})

const loadSummary = async () => {
  if (!authStore.hasActiveShift) return

  // Selalu refresh data lokal
  await refreshLocalStats()

  if (offlineStore.isOffline) return // Jangan panggil API saat offline

  loading.value = true
  try {
    summary.value = await fetchShiftSummary(authStore.user?.outlet_id)
  } catch {
    // Jika gagal, biarkan localStats yang tampil
  } finally {
    loading.value = false
  }
}

// Watcher: saat offlineStore.isOffline berubah, refresh
watch(() => offlineStore.isOffline, () => loadSummary())

onMounted(() => {
  loadSummary()
  refreshTimer = window.setInterval(loadSummary, 30000) // setiap 30 detik
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})

defineExpose({ refresh: loadSummary })
</script>

<template>
  <div
    v-if="authStore.hasActiveShift"
    class="flex flex-nowrap items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-[9px] font-bold text-slate-600 sm:gap-4 sm:rounded-2xl sm:px-4 sm:py-2 sm:text-xs"
    :class="{ 'opacity-60': loading }"
  >
    <div class="flex items-center gap-1 sm:gap-1.5">
      <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[10px] text-merchant-primary sm:text-sm">
        <path d="M8 3c.5 1 .5 2 0 3" />
        <path d="M12 2c.5 1 .5 2 0 3" />
        <path d="M16 3c.5 1 .5 2 0 3" />
        <path d="M3 10h18" />
        <path d="M4 10c0 5 3.5 9 8 9s8-4 8-9Z" />
        <path d="M8 19h8" />
      </svg>
      <span class="whitespace-nowrap">{{ snackCount }}</span>
      <span class="hidden sm:inline"> snack</span>
    </div>
    <span class="mx-0.5 h-3 w-px bg-slate-200 sm:mx-0 sm:h-4" />
    <div class="flex items-center gap-1 sm:gap-1.5" title="Kas Fisik (Tunai + Modal - Pengeluaran)">
      <i class="pi pi-wallet text-[10px] text-merchant-primary sm:text-sm" />
      <span class="whitespace-nowrap">{{ kasFisikLabel }}</span>
    </div>
  </div>
</template>
