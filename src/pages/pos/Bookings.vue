<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/id'
import AppButton from '@/components/common/AppButton.vue'
import AppAlert from '@/components/common/AppAlert.vue'
import { fetchBookings } from '@/api/bookings'
import { formatRupiah } from '@/utils/currency'

dayjs.extend(relativeTime)
dayjs.locale('id')

const router = useRouter()

const activeTab = ref('active') // 'active', 'executed', 'cancelled'
const search = ref('')
const isLoading = ref(false)
const bookings = ref([])
const alertMessage = ref('')
const alertTitle = ref('')
const alertType = ref('success')
const showAlert = ref(false)

const triggerAlert = (title, message, type = 'success') => {
  alertTitle.value = title
  alertMessage.value = message
  alertType.value = type
  showAlert.value = true
  setTimeout(() => {
    showAlert.value = false
  }, 3500)
}

const loadBookings = async () => {
  isLoading.value = true
  try {
    const res = await fetchBookings({
      status: activeTab.value,
      search: search.value || undefined,
    })
    bookings.value = res.data?.data || res.data || []
  } catch (error) {
    triggerAlert('Gagal Memuat', error.response?.data?.message || 'Gagal memuat data booking', 'error')
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadBookings()
})

const switchTab = (tab) => {
  activeTab.value = tab
  loadBookings()
}

let searchTimeout = null
const onSearchInput = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    loadBookings()
  }, 400)
}

const getPaymentBadge = (booking) => {
  if (booking.status === 'cancelled') {
    return { label: 'Dibatalkan', class: 'bg-rose-100 text-rose-700 border-rose-200' }
  }
  if (booking.paid_amount >= booking.custom_total) {
    return { label: 'Lunas', class: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
  }
  if (booking.paid_amount > 0) {
    return { label: 'Sebagian (DP)', class: 'bg-amber-100 text-amber-800 border-amber-200' }
  }
  return { label: 'Belum Bayar', class: 'bg-slate-100 text-slate-700 border-slate-200' }
}

const getExecutionBadge = (booking) => {
  if (booking.status === 'executed') {
    return { label: 'Selesai Dibuat (Stok Terpotong)', class: 'bg-teal-100 text-teal-800 border-teal-200' }
  }
  if (booking.status === 'cancelled') {
    return { label: 'Dibatalkan', class: 'bg-rose-100 text-rose-700 border-rose-200' }
  }
  return { label: 'Menunggu Eksekusi', class: 'bg-sky-100 text-sky-800 border-sky-200' }
}

const formatEventDate = (dateStr) => {
  if (!dateStr) return '-'
  return dayjs(dateStr).format('dddd, DD MMMM YYYY - HH:mm') + ' WIB'
}

const getEventCountdown = (dateStr) => {
  if (!dateStr) return null
  const eventDate = dayjs(dateStr)
  const now = dayjs()
  const diffDays = eventDate.diff(now, 'day')
  const diffHours = eventDate.diff(now, 'hour')

  if (diffHours < 0 && Math.abs(diffDays) >= 1) {
    return { text: `Lewat ${Math.abs(diffDays)} hari lalu`, isOverdue: true }
  }
  if (diffDays === 0) {
    if (diffHours < 0) return { text: 'Hari ini (Waktu telah lewat)', isToday: true }
    return { text: `Hari ini (${eventDate.fromNow(true)} lagi)`, isToday: true }
  }
  if (diffDays === 1) {
    return { text: 'Besok', isSoon: true }
  }
  if (diffDays > 1) {
    return { text: `${diffDays} hari lagi`, isFuture: true }
  }
  return { text: eventDate.fromNow(), isPast: true }
}

const getWaLink = (phone) => {
  if (!phone) return '#'
  let clean = phone.replace(/[^0-9]/g, '')
  if (clean.startsWith('0')) clean = '62' + clean.slice(1)
  return `https://wa.me/${clean}`
}
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6 pb-12">
    <!-- Header -->
    <header class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-merchant-primary text-white shadow-md shadow-merchant-primary/20">
            <i class="pi pi-calendar text-lg" />
          </div>
          <div>
            <h1 class="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Booking & Custom Order</h1>
            <p class="text-xs md:text-sm text-slate-500">Wedding, katering, party, dan pesanan jumlah besar dengan sistem DP & pelunasan.</p>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-3 shrink-0">
        <AppButton @click="router.push('/pos/bookings/create')" class="flex items-center gap-2 px-5 py-2.5 shadow-md shadow-merchant-primary/20">
          <i class="pi pi-plus font-bold" />
          <span>Buat Booking Baru</span>
        </AppButton>
      </div>
    </header>

    <!-- App Alert -->
    <AppAlert
      v-if="showAlert"
      :title="alertTitle"
      :message="alertMessage"
      :type="alertType"
      @close="showAlert = false"
    />

    <!-- Navigation Tabs & Search -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
      <div class="flex items-center gap-2">
        <button
          type="button"
          @click="switchTab('active')"
          class="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition"
          :class="activeTab === 'active' ? 'bg-merchant-primary text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'"
        >
          <i class="pi pi-clock" />
          <span>Aktif / Berjalan</span>
        </button>
        <button
          type="button"
          @click="switchTab('executed')"
          class="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition"
          :class="activeTab === 'executed' ? 'bg-merchant-primary text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'"
        >
          <i class="pi pi-check-circle" />
          <span>Selesai Dibuat</span>
        </button>
        <button
          type="button"
          @click="switchTab('cancelled')"
          class="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition"
          :class="activeTab === 'cancelled' ? 'bg-merchant-primary text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'"
        >
          <i class="pi pi-times-circle" />
          <span>Dibatalkan</span>
        </button>
      </div>

      <!-- Search Input -->
      <div class="relative w-full sm:w-72">
        <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
        <input
          v-model="search"
          type="text"
          placeholder="Cari pemesan, no booking..."
          class="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs md:text-sm text-slate-800 placeholder-slate-400 focus:border-merchant-primary focus:outline-none focus:ring-1 focus:ring-merchant-primary"
          @input="onSearchInput"
        />
      </div>
    </div>

    <!-- Booking List Content -->
    <div v-if="isLoading" class="flex flex-col items-center justify-center py-20 text-slate-400">
      <i class="pi pi-spin pi-spinner text-3xl text-merchant-primary mb-3" />
      <p class="text-sm font-medium">Memuat data booking...</p>
    </div>

    <div v-else-if="!bookings.length" class="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
      <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400">
        <i class="pi pi-calendar-times text-2xl" />
      </div>
      <h3 class="text-base font-bold text-slate-800">Tidak ada data booking</h3>
      <p class="mt-1 text-xs md:text-sm text-slate-500 max-w-sm">
        {{ activeTab === 'active' ? 'Belum ada pesanan booking aktif. Klik "Buat Booking Baru" untuk mencatat pesanan katering / wedding.' : 'Tidak ada riwayat booking pada kategori ini.' }}
      </p>
      <AppButton v-if="activeTab === 'active'" @click="router.push('/pos/bookings/create')" class="mt-4 text-xs font-bold">
        + Buat Booking Baru
      </AppButton>
    </div>

    <div v-else class="grid grid-cols-1 gap-4">
      <div
        v-for="booking in bookings"
        :key="booking.id"
        class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
      >
        <div class="p-4 sm:p-5">
          <!-- Top Row: Booking Number, Event Tag, Badges -->
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div class="flex items-center gap-2">
              <span class="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-mono font-black text-slate-700">
                {{ booking.booking_number }}
              </span>
              <span class="text-sm font-black text-slate-900">{{ booking.event_name || 'Pesanan Khusus' }}</span>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <!-- Payment Badge -->
              <span
                class="rounded-full border px-3 py-1 text-[11px] font-black"
                :class="getPaymentBadge(booking).class"
              >
                {{ getPaymentBadge(booking).label }}
              </span>
              <!-- Execution Badge -->
              <span
                class="rounded-full border px-3 py-1 text-[11px] font-bold"
                :class="getExecutionBadge(booking).class"
              >
                {{ getExecutionBadge(booking).label }}
              </span>
            </div>
          </div>

          <!-- Middle Row: Customer Info & Event Timing -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-3 text-xs md:text-sm">
            <!-- Pelanggan -->
            <div>
              <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pemesan</p>
              <p class="mt-0.5 font-bold text-slate-900">{{ booking.customer_name }}</p>
              <div class="mt-1 flex items-center gap-2 text-slate-500">
                <i class="pi pi-phone text-xs" />
                <span>{{ booking.customer_phone || '-' }}</span>
                <a
                  v-if="booking.customer_phone"
                  :href="getWaLink(booking.customer_phone)"
                  target="_blank"
                  rel="noopener"
                  class="flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-600 hover:bg-emerald-100 transition"
                  title="Hubungi WhatsApp"
                >
                  <i class="pi pi-whatsapp" />
                  <span>WA</span>
                </a>
              </div>
              <p v-if="booking.customer_address" class="mt-1 text-slate-500 truncate" :title="booking.customer_address">
                <i class="pi pi-map-marker text-xs mr-1 text-slate-400" />{{ booking.customer_address }}
              </p>
            </div>

            <!-- Jadwal Acara -->
            <div>
              <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Jadwal Acara</p>
              <p class="mt-0.5 font-bold text-slate-900">{{ formatEventDate(booking.event_date) }}</p>
              <div v-if="getEventCountdown(booking.event_date)" class="mt-1.5">
                <span
                  class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-black"
                  :class="[
                    getEventCountdown(booking.event_date).isOverdue ? 'bg-rose-50 text-rose-600' : '',
                    getEventCountdown(booking.event_date).isToday ? 'bg-amber-100 text-amber-800' : '',
                    getEventCountdown(booking.event_date).isSoon ? 'bg-sky-100 text-sky-800' : '',
                    getEventCountdown(booking.event_date).isFuture ? 'bg-slate-100 text-slate-700' : '',
                  ]"
                >
                  <i class="pi pi-bell text-[10px]" />
                  {{ getEventCountdown(booking.event_date).text }}
                </span>
              </div>
            </div>

            <!-- Item Ringkasan -->
            <div>
              <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Item Pesanan</p>
              <p class="mt-0.5 font-bold text-slate-800">
                {{ booking.items?.length || 0 }} Menu ({{ (booking.items || []).reduce((acc, i) => acc + Number(i.quantity), 0) }} porsi/cup)
              </p>
              <p class="mt-1 text-slate-500 text-xs truncate">
                {{ (booking.items || []).map(i => `${i.product_name} (${i.quantity})`).join(', ') }}
              </p>
            </div>
          </div>

          <!-- Bottom Row: Financial Status & Action Button -->
          <div class="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl bg-slate-50 p-3.5 border border-slate-100">
            <div class="flex flex-wrap items-center gap-4 sm:gap-8">
              <div>
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Kesepakatan</span>
                <p class="text-base font-black text-slate-900 leading-tight">{{ formatRupiah(booking.custom_total) }}</p>
                <p v-if="booking.normal_total !== booking.custom_total" class="text-[11px] text-slate-400 line-through">
                  Katalog: {{ formatRupiah(booking.normal_total) }}
                </p>
              </div>

              <div>
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sudah Dibayar</span>
                <p class="text-base font-black text-emerald-600 leading-tight">{{ formatRupiah(booking.paid_amount) }}</p>
                <p class="text-[11px] text-slate-500">
                  {{ Math.round((booking.paid_amount / (booking.custom_total || 1)) * 100) }}% terbayar
                </p>
              </div>

              <div>
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sisa Tagihan</span>
                <p
                  class="text-base font-black leading-tight"
                  :class="booking.custom_total - booking.paid_amount > 0 ? 'text-rose-600' : 'text-slate-400'"
                >
                  {{ formatRupiah(Math.max(0, booking.custom_total - booking.paid_amount)) }}
                </p>
                <p v-if="booking.custom_total - booking.paid_amount <= 0" class="text-[11px] font-bold text-emerald-600">
                  Lunas
                </p>
              </div>
            </div>

            <!-- Action buttons -->
            <div class="flex items-center gap-2 shrink-0">
              <router-link
                :to="`/pos/bookings/${booking.id}`"
                class="flex items-center gap-2 rounded-xl bg-merchant-primary px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-merchant-primary/90"
              >
                <span>Detail & Pembayaran</span>
                <i class="pi pi-arrow-right text-xs" />
              </router-link>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
