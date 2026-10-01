import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchBookings } from '@/api/bookings'

export const useBookingStore = defineStore('booking', () => {
  const activeCount = ref(0)
  const counts = ref({ active: 0, executed: 0, cancelled: 0, today_active: 0 })
  const todayBookings = ref([])
  const isLoading = ref(false)

  async function fetchCounts() {
    isLoading.value = true
    try {
      const res = await fetchBookings({ per_page: 1 })
      if (res?.counts) {
        counts.value = { ...counts.value, ...res.counts }
        activeCount.value = Number(res.counts.active || 0)
      }
      if (res?.today_bookings) {
        todayBookings.value = res.today_bookings
      }
    } catch (err) {
      // silent on polling error
    } finally {
      isLoading.value = false
    }
  }

  function updateCounts(newCounts, newTodayBookings = null) {
    if (newCounts) {
      counts.value = { ...counts.value, ...newCounts }
      activeCount.value = Number(newCounts.active || 0)
    }
    if (newTodayBookings) {
      todayBookings.value = newTodayBookings
    }
  }

  return {
    activeCount,
    counts,
    todayBookings,
    isLoading,
    fetchCounts,
    updateCounts,
  }
})
