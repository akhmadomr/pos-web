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
import { useBookingStore } from '@/stores/booking.store'
import { usePrinter } from '@/composables/usePrinter'
import { useSettingsStore } from '@/stores/settings.store'
import { DEFAULT_RECEIPT_LAYOUT } from '@/utils/receipt'

dayjs.extend(relativeTime)
dayjs.locale('id')

const router = useRouter()
const bookingStore = useBookingStore()
const printer = usePrinter()
const settingsStore = useSettingsStore()

const activeTab = ref('active') // 'active', 'executed', 'cancelled'
const search = ref('')
const isLoading = ref(false)
const bookings = ref([])
const alertMessage = ref('')
const alertTitle = ref('')
const alertType = ref('success')
const showAlert = ref(false)
const printingBookingId = ref(null)

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
    if (res.counts) {
      bookingStore.updateCounts(res.counts)
    }
  } catch (error) {
    triggerAlert('Gagal Memuat', error.response?.data?.message || 'Gagal memuat data booking', 'error')
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  settingsStore.load()
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

const parseNum = (val) => {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  const cleaned = String(val).replace(/[^\d.-]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

const isBookingLunas = (b) => {
  if (b.status === 'executed') return true
  const paid = parseNum(b.paid_amount ?? b.total_paid)
  const total = parseNum(b.custom_total)
  return total > 0 && paid >= total
}

const isBookingDP = (b) => {
  const paid = parseNum(b.paid_amount ?? b.total_paid)
  const total = parseNum(b.custom_total)
  return paid > 0 && paid < total
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

// ================= Cetak Struk Thermal Langsung Dari Card =================
const handlePrintBookingReceipt = async (b) => {
  if (printingBookingId.value) return
  printingBookingId.value = b.id
  try {
    let layout = DEFAULT_RECEIPT_LAYOUT
    try {
      if (settingsStore.receipt?.layout) {
        if (typeof settingsStore.receipt.layout === 'string') {
          layout = JSON.parse(settingsStore.receipt.layout)
        } else if (Array.isArray(settingsStore.receipt.layout)) {
          layout = settingsStore.receipt.layout
        }
      }
    } catch (e) {
      console.error(e)
    }

    const headerBlocks = []
    const footerBlocks = []
    let isHeader = true
    for (const block of layout) {
      if (block.type === 'static_order_info' || block.type === 'static_items') {
        isHeader = false
        continue
      }
      if (block.type === 'static_totals') continue
      if (isHeader) headerBlocks.push(block)
      else footerBlocks.push(block)
    }

    const lines = []
    let hasHeaderText = false
    headerBlocks.forEach((block) => {
      if (block.type === 'text' && block.content) {
        hasHeaderText = true
        block.content.split('\n').forEach((txt) => {
          if (txt.trim()) lines.push({ type: 'center', text: txt.trim(), bold: block.bold || block.size === 'large' })
        })
      }
    })
    if (!hasHeaderText) lines.push({ type: 'center', text: 'KOPIREX', bold: true })

    lines.push({ type: 'center', text: 'STRUK PESANAN', bold: true })
    lines.push({ type: 'separator', text: '=' })

    lines.push({ type: 'row', left: 'No. Booking:', right: b.booking_number || '-', bold: true })
    lines.push({ type: 'row', left: 'Waktu Pesan:', right: dayjs(b.created_at).format('DD/MM/YYYY HH:mm') })
    lines.push({ type: 'row', left: 'Pemesan:', right: b.customer_name || '-' })
    if (b.customer_phone) lines.push({ type: 'row', left: 'No. HP/WA:', right: b.customer_phone })
    lines.push({ type: 'row', left: 'Jadwal Acara:', right: dayjs(b.event_date).format('DD/MM/YYYY') })
    if (b.event_name) lines.push({ type: 'row', left: 'Nama Acara:', right: b.event_name })

    lines.push({ type: 'separator', text: '-' })
    lines.push({ type: 'label', text: 'MENU PESANAN:' })

    const finalTotal = parseNum(b.custom_total)
    const standardTotal = parseNum(b.normal_total)
    const rawItems = b.items || []

    let accumulatedSubtotal = 0
    rawItems.forEach((item, idx) => {
      const isLast = idx === rawItems.length - 1
      const qty = Number(item.quantity) || 1
      const name = item.product_name + (item.variant_label ? ` (${item.variant_label})` : '')
      
      let itemSubtotal = 0
      if (finalTotal === standardTotal || standardTotal <= 0) {
        itemSubtotal = Number(item.subtotal || (qty * Number(item.unit_price)))
      } else {
        if (isLast) {
          itemSubtotal = Math.max(0, finalTotal - accumulatedSubtotal)
        } else {
          const itemOriginalSubtotal = Number(item.subtotal || (qty * Number(item.unit_price)))
          itemSubtotal = Math.round((itemOriginalSubtotal * finalTotal) / standardTotal)
          accumulatedSubtotal += itemSubtotal
        }
      }

      lines.push({ type: 'row', left: `${qty}x ${name}`, right: formatRupiah(itemSubtotal) })
    })

    const paidVal = parseNum(b.paid_amount ?? b.total_paid)
    const remVal = Math.max(0, finalTotal - paidVal)

    lines.push({ type: 'separator', text: '-' })
    lines.push({ type: 'row', left: 'Total Tagihan:', right: formatRupiah(finalTotal), bold: true })
    lines.push({ type: 'row', left: 'Sudah Dibayar:', right: formatRupiah(paidVal) })
    lines.push({ type: 'row', left: 'Sisa Tagihan:', right: remVal > 0 ? formatRupiah(remVal) : 'LUNAS', bold: true })

    lines.push({ type: 'separator', text: '=' })
    let hasFooterText = false
    footerBlocks.forEach((block) => {
      if (block.type === 'text' && block.content) {
        hasFooterText = true
        block.content.split('\n').forEach((txt) => {
          if (txt.trim()) lines.push({ type: 'center', text: txt.trim(), bold: !!block.bold })
        })
      }
    })
    if (!hasFooterText) lines.push({ type: 'center', text: 'Terima kasih atas pesanan Anda!' })
    lines.push({ type: 'center', text: 'Powered by Kasir Kopirex' })
    lines.push({ type: 'feed', lines: 2 })

    await printer.printShiftReceipt(lines)
  } catch (err) {
    console.error('Print error:', err)
    triggerAlert('Gagal Cetak', 'Terjadi kesalahan saat mencetak struk thermal', 'error')
  } finally {
    printingBookingId.value = null
  }
}
</script>

<template>
  <div class="mx-auto max-w-6xl px-3 sm:px-4 space-y-5 pb-16">
    <!-- Header -->
    <header class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <h1 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">Booking</h1>
        <p class="text-xs sm:text-sm text-slate-500">Pemesanan dan custom order</p>
      </div>
      <button
        type="button"
        @click="router.push('/pos/bookings/create')"
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-merchant-primary text-white shadow-md shadow-merchant-primary/20 transition hover:bg-merchant-primary/90 active:scale-95"
        title="Buat Booking Baru"
      >
        <i class="pi pi-plus text-base font-bold" />
      </button>
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
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
      <div class="grid grid-cols-3 gap-2 w-full sm:w-auto sm:flex sm:items-center">
        <button
          type="button"
          @click="switchTab('active')"
          class="flex items-center justify-center gap-1.5 rounded-xl px-3 sm:px-4 py-2.5 sm:py-2 text-xs sm:text-sm font-bold transition"
          :class="activeTab === 'active' ? 'bg-merchant-primary text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'"
        >
          <span>Aktif</span>
          <span
            class="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black transition"
            :class="activeTab === 'active' ? 'bg-white text-merchant-primary' : (bookingStore.counts.active > 0 ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600')"
          >
            {{ bookingStore.counts.active || 0 }}
          </span>
        </button>

        <button
          type="button"
          @click="switchTab('executed')"
          class="flex items-center justify-center gap-1.5 rounded-xl px-3 sm:px-4 py-2.5 sm:py-2 text-xs sm:text-sm font-bold transition"
          :class="activeTab === 'executed' ? 'bg-merchant-primary text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'"
        >
          <span>Selesai</span>
        </button>

        <button
          type="button"
          @click="switchTab('cancelled')"
          class="flex items-center justify-center gap-1.5 rounded-xl px-3 sm:px-4 py-2.5 sm:py-2 text-xs sm:text-sm font-bold transition"
          :class="activeTab === 'cancelled' ? 'bg-merchant-primary text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'"
        >
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

    <!-- Daftar Card Booking: Ringkas, Informatif, dan Clean -->
    <div v-else class="grid grid-cols-1 gap-3 sm:gap-4">
      <div
        v-for="booking in bookings"
        :key="booking.id"
        class="overflow-hidden rounded-2xl border transition-all duration-200"
        :class="[
          booking.status === 'executed'
            ? 'bg-emerald-50/70 border-emerald-200/80 text-slate-800 opacity-85 hover:opacity-100 shadow-none hover:shadow-sm'
            : booking.status === 'cancelled'
            ? 'bg-rose-50/70 border-rose-200/80 text-slate-800 opacity-80 hover:opacity-100 shadow-none hover:shadow-sm'
            : 'bg-white border-slate-200 text-slate-900 shadow-sm hover:shadow-md hover:border-slate-300'
        ]"
      >
        <div class="p-3.5 sm:p-4 space-y-2.5">
          <!-- Baris 1: Label Perlu Disiapkan & Status Lunas Sejajar -->
          <div class="flex items-center justify-between gap-2 border-b border-slate-100/80 pb-2">
            <div class="flex items-center gap-2 flex-wrap">
              <!-- Label Status Eksekusi: Perlu Disiapkan / Selesai / Dibatalkan -->
              <span
                class="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                :class="[
                  booking.status === 'executed' ? 'bg-teal-100 text-teal-800 border border-teal-200' : '',
                  booking.status === 'cancelled' ? 'bg-rose-100 text-rose-800 border border-rose-200' : '',
                  booking.status !== 'executed' && booking.status !== 'cancelled' ? 'bg-sky-100 text-sky-800 border border-sky-200' : '',
                ]"
              >
                {{
                  booking.status === 'executed' ? 'Selesai' :
                  booking.status === 'cancelled' ? 'Dibatalkan' : 'Perlu Disiapkan'
                }}
              </span>

              <!-- Label Sudah Lunas / Belum Lunas sejajar -->
              <span
                class="rounded-full px-2.5 py-0.5 text-[11px] font-black"
                :class="isBookingLunas(booking) ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'"
              >
                {{ isBookingLunas(booking) ? 'Sudah Lunas' : (isBookingDP(booking) ? 'Belum Lunas (DP)' : 'Belum Lunas') }}
              </span>
            </div>

            <!-- Countdown Event jika ada -->
            <div v-if="getEventCountdown(booking.event_date) && booking.status !== 'executed' && booking.status !== 'cancelled'">
              <span
                class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] sm:text-[11px] font-black"
                :class="[
                  getEventCountdown(booking.event_date).isOverdue ? 'bg-rose-100 text-rose-700' : '',
                  getEventCountdown(booking.event_date).isToday ? 'bg-amber-100 text-amber-800' : '',
                  getEventCountdown(booking.event_date).isSoon ? 'bg-sky-100 text-sky-800' : '',
                  getEventCountdown(booking.event_date).isFuture ? 'bg-slate-100 text-slate-700' : '',
                ]"
              >
                <i class="pi pi-bell text-[9px]" />
                {{ getEventCountdown(booking.event_date).text }}
              </span>
            </div>
          </div>

          <!-- Baris 2: No Booking, Informasi Pemesan, dan Jadwal Acara digabung -->
          <div class="space-y-1.5 text-xs sm:text-sm">
            <!-- No Booking & Nama Pemesan (Tanpa info no HP) -->
            <div class="flex items-center gap-2 flex-wrap">
              <span class="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-mono font-black text-slate-700">
                {{ booking.booking_number }}
              </span>
              <span class="font-black text-slate-900 text-sm sm:text-base">
                {{ booking.customer_name }}
              </span>
              <span v-if="booking.event_name" class="text-xs text-slate-500 font-medium">
                &bull; {{ booking.event_name }}
              </span>
            </div>

            <!-- Jadwal Acara -->
            <div class="flex items-center gap-1.5 text-slate-600">
              <i class="pi pi-calendar text-xs text-slate-400" />
              <span class="font-semibold text-slate-800">{{ formatEventDate(booking.event_date) }}</span>
            </div>
          </div>

          <!-- Baris 3 (Bawah): Tombol WA, Print Struk, dan Detail Sejajar -->
          <div class="pt-2 border-t border-slate-100/80 flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <!-- Tombol Chat WA: icon saja, tanpa bg, tanpa border -->
              <a
                v-if="booking.customer_phone"
                :href="getWaLink(booking.customer_phone)"
                target="_blank"
                rel="noopener"
                class="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 transition p-1 leading-none font-bold text-xs"
                title="Chat WhatsApp"
                @click.stop
              >
                <i class="pi pi-whatsapp text-lg" />
                <span class="hidden sm:inline">WhatsApp</span>
              </a>

              <!-- Tombol Cetak Struk: warna primary, icon saja, tanpa bg, tanpa border -->
              <button
                type="button"
                @click="handlePrintBookingReceipt(booking)"
                :disabled="printingBookingId === booking.id"
                class="flex items-center gap-1 text-merchant-primary hover:text-merchant-primary/80 transition p-1 leading-none font-bold text-xs"
                title="Cetak Struk Booking"
              >
                <i v-if="printingBookingId === booking.id" class="pi pi-spin pi-spinner text-sm" />
                <i v-else class="pi pi-print text-lg" />
                <span class="hidden sm:inline">Cetak Struk</span>
              </button>
            </div>

            <!-- Tombol Detail -->
            <router-link
              :to="`/pos/bookings/${booking.id}`"
              class="flex items-center gap-1.5 rounded-xl bg-merchant-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-merchant-primary/90 active:scale-95 transition"
            >
              <span>Detail</span>
              <i class="pi pi-arrow-right text-[10px]" />
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
