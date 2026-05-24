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
const revenueLabel = computed(() => formatRupiah(summary.value?.total_revenue ?? 0))

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
    class="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-semibold text-slate-600 sm:gap-4 sm:px-4 sm:text-xs"
    :class="{ 'opacity-60': loading }"
  >
    <div class="flex items-center gap-1.5">
      <i class="pi pi-clock text-merchant-primary" />
      <span>{{ durationLabel }}</span>
    </div>
    <span class="h-4 w-px bg-slate-200" />
    <div class="flex items-center gap-1.5">
      <i class="pi pi-receipt text-merchant-primary" />
      <span>{{ orderCount }} order</span>
    </div>
    <span class="h-4 w-px bg-slate-200" />
    <div class="flex items-center gap-1.5">
      <i class="pi pi-wallet text-merchant-primary" />
      <span>{{ revenueLabel }}</span>
    </div>
  </div>
</template>
