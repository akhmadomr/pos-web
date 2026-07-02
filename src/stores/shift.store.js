import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useShiftStore = defineStore('shift', () => {
  // State shift aktif di-sinkron dari authStore,
  // store ini menyimpan summary & live stats
  const liveStats = ref({
    total_transactions: 0,
    total_revenue: 0,
    cash_total: 0,
    qris_total: 0,
    transfer_total: 0,
  })

  const loading = ref(false)

  const hasStats = computed(() => liveStats.value.total_transactions > 0)

  function incrementStats(orderTotal, paymentMethod) {
    liveStats.value.total_transactions += 1
    liveStats.value.total_revenue += orderTotal
    if (paymentMethod === 'cash') liveStats.value.cash_total += orderTotal
    else if (paymentMethod === 'qris') liveStats.value.qris_total += orderTotal
    else if (paymentMethod === 'transfer') liveStats.value.transfer_total += orderTotal
  }

  function resetStats() {
    liveStats.value = {
      total_transactions: 0,
      total_revenue: 0,
      cash_total: 0,
      qris_total: 0,
      transfer_total: 0,
    }
  }

  return {
    liveStats,
    loading,
    hasStats,
    incrementStats,
    resetStats,
  }
})
