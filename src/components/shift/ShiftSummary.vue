<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { fetchShiftSummary } from '@/api/shifts'
import { useAuthStore } from '@/stores/auth.store'
import { formatRupiah } from '@/utils/currency'
import { formatShiftDuration } from '@/utils/shift'

const authStore = useAuthStore()

const summary = ref(null)
const loading = ref(false)
let refreshTimer = null
let durationTimer = null
const tick = ref(0)

const durationLabel = computed(() => {
  tick.value
  const openedAt = summary.value?.opened_at ?? authStore.shift?.opened_at
  return formatShiftDuration(openedAt)
})

const orderCount = computed(() => summary.value?.total_transactions ?? 0)
const cupCount = computed(() => summary.value?.total_cups ?? 0)
const kasFisikLabel = computed(() => formatRupiah(summary.value?.system_cash ?? 0))

const loadSummary = async () => {
  if (!authStore.hasActiveShift) return

  loading.value = true
  try {
    summary.value = await fetchShiftSummary(authStore.user?.outlet_id)
  } catch {
    summary.value = null
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadSummary()
  refreshTimer = window.setInterval(loadSummary, 60000)
  durationTimer = window.setInterval(() => {
    tick.value += 1
  }, 60000)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
  if (durationTimer) clearInterval(durationTimer)
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
      <i class="pi pi-clock text-[10px] text-merchant-primary sm:text-sm" />
      <span class="whitespace-nowrap">{{ durationLabel }}</span>
    </div>
    <span class="mx-0.5 h-3 w-px bg-slate-200 sm:mx-0 sm:h-4" />
    <div class="flex items-center gap-1 sm:gap-1.5">
      <i class="pi pi-receipt text-[10px] text-merchant-primary sm:text-sm" />
      <span class="whitespace-nowrap">{{ orderCount }}</span>
      <span class="hidden sm:inline"> order</span>
    </div>
    <span class="mx-0.5 h-3 w-px bg-slate-200 sm:mx-0 sm:h-4" />
    <div class="flex items-center gap-1 sm:gap-1.5">
      <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[10px] text-merchant-primary sm:text-sm">
        <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
        <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
        <line x1="6" y1="2" x2="6" y2="4" />
        <line x1="10" y1="2" x2="10" y2="4" />
        <line x1="14" y1="2" x2="14" y2="4" />
      </svg>
      <span class="whitespace-nowrap">{{ cupCount }}</span>
      <span class="hidden sm:inline"> cup</span>
    </div>
    <span class="mx-0.5 h-3 w-px bg-slate-200 sm:mx-0 sm:h-4" />
    <div class="flex items-center gap-1 sm:gap-1.5" title="Kas Fisik (Tunai + Modal - Pengeluaran)">
      <i class="pi pi-wallet text-[10px] text-merchant-primary sm:text-sm" />
      <span class="whitespace-nowrap">{{ kasFisikLabel }}</span>
    </div>
  </div>
</template>
