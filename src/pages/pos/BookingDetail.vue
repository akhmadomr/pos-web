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

dayjs.extend(relativeTime)
dayjs.locale('id')

const route = useRoute()
const router = useRouter()
const printer = usePrinter()

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
  loadBooking()
})

const remainingAmount = computed(() => {
  if (!booking.value) return 0
  return Math.max(0, Number(booking.value.custom_total) - Number(booking.value.paid_amount))
})

const paymentPercentage = computed(() => {
  if (!booking.value || !booking.value.custom_total) return 0
  return Math.min(100, Math.round((Number(booking.value.paid_amount) / Number(booking.value.custom_total)) * 100))
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
  payment_method: 'transfer',
  notes: '',
})

const openPaymentModal = () => {
  paymentForm.value = {
    amount: remainingAmount.value,
    payment_method: 'transfer',
    notes: remainingAmount.value > 0 && remainingAmount.value === Number(booking.value.custom_total)
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
  if (cancelForm.value.refund_amount < 0 || cancelForm.value.refund_amount > booking.value.paid_amount) {
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

// ======================== CETAK STRUK ========================
const handlePrintBookingReceipt = async (selectedPayment = null) => {
  if (!booking.value) return

  const receiptData = {
    order_number: booking.value.booking_number,
    order_type: 'BOOKING - ' + (booking.value.event_name || 'Acara'),
    customer_name: booking.value.customer_name,
    customer_phone: booking.value.customer_phone,
    timestamp: dayjs().format('DD/MM/YYYY HH:mm'),
    event_date: formatEventDate(booking.value.event_date),
    subtotal: booking.value.normal_total,
    custom_total: booking.value.custom_total,
    total_amount: booking.value.custom_total,
    paid_amount: booking.value.paid_amount,
    remaining_amount: remainingAmount.value,
    payment_method: selectedPayment ? selectedPayment.payment_method : 'Multi-Payment',
    payment_receipt: selectedPayment ? {
      number: selectedPayment.payment_number,
      amount: selectedPayment.amount,
      type: selectedPayment.payment_type,
      date: dayjs(selectedPayment.paid_at).format('DD/MM/YYYY HH:mm'),
    } : null,
    items: (booking.value.items || []).map(i => ({
      name: i.product_name,
      qty: i.quantity,
      unit_price: Number(i.unit_price),
      total: Number(i.subtotal),
      notes: i.notes,
    })),
  }

  // Use browser print fallback dialog
  printReceiptHtml(receiptData)
}

const printReceiptHtml = (data) => {
  const printWindow = window.open('', '_blank', 'width=400,height=600')
  if (!printWindow) {
    alert('Pop-up terblokir. Izinkan pop-up untuk mencetak struk.')
    return
  }

  const itemsHtml = data.items.map(i => `
    <div style="display:flex; justify-content:space-between; margin-bottom: 2px;">
      <span>${i.qty}x ${i.name}</span>
      <span>${formatRupiah(i.total)}</span>
    </div>
    ${i.notes ? `<div style="font-size:10px; color:#666; margin-bottom:4px; padding-left:8px;">* ${i.notes}</div>` : ''}
  `).join('')

  const paymentInfoHtml = data.payment_receipt ? `
    <div style="background:#f4f4f4; padding:6px; margin: 8px 0; border-radius:4px;">
      <div style="font-weight:bold; font-size:11px;">BUKTI PEMBAYARAN: ${data.payment_receipt.number}</div>
      <div style="display:flex; justify-content:space-between;">
        <span>Nominal Dibayar:</span>
        <span style="font-weight:bold;">${formatRupiah(data.payment_receipt.amount)}</span>
      </div>
      <div style="font-size:10px; color:#555;">Tipe: ${data.payment_receipt.type.toUpperCase()} | ${data.payment_receipt.date}</div>
    </div>
  ` : ''

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Struk Booking - ${data.order_number}</title>
      <style>
        body { font-family: 'Courier New', monospace; font-size: 12px; margin: 10px; color: #111; line-height: 1.3; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .line { border-top: 1px dashed #444; margin: 6px 0; }
        .row { display: flex; justify-content: space-between; }
      </style>
    </head>
    <body>
      <div class="center bold" style="font-size:16px;">KOPIREX</div>
      <div class="center" style="font-size:10px;">BUKTI BOOKING & KATERING</div>
      <div class="line"></div>
      <div class="row"><span>No. Booking:</span><span class="bold">${data.order_number}</span></div>
      <div class="row"><span>Pemesan:</span><span>${data.customer_name}</span></div>
      <div class="row"><span>Kontak:</span><span>${data.customer_phone || '-'}</span></div>
      <div class="row"><span>Jadwal:</span><span>${data.event_date}</span></div>
      <div class="line"></div>
      <div class="bold" style="margin-bottom:4px;">DAFTAR MENU PESANAN:</div>
      ${itemsHtml}
      <div class="line"></div>
      <div class="row"><span>Total Normal:</span><span>${formatRupiah(data.subtotal)}</span></div>
      <div class="row bold" style="font-size:13px;"><span>Total Kesepakatan:</span><span>${formatRupiah(data.custom_total)}</span></div>
      <div class="row"><span>Total Terbayar:</span><span class="bold" style="color:green;">${formatRupiah(data.paid_amount)}</span></div>
      <div class="row bold" style="color:${data.remaining_amount > 0 ? '#b91c1c' : '#15803d'};">
        <span>Sisa Tagihan:</span><span>${formatRupiah(data.remaining_amount)}</span>
      </div>
      ${paymentInfoHtml}
      <div class="line"></div>
      <div class="center" style="font-size:10px; margin-top:8px;">
        Terima kasih atas pesanan Anda di Kopirex.<br/>
        Harap simpan struk ini sebagai bukti pemesanan yang sah.
      </div>
      <script>
        window.onload = function() {
          window.print();
        };
      <\/script>
    </body>
    </html>
  `

  printWindow.document.write(html)
  printWindow.document.close()
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6 pb-16">
    <!-- Header -->
    <header class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <button
          type="button"
          @click="router.push('/pos/bookings')"
          class="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
        >
          <i class="pi pi-arrow-left text-sm" />
        </button>
        <div>
          <div class="flex items-center gap-2">
            <span class="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-mono font-black text-slate-700">
              {{ booking?.booking_number || 'Loading...' }}
            </span>
            <h1 class="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              {{ booking?.event_name || 'Detail Booking' }}
            </h1>
          </div>
          <p class="text-xs md:text-sm text-slate-500 mt-0.5">
            Dibuat oleh <span class="font-bold text-slate-700">{{ booking?.creator?.name || 'Kasir' }}</span>
          </p>
        </div>
      </div>

      <!-- Quick Action Buttons -->
      <div v-if="booking" class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          @click="handlePrintBookingReceipt()"
          class="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition"
        >
          <i class="pi pi-print" />
          <span>Cetak Struk Booking</span>
        </button>

        <button
          v-if="remainingAmount > 0 && booking.status !== 'cancelled' && booking.status !== 'executed'"
          type="button"
          @click="openPaymentModal"
          class="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
        >
          <i class="pi pi-credit-card" />
          <span>Tambah Pembayaran</span>
        </button>

        <button
          v-if="booking.status !== 'executed' && booking.status !== 'cancelled'"
          type="button"
          @click="openExecuteModal"
          class="flex items-center gap-2 rounded-xl bg-merchant-primary px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-merchant-primary/90 transition"
        >
          <i class="pi pi-check-circle" />
          <span>Tandai Selesai (Eksekusi)</span>
        </button>

        <button
          v-if="booking.status !== 'executed' && booking.status !== 'cancelled'"
          type="button"
          @click="openCancelModal"
          class="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition"
        >
          <i class="pi pi-times" />
          <span>Batalkan</span>
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

    <div v-else-if="booking" class="space-y-6">
      <!-- Status Banner -->
      <div
        class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl p-4 md:p-5 border"
        :class="[
          booking.status === 'executed' ? 'bg-teal-50 border-teal-200 text-teal-900' : '',
          booking.status === 'cancelled' ? 'bg-rose-50 border-rose-200 text-rose-900' : '',
          booking.status !== 'executed' && booking.status !== 'cancelled' ? 'bg-slate-900 text-white border-slate-800' : '',
        ]"
      >
        <div class="flex items-center gap-3">
          <div
            class="flex h-12 w-12 items-center justify-center rounded-xl text-xl"
            :class="[
              booking.status === 'executed' ? 'bg-teal-600 text-white' : '',
              booking.status === 'cancelled' ? 'bg-rose-600 text-white' : '',
              booking.status !== 'executed' && booking.status !== 'cancelled' ? 'bg-merchant-primary text-white' : '',
            ]"
          >
            <i v-if="booking.status === 'executed'" class="pi pi-check" />
            <i v-else-if="booking.status === 'cancelled'" class="pi pi-times" />
            <i v-else class="pi pi-calendar" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs uppercase font-bold tracking-wider opacity-75">Status Pesanan:</span>
              <span class="text-sm font-black">
                {{
                  booking.status === 'executed' ? 'SELESAI DIPRODUKSI (STOK TERPOTONG)' :
                  booking.status === 'cancelled' ? 'DIBATALKAN' :
                  (booking.paid_amount >= booking.custom_total ? 'LUNAS (MENUNGGU WAKTU EKSEKUSI)' : 'DP / BELUM LUNAS')
                }}
              </span>
            </div>
            <p class="text-xs opacity-90 mt-0.5">
              Jadwal Acara: {{ formatEventDate(booking.event_date) }}
            </p>
          </div>
        </div>

        <div v-if="booking.status === 'cancelled'" class="text-xs sm:text-right">
          <p class="font-bold text-rose-700">Alasan: {{ booking.cancel_reason }}</p>
          <p v-if="booking.refund_amount > 0" class="mt-0.5 text-rose-600">
            Pengembalian Dana: {{ formatRupiah(booking.refund_amount) }}
          </p>
        </div>
      </div>

      <!-- Grid 2 Kolom: Pelanggan & Ringkasan Finansial -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Card 1: Informasi Pelanggan & Lokasi -->
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 class="text-sm font-black uppercase tracking-wider text-slate-400 flex items-center gap-2 border-b border-slate-100 pb-3">
            <i class="pi pi-user text-merchant-primary" />
            <span>Informasi Pemesan</span>
          </h2>

          <div class="mt-4 space-y-3 text-xs md:text-sm">
            <div class="flex justify-between">
              <span class="text-slate-500">Nama:</span>
              <span class="font-black text-slate-900">{{ booking.customer_name }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-slate-500">No. WhatsApp / HP:</span>
              <div class="flex items-center gap-2">
                <span class="font-bold text-slate-900">{{ booking.customer_phone || '-' }}</span>
                <a
                  v-if="booking.customer_phone"
                  :href="getWaLink(booking.customer_phone)"
                  target="_blank"
                  rel="noopener"
                  class="flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-600 hover:bg-emerald-100 transition"
                >
                  <i class="pi pi-whatsapp" />
                  <span>Chat WA</span>
                </a>
              </div>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Email:</span>
              <span class="font-bold text-slate-800">{{ booking.customer_email || '-' }}</span>
            </div>
            <div class="border-t border-slate-100 pt-3">
              <span class="text-slate-500 block mb-1">Lokasi / Alamat Pengiriman:</span>
              <p class="font-bold text-slate-800 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                {{ booking.customer_address || 'Tidak ada alamat khusus (Diambil di outlet)' }}
              </p>
            </div>
            <div v-if="booking.notes" class="border-t border-slate-100 pt-3">
              <span class="text-slate-500 block mb-1">Catatan Khusus:</span>
              <p class="font-medium text-slate-700 italic bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
                {{ booking.notes }}
              </p>
            </div>
          </div>
        </div>

        <!-- Card 2: Status Keuangan & Pelunasan -->
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h2 class="text-sm font-black uppercase tracking-wider text-slate-400 flex items-center gap-2 border-b border-slate-100 pb-3">
              <i class="pi pi-wallet text-merchant-primary" />
              <span>Ringkasan Keuangan</span>
            </h2>

            <div class="mt-4 space-y-3 text-xs md:text-sm">
              <div class="flex justify-between">
                <span class="text-slate-500">Harga Standar Katalog:</span>
                <span class="font-bold text-slate-600">{{ formatRupiah(booking.normal_total) }}</span>
              </div>
              <div class="flex justify-between items-baseline">
                <span class="font-bold text-slate-900">Total Kesepakatan:</span>
                <span class="text-lg font-black text-slate-900">{{ formatRupiah(booking.custom_total) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Total Sudah Dibayar:</span>
                <span class="font-bold text-emerald-600">{{ formatRupiah(booking.paid_amount) }}</span>
              </div>
              <div class="flex justify-between border-t border-slate-100 pt-3">
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

          <div v-if="remainingAmount > 0 && booking.status !== 'cancelled' && booking.status !== 'executed'" class="mt-5">
            <AppButton @click="openPaymentModal" class="w-full py-2.5 text-xs font-bold">
              + Catat Pembayaran / Pelunasan
            </AppButton>
          </div>
        </div>
      </div>

      <!-- Card 3: Daftar Item Pesanan -->
      <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 class="text-sm font-black uppercase tracking-wider text-slate-400 flex items-center gap-2 border-b border-slate-100 pb-3">
          <i class="pi pi-shopping-bag text-merchant-primary" />
          <span>Daftar Menu & Porsi Pesanan ({{ booking.items?.length || 0 }} Menu)</span>
        </h2>

        <div class="mt-4 overflow-x-auto">
          <table class="w-full text-left text-xs md:text-sm">
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
                  <p class="font-bold text-slate-900">{{ item.product_name }}</p>
                  <p v-if="item.notes" class="text-xs text-slate-400 italic mt-0.5">
                    * {{ item.notes }}
                  </p>
                </td>
                <td class="py-3 text-center font-black">
                  {{ item.quantity }} cup/porsi
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
              <tr class="border-t border-slate-200 font-black text-slate-900">
                <td colspan="3" class="pt-3 text-right">Total Standar Katalog:</td>
                <td class="pt-3 text-right">{{ formatRupiah(booking.normal_total) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- Card 4: Riwayat Pembayaran (Termin / Angsuran) -->
      <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 class="text-sm font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <i class="pi pi-history text-merchant-primary" />
            <span>Riwayat Pembayaran ({{ booking.payments?.length || 0 }} Transaksi)</span>
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
          Belum ada pembayaran yang tercatat untuk booking ini.
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
                  <span class="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-blue-700">
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
                class="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition shadow-sm"
                title="Cetak Kwitansi Pembayaran ini"
              >
                <i class="pi pi-print text-xs" />
                <span>Cetak Kwitansi</span>
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
            <span class="text-slate-500">Total Kesepakatan:</span>
            <span class="font-bold text-slate-900">{{ formatRupiah(booking?.custom_total) }}</span>
          </div>
          <div class="flex justify-between mt-1">
            <span class="text-slate-500">Sudah Terbayar:</span>
            <span class="font-bold text-emerald-600">{{ formatRupiah(booking?.paid_amount) }}</span>
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
              v-model="paymentForm.amount"
              type="number"
              min="1"
              :max="remainingAmount"
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
            class="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:bg-white focus:border-merchant-primary focus:outline-none"
          >
            <option value="transfer">Transfer Bank (BCA / Mandiri / BNI / BRI)</option>
            <option value="qris">QRIS</option>
            <option value="cash">Tunai (Cash)</option>
            <option value="debit">Kartu Debit</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-700">
            Catatan Pembayaran
          </label>
          <input
            v-model="paymentForm.notes"
            type="text"
            placeholder="Contoh: Pembayaran termin ke-2 via transfer"
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
      title="Selesaikan & Eksekusi Pesanan Booking"
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
                ? 'Seluruh bahan baku yang dibutuhkan untuk memproduksi pesanan booking ini tersedia di outlet.'
                : 'Terdapat bahan baku yang stok fisiknya kurang dari kebutuhan pesanan ini. Jika dilanjutkan, stok akan tercatat minus.'
            }}
          </p>
        </div>

        <!-- Deficit list if any -->
        <div v-if="stockCheckResult.insufficient_ingredients?.length" class="space-y-2">
          <p class="text-xs font-bold text-slate-700">Daftar Bahan yang Kurang:</p>
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
          <p class="font-bold text-slate-800 mb-0.5">Ketentuan Eksekusi Pesanan:</p>
          <ul class="list-disc list-inside space-y-0.5">
            <li>Status pesanan booking akan berubah menjadi <b>Selesai Dibuat (Executed)</b>.</li>
            <li>Stok bahan baku di outlet akan langsung <b>dipotong</b> secara otomatis.</li>
            <li>Tindakan ini permanen dan tidak dapat dibatalkan.</li>
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
          <AppButton
            type="button"
            :disabled="isExecuting"
            @click="confirmExecute"
            class="px-5 py-2 text-xs font-bold"
            :class="!stockCheckResult.is_safe ? 'bg-rose-600 hover:bg-rose-700' : ''"
          >
            <i v-if="isExecuting" class="pi pi-spin pi-spinner mr-1.5" />
            <i v-else class="pi pi-check mr-1.5" />
            <span>{{ isExecuting ? 'Memproses...' : (!stockCheckResult.is_safe ? 'Tetap Selesaikan (Stok Minus)' : 'Konfirmasi Selesai & Potong Stok') }}</span>
          </AppButton>
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
          <p>Membatalkan booking akan menghentikan proses pesanan. Silakan isi alasan pembatalan dan tentukan apakah ada uang DP yang dikembalikan (refund) ke pelanggan.</p>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-700">
            Alasan Pembatalan <span class="text-rose-500">*</span>
          </label>
          <textarea
            v-model="cancelForm.cancel_reason"
            rows="2"
            required
            placeholder="Contoh: Acara pernikahan diundur / dibatalkan oleh pemesan"
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
              :max="booking?.paid_amount"
              class="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-base font-black text-slate-900 focus:bg-white focus:border-merchant-primary focus:outline-none"
            />
          </div>
          <p class="mt-1 text-[11px] text-slate-500">
            Total uang yang sudah diterima: <b>{{ formatRupiah(booking?.paid_amount) }}</b>. Isi <b>0</b> jika DP hangus / tidak ada pengembalian uang.
          </p>
          <p v-if="cancelForm.refund_amount > 0" class="mt-1 text-[11px] font-bold text-amber-600">
            * Nominal refund sebesar {{ formatRupiah(cancelForm.refund_amount) }} akan otomatis dicatat sebagai Biaya Operasional (Pengeluaran).
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
