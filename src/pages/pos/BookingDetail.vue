<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/id'
import AppButton from '@/components/common/AppButton.vue'
import AppAlert from '@/components/common/AppAlert.vue'
import AppModal from '@/components/common/AppModal.vue'
import {
  fetchBooking,
  addBookingPayment,
  checkBookingStock,
  executeBooking,
  cancelBooking,
} from '@/api/bookings'
import { formatRupiah } from '@/utils/currency'
import { usePrinter } from '@/composables/usePrinter'
import { useSettingsStore } from '@/stores/settings.store'
import { DEFAULT_RECEIPT_LAYOUT } from '@/utils/receipt'

dayjs.extend(relativeTime)
dayjs.locale('id')

const route = useRoute()
const router = useRouter()
const printer = usePrinter()
const settingsStore = useSettingsStore()

const bookingId = computed(() => route.params.id)
const booking = ref(null)
const isLoading = ref(true)

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
  }, 4000)
}

const loadBooking = async () => {
  isLoading.value = true
  try {
    const data = await fetchBooking(bookingId.value)
    booking.value = data
  } catch (error) {
    triggerAlert('Gagal Memuat', error.response?.data?.message || 'Gagal memuat detail booking', 'error')
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  settingsStore.load()
  loadBooking()
})

const parseNum = (val) => {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  const cleaned = String(val).replace(/[^\d.-]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

const customTotal = computed(() => parseNum(booking.value?.custom_total))
const normalTotal = computed(() => parseNum(booking.value?.normal_total))
const paidAmount = computed(() => parseNum(booking.value?.paid_amount ?? booking.value?.total_paid))
const remainingAmount = computed(() => Math.max(0, customTotal.value - paidAmount.value))
const paymentPercentage = computed(() => {
  if (!customTotal.value || customTotal.value <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((paidAmount.value / customTotal.value) * 100)))
})

const formatEventDate = (dateStr) => {
  if (!dateStr) return '-'
  return dayjs(dateStr).format('dddd, DD MMMM YYYY [pukul] HH:mm') + ' WIB'
}

const getWaLink = (phone) => {
  if (!phone) return '#'
  let clean = phone.replace(/[^0-9]/g, '')
  if (clean.startsWith('0')) clean = '62' + clean.slice(1)
  return `https://wa.me/${clean}`
}

// ======================== MODAL: TAMBAH PEMBAYARAN ========================
const showPaymentModal = ref(false)
const isSubmittingPayment = ref(false)
const paymentForm = ref({
  amount: 0,
  payment_method: 'cash',
  notes: '',
})

const handlePaymentAmountInput = (e) => {
  const raw = e.target.value.replace(/[^0-9]/g, '')
  const val = raw ? Number(raw) : 0
  paymentForm.value.amount = Math.min(val, remainingAmount.value)
}

const openPaymentModal = () => {
  paymentForm.value = {
    amount: remainingAmount.value,
    payment_method: 'cash',
    notes: remainingAmount.value > 0 && remainingAmount.value === customTotal.value
      ? 'Pembayaran DP Booking'
      : 'Pelunasan sisa tagihan booking',
  }
  showPaymentModal.value = true
}

const submitPayment = async () => {
  if (paymentForm.value.amount <= 0) {
    triggerAlert('Gagal', 'Nominal pembayaran harus lebih dari 0', 'error')
    return
  }
  if (paymentForm.value.amount > remainingAmount.value) {
    triggerAlert('Gagal', 'Nominal pembayaran tidak boleh melebihi sisa tagihan', 'error')
    return
  }

  isSubmittingPayment.value = true
  try {
    await addBookingPayment(bookingId.value, {
      amount: Number(paymentForm.value.amount),
      payment_method: paymentForm.value.payment_method,
      notes: paymentForm.value.notes?.trim() || null,
    })
    triggerAlert('Berhasil', 'Pembayaran booking berhasil dicatat', 'success')
    showPaymentModal.value = false
    await loadBooking()
  } catch (error) {
    triggerAlert('Gagal', error.response?.data?.message || 'Gagal menyimpan pembayaran', 'error')
  } finally {
    isSubmittingPayment.value = false
  }
}

// ======================== MODAL: EKSEKUSI / TANDAI SELESAI ========================
const showExecuteModal = ref(false)
const isCheckingStock = ref(false)
const isExecuting = ref(false)
const stockCheckResult = ref(null)

const openExecuteModal = async () => {
  isCheckingStock.value = true
  showExecuteModal.value = true
  stockCheckResult.value = null

  try {
    const res = await checkBookingStock(bookingId.value)
    stockCheckResult.value = res
  } catch (error) {
    triggerAlert('Peringatan', 'Gagal memeriksa ketersediaan stok bahan', 'error')
    showExecuteModal.value = false
  } finally {
    isCheckingStock.value = false
  }
}

const confirmExecute = async () => {
  isExecuting.value = true
  try {
    await executeBooking(bookingId.value)
    triggerAlert('Pesanan Selesai!', 'Pesanan booking berhasil diselesaikan dan stok bahan baku telah dipotong.', 'success')
    showExecuteModal.value = false
    await loadBooking()
  } catch (error) {
    triggerAlert('Gagal Eksekusi', error.response?.data?.message || 'Gagal mengeksekusi pesanan', 'error')
  } finally {
    isExecuting.value = false
  }
}

// ======================== MODAL: BATALKAN BOOKING ========================
const showCancelModal = ref(false)
const isCancelling = ref(false)
const cancelForm = ref({
  cancel_reason: '',
  refund_amount: 0,
})

const openCancelModal = () => {
  cancelForm.value = {
    cancel_reason: '',
    refund_amount: 0,
  }
  showCancelModal.value = true
}

const submitCancel = async () => {
  if (!cancelForm.value.cancel_reason.trim()) {
    triggerAlert('Validasi Gagal', 'Alasan pembatalan booking wajib diisi', 'error')
    return
  }
  if (cancelForm.value.refund_amount < 0 || cancelForm.value.refund_amount > paidAmount.value) {
    triggerAlert('Validasi Gagal', 'Nominal pengembalian dana tidak valid', 'error')
    return
  }

  isCancelling.value = true
  try {
    await cancelBooking(bookingId.value, {
      cancel_reason: cancelForm.value.cancel_reason.trim(),
      refund_amount: Number(cancelForm.value.refund_amount),
    })
    triggerAlert('Booking Dibatalkan', 'Pesanan booking telah berhasil dibatalkan', 'success')
    showCancelModal.value = false
    await loadBooking()
  } catch (error) {
    triggerAlert('Gagal Membatalkan', error.response?.data?.message || 'Gagal membatalkan booking', 'error')
  } finally {
    isCancelling.value = false
  }
}

// ======================== CETAK STRUK THERMAL ========================
const isPrinting = ref(false)

const buildBookingReceiptLines = (b, payment = null) => {
  const lines = []

  // 1. Ambil custom layout struk toko dari pengaturan
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
    console.error('Failed to parse receipt layout', e)
  }

  // Pisahkan header blocks (sebelum info order) & footer blocks (setelah totals)
  const headerBlocks = []
  const footerBlocks = []
  let isHeader = true
  for (const block of layout) {
    if (block.type === 'static_order_info' || block.type === 'static_items') {
      isHeader = false
      continue
    }
    if (block.type === 'static_totals') {
      continue
    }
    if (isHeader) {
      headerBlocks.push(block)
    } else {
      footerBlocks.push(block)
    }
  }

  // Render Header Custom (Nama Outlet, Alamat, dll)
  let hasHeaderText = false
  headerBlocks.forEach((block) => {
    if (block.type === 'text' && block.content) {
      hasHeaderText = true
      const splitted = block.content.split('\n')
      splitted.forEach((txt) => {
        if (txt.trim()) {
          lines.push({
            type: 'center',
            text: txt.trim(),
            bold: block.bold || block.size === 'large',
          })
        }
      })
    }
  })

  if (!hasHeaderText) {
    lines.push({ type: 'center', text: 'KOPIREX', bold: true })
  }

  // Jika cetak KWITANSI PEMBAYARAN (payment ada)
  if (payment) {
    lines.push({ type: 'center', text: 'KWITANSI PEMBAYARAN', bold: true })
    lines.push({ type: 'separator', text: '=' })

    // 1. INFORMASI BUKTI PEMBAYARAN DULU
    lines.push({ type: 'row', left: 'No. Bukti:', right: payment.payment_number || '-', bold: true })
    lines.push({ type: 'row', left: 'Waktu Bayar:', right: dayjs(payment.paid_at).format('DD/MM/YYYY HH:mm') })
    lines.push({ type: 'row', left: 'Metode Bayar:', right: (payment.payment_method || 'CASH').toUpperCase() })
    if (payment.payment_type) {
      lines.push({ type: 'row', left: 'Jenis:', right: String(payment.payment_type).toUpperCase() })
    }
    lines.push({
      type: 'row',
      left: 'NOMINAL DIBAYAR:',
      right: formatRupiah(payment.amount),
      bold: true,
    })
    if (payment.notes) {
      lines.push({ type: 'label', text: `Catatan: ${payment.notes}` })
    }

    lines.push({ type: 'separator', text: '=' })

    // 2. INFORMASI PESANAN BOOKING DI BAWAHNYA
    lines.push({ type: 'label', text: 'INFORMASI PESANAN BOOKING:' })
    lines.push({ type: 'row', left: 'No. Booking:', right: b.booking_number || '-', bold: true })
    lines.push({ type: 'row', left: 'Waktu Pesan:', right: dayjs(b.created_at).format('DD/MM/YYYY HH:mm') })
    lines.push({ type: 'row', left: 'Pemesan:', right: b.customer_name || '-' })
    if (b.customer_phone) {
      lines.push({ type: 'row', left: 'No. HP/WA:', right: b.customer_phone })
    }
    lines.push({ type: 'row', left: 'Jadwal Acara:', right: dayjs(b.event_date).format('DD/MM/YYYY') })
    if (b.event_name) {
      lines.push({ type: 'row', left: 'Nama Acara:', right: b.event_name })
    }

    lines.push({ type: 'separator', text: '-' })
    lines.push({ type: 'label', text: 'MENU PESANAN:' })

    const finalTotal = customTotal.value
    const standardTotal = normalTotal.value
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

      lines.push({
        type: 'row',
        left: `${qty}x ${name}`,
        right: formatRupiah(itemSubtotal),
      })
    })

    lines.push({ type: 'separator', text: '-' })
    lines.push({
      type: 'row',
      left: 'Total Tagihan:',
      right: formatRupiah(finalTotal),
      bold: true,
    })
    lines.push({
      type: 'row',
      left: 'Sudah Dibayar:',
      right: formatRupiah(paidAmount.value),
    })
    lines.push({
      type: 'row',
      left: 'Sisa Tagihan:',
      right: remainingAmount.value > 0 ? formatRupiah(remainingAmount.value) : 'LUNAS',
      bold: true,
    })
  } else {
    // ================= STRUK PESANAN BOOKING BIASA =================
    lines.push({ type: 'center', text: 'STRUK PESANAN', bold: true })
    lines.push({ type: 'separator', text: '=' })

    // Informasi pesanan
    lines.push({ type: 'row', left: 'No. Booking:', right: b.booking_number || '-', bold: true })
    lines.push({ type: 'row', left: 'Waktu Pesan:', right: dayjs(b.created_at).format('DD/MM/YYYY HH:mm') })
    lines.push({ type: 'row', left: 'Pemesan:', right: b.customer_name || '-' })
    if (b.customer_phone) {
      lines.push({ type: 'row', left: 'No. HP/WA:', right: b.customer_phone })
    }
    lines.push({ type: 'row', left: 'Jadwal Acara:', right: dayjs(b.event_date).format('DD/MM/YYYY') })
    if (b.event_name) {
      lines.push({ type: 'row', left: 'Nama Acara:', right: b.event_name })
    }

    lines.push({ type: 'separator', text: '-' })
    lines.push({ type: 'label', text: 'MENU PESANAN:' })

    const finalTotal = customTotal.value
    const standardTotal = normalTotal.value
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

      lines.push({
        type: 'row',
        left: `${qty}x ${name}`,
        right: formatRupiah(itemSubtotal),
      })
      if (item.notes) {
        lines.push({ type: 'label', text: `  * ${item.notes}` })
      }
    })

    lines.push({ type: 'separator', text: '-' })
    lines.push({
      type: 'row',
      left: 'Total Tagihan:',
      right: formatRupiah(finalTotal),
      bold: true,
    })
    lines.push({
      type: 'row',
      left: 'Sudah Dibayar:',
      right: formatRupiah(paidAmount.value),
    })
    lines.push({
      type: 'row',
      left: 'Sisa Tagihan:',
      right: remainingAmount.value > 0 ? formatRupiah(remainingAmount.value) : 'LUNAS',
      bold: true,
    })
  }

  // Footer blocks dari pengaturan custom struk
  lines.push({ type: 'separator', text: '=' })
  let hasFooterText = false
  footerBlocks.forEach((block) => {
    if (block.type === 'text' && block.content) {
      hasFooterText = true
      const splitted = block.content.split('\n')
      splitted.forEach((txt) => {
        if (txt.trim()) {
          lines.push({
            type: 'center',
            text: txt.trim(),
            bold: !!block.bold,
          })
        }
      })
    }
  })

  if (!hasFooterText) {
    lines.push({ type: 'center', text: 'Terima kasih atas pesanan Anda!' })
  }

  lines.push({ type: 'center', text: 'Powered by Kasir Kopirex' })
  lines.push({ type: 'feed', lines: 2 })

  return lines
}

const handlePrintBookingReceipt = async (selectedPayment = null) => {
  if (!booking.value || isPrinting.value) return
  isPrinting.value = true
  try {
    const lines = buildBookingReceiptLines(booking.value, selectedPayment)
    const success = await printer.printShiftReceipt(lines)
    if (!success && printer.lastError?.value) {
      triggerAlert('Gagal Cetak', printer.lastError.value, 'error')
    }
  } catch (err) {
    console.error('Print Error:', err)
    triggerAlert('Gagal Cetak', 'Terjadi kesalahan saat mencetak struk thermal', 'error')
  } finally {
    isPrinting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-3 sm:px-4 space-y-4 sm:space-y-6 pb-16">
    <!-- Header: Responsive, Judul dan Tombol Tidak Terpotong di Mobile -->
    <header class="space-y-2.5">
      <div class="flex items-center justify-between gap-2.5">
        <div class="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            @click="router.push('/pos/bookings')"
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 active:scale-95"
            title="Kembali ke Daftar Booking"
          >
            <i class="pi pi-arrow-left text-sm" />
          </button>
          <div class="min-w-0">
            <h1 class="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-tight truncate">
              Detail Booking
            </h1>
            <p class="text-[11px] sm:text-xs text-slate-500 mt-0.5 truncate">
              Dibuat oleh <span class="font-bold text-slate-700">{{ booking?.creator?.name || 'Kasir' }}</span>
            </p>
          </div>
        </div>

        <!-- Tombol cetak struk: icon saja di pojok kanan atas -->
        <button
          v-if="booking"
          type="button"
          @click="handlePrintBookingReceipt()"
          :disabled="isPrinting"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95 transition"
          title="Cetak Struk Booking"
        >
          <i v-if="isPrinting" class="pi pi-spin pi-spinner text-sm" />
          <i v-else class="pi pi-print text-sm" />
        </button>
      </div>

      <!-- Quick Action Buttons: Rapih di mobile tanpa memotong judul -->
      <div
        v-if="booking && booking.status !== 'executed' && booking.status !== 'cancelled'"
        class="grid grid-cols-2 gap-2 sm:flex sm:justify-end"
      >
        <button
          type="button"
          @click="openExecuteModal"
          class="flex items-center justify-center rounded-xl bg-merchant-primary py-2 px-3 text-xs font-bold text-white shadow-sm hover:bg-merchant-primary/90 active:scale-95 transition"
        >
          Tandai Selesai
        </button>

        <button
          type="button"
          @click="openCancelModal"
          class="flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 py-2 px-3 text-xs font-bold text-rose-700 hover:bg-rose-100 active:scale-95 transition"
        >
          Batalkan
        </button>
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

    <div v-if="isLoading" class="flex flex-col items-center justify-center py-20 text-slate-400">
      <i class="pi pi-spin pi-spinner text-3xl text-merchant-primary mb-3" />
      <p class="text-sm font-medium">Memuat detail booking...</p>
    </div>

    <div v-else-if="booking" class="space-y-4 sm:space-y-6">
      <!-- Status Banner (Warna merchant-primary jika aktif, bukan hitam) -->
      <div
        class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl p-4 sm:p-5 border shadow-sm"
        :class="[
          booking.status === 'executed' ? 'bg-teal-50 border-teal-200 text-teal-900' : '',
          booking.status === 'cancelled' ? 'bg-rose-50 border-rose-200 text-rose-900' : '',
          booking.status !== 'executed' && booking.status !== 'cancelled' ? 'bg-merchant-primary text-white border-merchant-primary shadow-merchant-primary/10' : '',
        ]"
      >
        <div class="flex items-center gap-3">
          <div
            class="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl text-xl"
            :class="[
              booking.status === 'executed' ? 'bg-teal-600 text-white' : '',
              booking.status === 'cancelled' ? 'bg-rose-600 text-white' : '',
              booking.status !== 'executed' && booking.status !== 'cancelled' ? 'bg-white/20 text-white' : '',
            ]"
          >
            <i v-if="booking.status === 'executed'" class="pi pi-check" />
            <i v-else-if="booking.status === 'cancelled'" class="pi pi-times" />
            <i v-else class="pi pi-calendar" />
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-xs uppercase font-bold tracking-wider opacity-80">STATUS:</span>
              <span class="text-xs sm:text-sm font-black">
                {{
                  booking.status === 'executed' ? 'SELESAI (STOK TERPOTONG)' :
                  booking.status === 'cancelled' ? 'DIBATALKAN' :
                  (remainingAmount === 0 ? 'LUNAS (MENUNGGU EKSEKUSI)' : (paidAmount > 0 ? 'DP / BELUM LUNAS' : 'BELUM BAYAR'))
                }}
              </span>
            </div>
            <p class="text-xs opacity-90 mt-0.5">
              Jadwal: {{ formatEventDate(booking.event_date) }}
            </p>
          </div>
        </div>

        <div v-if="booking.status === 'cancelled'" class="text-xs sm:text-right">
          <p class="font-bold text-rose-700">Alasan: {{ booking.cancel_reason }}</p>
          <p v-if="booking.refund_amount > 0" class="mt-0.5 text-rose-600">
            Pengembalian: {{ formatRupiah(booking.refund_amount) }}
          </p>
        </div>
      </div>

      <!-- Grid 2 Kolom: Pelanggan & Ringkasan Keuangan -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <!-- Card 1: Informasi Pemesan (Nomor Booking di sini) -->
        <div class="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
          <h2 class="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-3">
            Informasi Pemesan
          </h2>

          <div class="mt-4 space-y-3 text-xs sm:text-sm">
            <div class="flex justify-between items-center">
              <span class="text-slate-500">No. Booking:</span>
              <span class="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-xs">
                {{ booking.booking_number }}
              </span>
            </div>
            <div v-if="booking.event_name" class="flex justify-between items-center">
              <span class="text-slate-500">Nama Acara:</span>
              <span class="font-bold text-slate-800">{{ booking.event_name }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-slate-500">Nama:</span>
              <span class="font-bold text-slate-900">{{ booking.customer_name }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-slate-500">No. WhatsApp / HP:</span>
              <div class="flex items-center gap-1.5">
                <span class="font-bold text-slate-900">{{ booking.customer_phone || '-' }}</span>
                <!-- Tombol chat WA: icon saja tanpa border dan bg -->
                <a
                  v-if="booking.customer_phone"
                  :href="getWaLink(booking.customer_phone)"
                  target="_blank"
                  rel="noopener"
                  class="text-emerald-600 hover:text-emerald-700 transition p-0.5 leading-none"
                  title="Hubungi via WhatsApp"
                >
                  <i class="pi pi-whatsapp text-lg" />
                </a>
              </div>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-slate-500">Email:</span>
              <span class="font-medium text-slate-700">{{ booking.customer_email || '-' }}</span>
            </div>
            <div class="border-t border-slate-100 pt-3">
              <span class="text-slate-500 block mb-1">Alamat Pengiriman:</span>
              <p class="font-medium text-slate-800 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                {{ booking.customer_address || 'Tidak ada alamat khusus (Diambil di outlet)' }}
              </p>
            </div>
            <div v-if="booking.notes" class="border-t border-slate-100 pt-3">
              <span class="text-slate-500 block mb-1">Catatan:</span>
              <p class="font-medium text-slate-700 italic bg-amber-50/50 p-2.5 rounded-xl border border-amber-100 text-xs">
                {{ booking.notes }}
              </p>
            </div>
          </div>
        </div>

        <!-- Card 2: Ringkasan Keuangan (Kata-kata rapi, tanpa kata 'kesepakatan') -->
        <div class="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h2 class="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-3">
              Ringkasan Keuangan
            </h2>

            <div class="mt-4 space-y-3 text-xs sm:text-sm">
              <div class="flex justify-between items-center">
                <span class="text-slate-500">Harga Katalog:</span>
                <span class="font-semibold text-slate-600">{{ formatRupiah(normalTotal) }}</span>
              </div>
              <div class="flex justify-between items-baseline">
                <span class="font-bold text-slate-900">Total Tagihan:</span>
                <span class="text-base sm:text-lg font-black text-slate-900">{{ formatRupiah(customTotal) }}</span>
              </div>

              <!-- Penyesuaian Harga (Diskon / Tambahan) -->
              <div v-if="normalTotal > customTotal" class="flex justify-between items-center text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
                <span class="font-bold">Potongan Harga:</span>
                <span class="font-black">-{{ formatRupiah(normalTotal - customTotal) }} ({{ Math.round(((normalTotal - customTotal) / (normalTotal || 1)) * 100) }}%)</span>
              </div>
              <div v-else-if="customTotal > normalTotal" class="flex justify-between items-center text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                <span class="font-bold">Biaya Tambahan:</span>
                <span class="font-black">+{{ formatRupiah(customTotal - normalTotal) }}</span>
              </div>

              <div class="flex justify-between items-center">
                <span class="text-slate-500">Sudah Terbayar:</span>
                <span class="font-bold text-emerald-600">{{ formatRupiah(paidAmount) }}</span>
              </div>

              <div class="flex justify-between items-center border-t border-slate-100 pt-3">
                <span class="font-bold text-slate-900">Sisa Tagihan:</span>
                <span
                  class="text-base font-black"
                  :class="remainingAmount > 0 ? 'text-rose-600' : 'text-emerald-600'"
                >
                  {{ remainingAmount > 0 ? formatRupiah(remainingAmount) : 'LUNAS' }}
                </span>
              </div>
            </div>

            <!-- Progress Bar -->
            <div class="mt-4">
              <div class="flex justify-between text-xs font-bold text-slate-500 mb-1">
                <span>Progres Pembayaran</span>
                <span>{{ paymentPercentage }}%</span>
              </div>
              <div class="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :class="paymentPercentage >= 100 ? 'bg-emerald-500' : 'bg-amber-500'"
                  :style="{ width: `${paymentPercentage}%` }"
                ></div>
              </div>
            </div>
          </div>

          <div v-if="remainingAmount > 0 && booking.status !== 'cancelled' && booking.status !== 'executed'" class="mt-4 sm:mt-5">
            <AppButton @click="openPaymentModal" class="w-full py-2.5 text-xs font-bold">
              Catat Pembayaran
            </AppButton>
          </div>
        </div>
      </div>

      <!-- Card 3: Daftar Menu Pesanan (Aksen warna merchant-primary pada label varian/add-on) -->
      <div class="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
        <h2 class="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-3">
          Menu Pesanan ({{ booking.items?.length || 0 }})
        </h2>

        <div class="mt-4 overflow-x-auto">
          <table class="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr class="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th class="pb-3">Menu</th>
                <th class="pb-3 text-center">Jumlah</th>
                <th class="pb-3 text-right">Harga Satuan</th>
                <th class="pb-3 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="item in booking.items" :key="item.id" class="text-slate-800">
                <td class="py-3">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <p class="font-bold text-slate-900">{{ item.product_name }}</p>
                    <!-- Aksen warna brand merchant-primary -->
                    <span
                      v-if="item.variant_label"
                      class="rounded-md bg-merchant-primary/10 border border-merchant-primary/20 px-2 py-0.5 text-[10px] font-bold text-merchant-primary"
                    >
                      {{ item.variant_label }}
                    </span>
                    <span
                      v-if="item.addons_label"
                      class="rounded-md bg-merchant-primary/10 border border-merchant-primary/20 px-2 py-0.5 text-[10px] font-bold text-merchant-primary"
                    >
                      + {{ item.addons_label }}
                    </span>
                  </div>
                  <p v-if="item.notes" class="text-xs text-slate-400 italic mt-0.5">
                    * {{ item.notes }}
                  </p>
                </td>
                <td class="py-3 text-center font-black">
                  {{ item.quantity }}
                </td>
                <td class="py-3 text-right text-slate-500">
                  {{ formatRupiah(item.unit_price) }}
                </td>
                <td class="py-3 text-right font-black text-slate-900">
                  {{ formatRupiah(item.subtotal) }}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="border-t border-slate-200 font-bold text-slate-900">
                <td colspan="3" class="pt-3 text-right">Total Standar Katalog:</td>
                <td class="pt-3 text-right font-black">{{ formatRupiah(normalTotal) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- Card 4: Riwayat Pembayaran -->
      <div class="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 class="text-xs font-black uppercase tracking-wider text-slate-400">
            Riwayat Pembayaran ({{ booking.payments?.length || 0 }})
          </h2>

          <button
            v-if="remainingAmount > 0 && booking.status !== 'cancelled' && booking.status !== 'executed'"
            type="button"
            @click="openPaymentModal"
            class="text-xs font-bold text-merchant-primary hover:underline"
          >
            + Tambah Pembayaran
          </button>
        </div>

        <div v-if="!booking.payments?.length" class="py-8 text-center text-xs text-slate-400">
          Belum ada pembayaran tercatat.
        </div>

        <div v-else class="mt-4 space-y-3">
          <div
            v-for="payment in booking.payments"
            :key="payment.id"
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3.5"
          >
            <div class="flex items-start gap-3">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <i class="pi pi-check text-xs font-bold" />
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-mono text-xs font-black text-slate-700">{{ payment.payment_number }}</span>
                  <span class="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                    {{ payment.payment_type }}
                  </span>
                  <span class="rounded bg-merchant-primary/10 border border-merchant-primary/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-merchant-primary">
                    {{ payment.payment_method }}
                  </span>
                </div>
                <p class="text-xs text-slate-500 mt-0.5">
                  {{ dayjs(payment.paid_at).format('DD MMM YYYY HH:mm') }} &bull; Diterima oleh {{ payment.receiver?.name || 'Kasir' }}
                </p>
                <p v-if="payment.notes" class="text-xs text-slate-600 italic mt-0.5">
                  "{{ payment.notes }}"
                </p>
              </div>
            </div>

            <div class="flex items-center justify-between sm:justify-end gap-3 shrink-0">
              <span class="text-sm font-black text-emerald-600">{{ formatRupiah(payment.amount) }}</span>
              <button
                type="button"
                @click="handlePrintBookingReceipt(payment)"
                class="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition shadow-sm active:scale-95"
                title="Cetak Kwitansi Pembayaran ini"
              >
                <i class="pi pi-print text-xs" />
                <span>Kwitansi</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== MODAL: TAMBAH PEMBAYARAN ==================== -->
    <AppModal
      :show="showPaymentModal"
      title="Catat Pembayaran Booking"
      @close="showPaymentModal = false"
    >
      <form @submit.prevent="submitPayment" class="space-y-4">
        <div class="rounded-xl bg-slate-50 p-3 text-xs">
          <div class="flex justify-between">
            <span class="text-slate-500">Total Tagihan:</span>
            <span class="font-bold text-slate-900">{{ formatRupiah(customTotal) }}</span>
          </div>
          <div class="flex justify-between mt-1">
            <span class="text-slate-500">Sudah Terbayar:</span>
            <span class="font-bold text-emerald-600">{{ formatRupiah(paidAmount) }}</span>
          </div>
          <div class="flex justify-between mt-1 border-t border-slate-200 pt-1 font-bold">
            <span class="text-slate-700">Sisa Tagihan:</span>
            <span class="text-rose-600">{{ formatRupiah(remainingAmount) }}</span>
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-700">
            Nominal Pembayaran (Rp) <span class="text-rose-500">*</span>
          </label>
          <div class="relative mt-1">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 font-black text-sm text-slate-400">Rp</span>
            <input
              :value="paymentForm.amount ? Number(paymentForm.amount).toLocaleString('id-ID') : ''"
              @input="handlePaymentAmountInput"
              type="text"
              inputmode="numeric"
              placeholder="0"
              required
              class="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-base font-black text-slate-900 focus:bg-white focus:border-merchant-primary focus:outline-none"
            />
          </div>
          <div class="mt-2 flex gap-2">
            <button
              type="button"
              @click="paymentForm.amount = remainingAmount"
              class="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200"
            >
              Bayar Lunas Sisa ({{ formatRupiah(remainingAmount) }})
            </button>
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-700">
            Metode Pembayaran <span class="text-rose-500">*</span>
          </label>
          <select
            v-model="paymentForm.payment_method"
            class="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:bg-white focus:border-merchant-primary focus:outline-none font-medium"
          >
            <option value="cash">Tunai (Cash)</option>
            <option value="qris">QRIS</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-700">
            Catatan Pembayaran
          </label>
          <input
            v-model="paymentForm.notes"
            type="text"
            placeholder="Contoh: Pembayaran termin ke-2"
            class="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-merchant-primary focus:outline-none"
          />
        </div>

        <div class="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            @click="showPaymentModal = false"
            class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            Batal
          </button>
          <AppButton
            type="submit"
            :disabled="isSubmittingPayment"
            class="px-5 py-2 text-xs font-bold"
          >
            <i v-if="isSubmittingPayment" class="pi pi-spin pi-spinner mr-1.5" />
            <span>{{ isSubmittingPayment ? 'Menyimpan...' : 'Simpan Pembayaran' }}</span>
          </AppButton>
        </div>
      </form>
    </AppModal>

    <!-- ==================== MODAL: EKSEKUSI / TANDAI SELESAI ==================== -->
    <AppModal
      :show="showExecuteModal"
      title="Selesaikan Pesanan Booking"
      @close="showExecuteModal = false"
    >
      <div v-if="isCheckingStock" class="py-10 text-center text-slate-400">
        <i class="pi pi-spin pi-spinner text-2xl text-merchant-primary mb-2" />
        <p class="text-xs font-medium">Memeriksa ketersediaan stok bahan baku di outlet...</p>
      </div>

      <div v-else-if="stockCheckResult" class="space-y-4">
        <!-- Stock status banner -->
        <div
          class="rounded-xl p-4 border"
          :class="stockCheckResult.is_safe ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'"
        >
          <div class="flex items-center gap-2">
            <i :class="['pi text-lg font-bold', stockCheckResult.is_safe ? 'pi-check-circle text-emerald-600' : 'pi-exclamation-triangle text-rose-600']" />
            <span class="font-black text-sm">
              {{ stockCheckResult.is_safe ? 'Stok Bahan Baku Mencukupi' : 'Peringatan: Stok Bahan Tidak Cukup!' }}
            </span>
          </div>
          <p class="text-xs mt-1 opacity-90">
            {{
              stockCheckResult.is_safe
                ? 'Seluruh bahan baku yang dibutuhkan tersedia di outlet.'
                : 'Terdapat bahan baku yang stok fisiknya kurang dari kebutuhan pesanan ini. Jika dilanjutkan, stok akan tercatat minus.'
            }}
          </p>
        </div>

        <!-- Deficit list if any -->
        <div v-if="stockCheckResult.insufficient_ingredients?.length" class="space-y-2">
          <p class="text-xs font-bold text-slate-700">Bahan yang Kurang:</p>
          <div class="max-h-36 overflow-y-auto space-y-1.5 rounded-xl border border-rose-100 bg-rose-50/50 p-2 text-xs">
            <div
              v-for="ing in stockCheckResult.insufficient_ingredients"
              :key="ing.ingredient_id"
              class="flex justify-between items-center text-rose-900"
            >
              <span class="font-bold">{{ ing.ingredient_name }}</span>
              <span>
                Tersedia: <b>{{ ing.current_stock }}</b> {{ ing.unit }} / Butuh: <b>{{ ing.required }}</b> {{ ing.unit }}
                <span class="text-rose-600 font-black ml-1">(Defisit {{ ing.deficit }})</span>
              </span>
            </div>
          </div>
        </div>

        <div class="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          <p class="font-bold text-slate-800 mb-0.5">Ketentuan:</p>
          <ul class="list-disc list-inside space-y-0.5">
            <li>Status pesanan berubah menjadi <b>Selesai</b>.</li>
            <li>Stok bahan baku di outlet akan <b>dipotong</b> otomatis.</li>
            <li>Tindakan ini tidak dapat dibatalkan.</li>
          </ul>
        </div>

        <div class="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            @click="showExecuteModal = false"
            class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            type="button"
            :disabled="isExecuting"
            @click="confirmExecute"
            class="rounded-xl px-5 py-2 text-xs font-bold text-white transition"
            :class="!stockCheckResult.is_safe ? 'bg-rose-600 hover:bg-rose-700' : 'bg-merchant-primary hover:bg-merchant-primary/90'"
          >
            <i v-if="isExecuting" class="pi pi-spin pi-spinner mr-1.5" />
            <span>{{ isExecuting ? 'Memproses...' : (!stockCheckResult.is_safe ? 'Tetap Selesaikan (Stok Minus)' : 'Konfirmasi Selesai') }}</span>
          </button>
        </div>
      </div>
    </AppModal>

    <!-- ==================== MODAL: BATALKAN BOOKING ==================== -->
    <AppModal
      :show="showCancelModal"
      title="Batalkan Pesanan Booking"
      @close="showCancelModal = false"
    >
      <form @submit.prevent="submitCancel" class="space-y-4">
        <div class="rounded-xl bg-rose-50 border border-rose-100 p-3 text-xs text-rose-900">
          <p class="font-bold mb-0.5">Perhatian:</p>
          <p>Membatalkan booking akan menghentikan proses pesanan. Silakan isi alasan pembatalan dan tentukan nominal refund jika ada.</p>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-700">
            Alasan Pembatalan <span class="text-rose-500">*</span>
          </label>
          <textarea
            v-model="cancelForm.cancel_reason"
            rows="2"
            required
            placeholder="Contoh: Acara diundur atau dibatalkan oleh pemesan"
            class="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:border-merchant-primary focus:outline-none"
          ></textarea>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-700">
            Nominal Pengembalian Dana / Refund (Rp)
          </label>
          <div class="relative mt-1">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 font-black text-sm text-slate-400">Rp</span>
            <input
              v-model="cancelForm.refund_amount"
              type="number"
              min="0"
              :max="paidAmount"
              class="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-base font-black text-slate-900 focus:bg-white focus:border-merchant-primary focus:outline-none"
            />
          </div>
          <p class="mt-1 text-[11px] text-slate-500">
            Total uang terbayar: <b>{{ formatRupiah(paidAmount) }}</b>. Isi <b>0</b> jika DP hangus / tanpa pengembalian dana.
          </p>
          <p v-if="cancelForm.refund_amount > 0" class="mt-1 text-[11px] font-bold text-amber-600">
            * Refund {{ formatRupiah(cancelForm.refund_amount) }} otomatis dicatat sebagai Pengeluaran Operasional.
          </p>
        </div>

        <div class="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            @click="showCancelModal = false"
            class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            Kembali
          </button>
          <button
            type="submit"
            :disabled="isCancelling"
            class="rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white hover:bg-rose-700 transition"
          >
            <i v-if="isCancelling" class="pi pi-spin pi-spinner mr-1.5" />
            <span>{{ isCancelling ? 'Membatalkan...' : 'Ya, Batalkan Booking' }}</span>
          </button>
        </div>
      </form>
    </AppModal>
  </div>
</template>
