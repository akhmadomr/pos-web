<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useBookingStore } from '@/stores/booking.store'

const router = useRouter()
const authStore = useAuthStore()
const bookingStore = useBookingStore()

const SUPPRESS_DURATION = 15 * 60 * 1000 // 15 menit dalam milidetik
const STORAGE_KEY = 'booking_today_suppressed_at'
const isDismissed = ref(false)
let checkInterval = null

const checkSuppression = () => {
  const suppressedAt = localStorage.getItem(STORAGE_KEY)
  if (!suppressedAt) {
    isDismissed.value = false
    return
  }
  const now = Date.now()
  if (now - parseInt(suppressedAt, 10) > SUPPRESS_DURATION) {
    localStorage.removeItem(STORAGE_KEY)
    isDismissed.value = false
  } else {
    isDismissed.value = true
  }
}

const isVisible = computed(() => {
  if (!authStore.isAuthenticated) return false
  if (isDismissed.value) return false
  return (bookingStore.todayBookings && bookingStore.todayBookings.length > 0) || (bookingStore.counts?.today_active > 0)
})

const summaryText = computed(() => {
  const list = bookingStore.todayBookings || []
  if (list.length === 1) {
    const b = list[0]
    const itemsCount = (b.items || []).reduce((acc, i) => acc + Number(i.quantity), 0)
    const name = b.customer_name || 'Pelanggan'
    const event = b.description || b.event_type || 'Pesanan Khusus'
    return `Ada 1 pesanan booking aktif: ${name} (${event}) ${itemsCount > 0 ? `• ${itemsCount} porsi/cup` : ''}. Harap siapkan pesanan tepat waktu!`
  }
  if (list.length > 1) {
    const names = list.map(b => b.customer_name).slice(0, 2).join(', ')
    return `Ada ${list.length} pesanan booking aktif hari ini (${names}, dll). Pastikan persiapan menu siap sebelum waktu acara!`
  }
  return `Ada ${bookingStore.counts?.today_active || 1} pesanan booking aktif hari ini. Harap siapkan pesanan tepat waktu!`
})

const dismissBanner = () => {
  localStorage.setItem(STORAGE_KEY, Date.now().toString())
  isDismissed.value = true
}

const goToBookings = () => {
  router.push('/pos/bookings')
}

onMounted(() => {
  checkSuppression()
  checkInterval = setInterval(() => {
    checkSuppression()
  }, 10000)
})

onUnmounted(() => {
  if (checkInterval) clearInterval(checkInterval)
})
</script>

<template>
  <div v-if="isVisible" class="flex flex-col">
    <div
      class="sticky top-[100px] lg:top-[145px] z-20 relative flex flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-700 px-3 sm:px-4 py-2.5 text-white shadow-md border-b border-blue-500/40"
    >
      <div class="flex items-start sm:items-center gap-2 text-xs sm:text-sm font-bold flex-1 pr-8 sm:pr-0 leading-tight">
        <div class="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-white/20 text-white shrink-0 mt-0.5 sm:mt-0">
          <i class="pi pi-calendar text-xs sm:text-sm" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="rounded bg-white/25 px-1.5 py-0.5 text-[10px] uppercase font-black tracking-wide">
              Booking Hari Ini
            </span>
            <span>{{ summaryText }}</span>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <button
          type="button"
          @click="goToBookings"
          class="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1 text-xs font-black text-blue-800 shadow-sm transition hover:bg-blue-50 active:scale-95"
        >
          <span>Lihat Pesanan</span>
          <i class="pi pi-arrow-right text-[10px]" />
        </button>

        <button
          type="button"
          @click="dismissBanner"
          class="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-white/20 text-white transition hover:bg-white/30 active:scale-95"
          title="Abaikan pengingat selama 15 menit"
        >
          <i class="pi pi-times text-xs sm:text-sm" />
        </button>
      </div>
    </div>
  </div>
</template>
