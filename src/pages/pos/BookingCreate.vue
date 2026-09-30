<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import AppButton from '@/components/common/AppButton.vue'
import AppAlert from '@/components/common/AppAlert.vue'
import { fetchPosProducts } from '@/api/products'
import { createBooking } from '@/api/bookings'
import { formatRupiah } from '@/utils/currency'
import { useBookingStore } from '@/stores/booking.store'

const router = useRouter()
const bookingStore = useBookingStore()

const DRAFT_KEY = 'kopirex_pos_booking_draft'

const isSubmitting = ref(false)
const isLoadingProducts = ref(false)
const products = ref([])
const productSearch = ref('')
const hasDraft = ref(false)

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

// Tanggal & Waktu dibuat field terpisah
const eventDate = ref(dayjs().add(1, 'day').format('YYYY-MM-DD'))
const eventTime = ref('10:00')

// Form state
const form = ref({
  customer_name: '',
  customer_phone: '',
  customer_email: '',
  customer_address: '',
  event_name: '',
  notes: '',
  custom_total: 0,
  has_dp: false,
  dp_amount: 0,
  dp_payment_method: 'cash',
  dp_notes: '',
  items: [],
})

const isCustomTotalTouched = ref(false)

// Pulihkan draft jika ada tersimpan di localStorage
const loadDraft = () => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        form.value = {
          ...form.value,
          ...parsed,
          items: parsed.items || [],
        }
        if (form.value.dp_payment_method !== 'cash' && form.value.dp_payment_method !== 'qris') {
          form.value.dp_payment_method = 'cash'
        }
        if (parsed.event_date_only) eventDate.value = parsed.event_date_only
        if (parsed.event_time_only) eventTime.value = parsed.event_time_only
        if (parsed.isCustomTotalTouched !== undefined) {
          isCustomTotalTouched.value = parsed.isCustomTotalTouched
        }
        hasDraft.value = true
        syncAdjFromCustomTotal()
      }
    }
  } catch (e) {
    console.warn('Gagal memulihkan draft booking:', e)
  }
}

// Simpan draft otomatis saat ada perubahan form
let draftTimeout = null
watch(
  [form, eventDate, eventTime, isCustomTotalTouched],
  () => {
    clearTimeout(draftTimeout)
    draftTimeout = setTimeout(() => {
      try {
        const toSave = {
          ...form.value,
          event_date_only: eventDate.value,
          event_time_only: eventTime.value,
          isCustomTotalTouched: isCustomTotalTouched.value,
        }
        localStorage.setItem(DRAFT_KEY, JSON.stringify(toSave))
        hasDraft.value = true
      } catch (e) {}
    }, 400)
  },
  { deep: true }
)

const resetForm = () => {
  localStorage.removeItem(DRAFT_KEY)
  hasDraft.value = false
  eventDate.value = dayjs().add(1, 'day').format('YYYY-MM-DD')
  eventTime.value = '10:00'
  form.value = {
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    customer_address: '',
    event_name: '',
    notes: '',
    custom_total: 0,
    has_dp: false,
    dp_amount: 0,
    dp_payment_method: 'cash',
    dp_notes: '',
    items: [],
  }
  isCustomTotalTouched.value = false
  triggerAlert('Form Direset', 'Form booking berhasil dikosongkan.', 'info')
}

onMounted(async () => {
  loadDraft()

  isLoadingProducts.value = true
  try {
    const list = await fetchPosProducts()
    products.value = list || []
  } catch (error) {
    triggerAlert('Gagal', 'Gagal memuat katalog produk', 'error')
  } finally {
    isLoadingProducts.value = false
  }
})

const filteredProducts = computed(() => {
  if (!productSearch.value.trim()) return products.value
  const q = productSearch.value.toLowerCase()
  return products.value.filter(p =>
    p.name.toLowerCase().includes(q) ||
    (p.category?.name || '').toLowerCase().includes(q)
  )
})

const getProductPrice = (product) => {
  return Number(product.selling_price ?? product.price ?? 0)
}

const goToPosForMenu = () => {
  // Simpan draft terkini secara langsung sebelum berpindah
  try {
    const toSave = {
      ...form.value,
      event_date_only: eventDate.value,
      event_time_only: eventTime.value,
      isCustomTotalTouched: isCustomTotalTouched.value,
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(toSave))
    hasDraft.value = true
  } catch (e) {
    console.error('Gagal menyimpan draft booking:', e)
  }

  router.push('/pos?mode=booking')
}

const addItem = (product) => {
  const price = getProductPrice(product)
  const existing = form.value.items.find((i) => i.product_id === product.id && !i.variant_label)
  if (existing) {
    existing.quantity += 1
  } else {
    form.value.items.push({
      id: crypto.randomUUID(),
      product_id: product.id,
      product_name: product.name,
      variant_label: null,
      unit_price: price,
      quantity: 1,
      notes: '',
    })
  }

  // Update custom_total jika kasir belum mengubah manual
  if (!isCustomTotalTouched.value) {
    form.value.custom_total = calculatedNormalTotal.value
  }
}

const removeItem = (index) => {
  form.value.items.splice(index, 1)
  if (!isCustomTotalTouched.value) {
    form.value.custom_total = calculatedNormalTotal.value
  }
}

const updateItemQty = (index, qty) => {
  const val = parseInt(qty, 10)
  if (isNaN(val) || val <= 0) {
    removeItem(index)
  } else {
    form.value.items[index].quantity = val
    if (!isCustomTotalTouched.value) {
      form.value.custom_total = calculatedNormalTotal.value
    }
  }
}

const calculatedNormalTotal = computed(() => {
  return form.value.items.reduce((sum, item) => sum + (Number(item.unit_price) * Number(item.quantity)), 0)
})

const priceDiff = computed(() => {
  return Number(form.value.custom_total || 0) - calculatedNormalTotal.value
})

const adjDirection = ref('-')
const adjPercent = ref('')

const syncAdjFromCustomTotal = () => {
  if (!calculatedNormalTotal.value || Number(form.value.custom_total) === calculatedNormalTotal.value) {
    adjPercent.value = ''
    return
  }
  const diff = Number(form.value.custom_total || 0) - calculatedNormalTotal.value
  if (diff < 0) {
    adjDirection.value = '-'
    const pct = (Math.abs(diff) / calculatedNormalTotal.value) * 100
    adjPercent.value = Math.round(pct * 10) / 10
  } else if (diff > 0) {
    adjDirection.value = '+'
    const pct = (diff / calculatedNormalTotal.value) * 100
    adjPercent.value = Math.round(pct * 10) / 10
  }
}

const handleCustomTotalInput = (e) => {
  isCustomTotalTouched.value = true
  const raw = e.target.value.replace(/[^0-9]/g, '')
  form.value.custom_total = raw ? Number(raw) : 0
  if (form.value.has_dp && form.value.dp_amount > form.value.custom_total) {
    form.value.dp_amount = form.value.custom_total
  }
  syncAdjFromCustomTotal()
}

const onAdjPercentInput = (e) => {
  isCustomTotalTouched.value = true
  const valStr = e.target.value.replace(/[^0-9.]/g, '')
  adjPercent.value = valStr
  const p = parseFloat(valStr) || 0
  if (!calculatedNormalTotal.value) return

  const factor = adjDirection.value === '-' ? (1 - p / 100) : (1 + p / 100)
  form.value.custom_total = Math.max(0, Math.round(calculatedNormalTotal.value * factor))

  if (form.value.has_dp && form.value.dp_amount > form.value.custom_total) {
    form.value.dp_amount = form.value.custom_total
  }
}

const setAdjustmentDirection = (dir) => {
  adjDirection.value = dir
  const p = parseFloat(adjPercent.value) || 0
  if (p > 0 && calculatedNormalTotal.value) {
    isCustomTotalTouched.value = true
    const factor = dir === '-' ? (1 - p / 100) : (1 + p / 100)
    form.value.custom_total = Math.max(0, Math.round(calculatedNormalTotal.value * factor))
    if (form.value.has_dp && form.value.dp_amount > form.value.custom_total) {
      form.value.dp_amount = form.value.custom_total
    }
  }
}

const resetAdjustment = () => {
  adjPercent.value = ''
  resetToNormalPrice()
}

const resetToNormalPrice = () => {
  isCustomTotalTouched.value = false
  form.value.custom_total = calculatedNormalTotal.value
  adjPercent.value = ''
  if (form.value.has_dp && form.value.dp_amount > form.value.custom_total) {
    form.value.dp_amount = form.value.custom_total
  }
}

// Preset DP
const setPresetDp = (percent) => {
  const total = Number(form.value.custom_total || 0)
  if (percent === 0) {
    form.value.dp_amount = 0
    form.value.has_dp = false
  } else {
    form.value.has_dp = true
    form.value.dp_amount = Math.round((total * percent) / 100)
  }
}

const handleDpAmountInput = (e) => {
  const raw = e.target.value.replace(/[^0-9]/g, '')
  const val = raw ? Number(raw) : 0
  const maxTotal = Number(form.value.custom_total || 0)
  form.value.dp_amount = maxTotal > 0 ? Math.min(val, maxTotal) : val
  form.value.has_dp = form.value.dp_amount > 0
}

const isPresetActive = (percent) => {
  const total = Number(form.value.custom_total || 0)
  if (percent === 0) return Number(form.value.dp_amount || 0) === 0
  if (total <= 0) return false
  const target = Math.round((total * percent) / 100)
  return Number(form.value.dp_amount || 0) === target
}

const handleSubmit = async () => {
  if (!form.value.customer_name.trim()) {
    triggerAlert('Validasi Gagal', 'Nama pemesan wajib diisi', 'error')
    return
  }
  if (!form.value.customer_phone.trim()) {
    triggerAlert('Validasi Gagal', 'Nomor telepon pemesan wajib diisi', 'error')
    return
  }
  if (!eventDate.value) {
    triggerAlert('Validasi Gagal', 'Tanggal acara wajib ditentukan', 'error')
    return
  }
  if (!eventTime.value) {
    triggerAlert('Validasi Gagal', 'Waktu / jam acara wajib ditentukan', 'error')
    return
  }
  if (!form.value.items.length) {
    triggerAlert('Validasi Gagal', 'Minimal tambahkan 1 produk ke dalam pesanan booking', 'error')
    return
  }
  if (Number(form.value.custom_total) <= 0) {
    triggerAlert('Validasi Gagal', 'Total kesepakatan harga harus lebih dari Rp 0', 'error')
    return
  }

  const combinedDateTime = `${eventDate.value} ${eventTime.value}:00`

  const dpAmount = Number(form.value.dp_amount || 0)
  if (dpAmount > Number(form.value.custom_total)) {
    triggerAlert('Validasi Gagal', 'Nominal DP tidak boleh melebihi total kesepakatan', 'error')
    return
  }

  isSubmitting.value = true
  try {
    const payload = {
      customer_name: form.value.customer_name.trim(),
      customer_phone: form.value.customer_phone.trim(),
      customer_email: form.value.customer_email?.trim() || null,
      customer_address: form.value.customer_address?.trim() || null,
      event_name: form.value.event_name?.trim() || null,
      event_date: combinedDateTime,
      notes: form.value.notes?.trim() || null,
      custom_total: Number(form.value.custom_total),
      items: form.value.items.map(i => ({
        product_id: i.product_id,
        product_name: i.product_name,
        variant_label: i.variant_label || null,
        unit_price: Number(i.unit_price),
        quantity: Number(i.quantity),
        notes: i.notes?.trim() || null,
      })),
    }

    if (dpAmount > 0) {
      payload.has_dp = true
      payload.dp_amount = dpAmount
      payload.dp_payment_method = form.value.dp_payment_method
      payload.dp_notes = form.value.dp_notes?.trim() || 'Pembayaran DP saat booking'
    } else {
      payload.has_dp = false
      payload.dp_amount = 0
    }

    const created = await createBooking(payload)
    
    // Hapus draft setelah berhasil disimpan
    localStorage.removeItem(DRAFT_KEY)
    hasDraft.value = false

    // Update counter store
    bookingStore.fetchCounts()

    triggerAlert('Berhasil!', 'Pesanan booking berhasil dibuat.', 'success')
    setTimeout(() => {
      router.push(`/pos/bookings/${created.id}`)
    }, 800)
  } catch (error) {
    triggerAlert('Gagal Menyimpan', error.response?.data?.message || 'Terjadi kesalahan saat membuat booking', 'error')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6 pb-20">
    <!-- Header -->
    <header class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
      <div class="flex items-center gap-3">
        <button
          type="button"
          @click="router.push('/pos/bookings')"
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 active:scale-95 shadow-sm"
          title="Kembali ke Daftar Booking"
        >
          <i class="pi pi-arrow-left text-sm" />
        </button>
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <h1 class="text-lg sm:text-xl font-black text-slate-900 tracking-tight">Buat Booking Baru</h1>
          </div>
        </div>
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

    <form @submit.prevent="handleSubmit" class="space-y-6">
      <!-- SECTION 1: INFORMASI PEMESAN & ACARA -->
      <div class="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
        <h2 class="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">

          <span>Informasi Pemesan & Acara</span>
        </h2>

        <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Nama Pemesan -->
          <div>
            <label class="block text-xs font-bold text-slate-700">
              Nama Pemesan <span class="text-rose-500">*</span>
            </label>
            <input
              v-model="form.customer_name"
              type="text"
              placeholder="Contoh: Sarah Angelina / Pak Budi"
              required
              class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:bg-white focus:border-merchant-primary focus:outline-none focus:ring-1 focus:ring-merchant-primary"
            />
          </div>

          <!-- No. Telepon -->
          <div>
            <label class="block text-xs font-bold text-slate-700">
              No. Telepon / WhatsApp <span class="text-rose-500">*</span>
            </label>
            <input
              v-model="form.customer_phone"
              type="tel"
              placeholder="Contoh: 081234567890"
              required
              class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:bg-white focus:border-merchant-primary focus:outline-none focus:ring-1 focus:ring-merchant-primary"
            />
          </div>

          <!-- Nama Acara / Keperluan -->
          <div>
            <label class="block text-xs font-bold text-slate-700">
              Nama Acara / Keperluan
            </label>
            <input
              v-model="form.event_name"
              type="text"
              placeholder="Contoh: Resepsi Pernikahan Sarah & Budi, Gathering Kantor"
              class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:bg-white focus:border-merchant-primary focus:outline-none focus:ring-1 focus:ring-merchant-primary"
            />
          </div>

          <!-- TANGGAL & WAKTU ACARA (FIELD TERPISAH) -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700">
                Tanggal Acara <span class="text-rose-500">*</span>
              </label>
              <input
                v-model="eventDate"
                type="date"
                required
                class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 transition focus:bg-white focus:border-merchant-primary focus:outline-none focus:ring-1 focus:ring-merchant-primary font-medium"
              />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700">
                Waktu / Jam <span class="text-rose-500">*</span>
              </label>
              <input
                v-model="eventTime"
                type="time"
                required
                class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 transition focus:bg-white focus:border-merchant-primary focus:outline-none focus:ring-1 focus:ring-merchant-primary font-medium"
              />
            </div>
          </div>

          <!-- Lokasi / Alamat Pengiriman -->
          <div class="md:col-span-2">
            <label class="block text-xs font-bold text-slate-700">
              Lokasi / Alamat Pengiriman Acara
            </label>
            <textarea
              v-model="form.customer_address"
              rows="2"
              placeholder="Contoh: Gedung Graha Sabha Pramana, Jl. Kaliurang KM 5"
              class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:bg-white focus:border-merchant-primary focus:outline-none focus:ring-1 focus:ring-merchant-primary"
            ></textarea>
          </div>

          <!-- Catatan Tambahan -->
          <div class="md:col-span-2">
            <label class="block text-xs font-bold text-slate-700">
              Catatan Tambahan
            </label>
            <input
              v-model="form.notes"
              type="text"
              placeholder="Contoh: Siapkan sebelum jam 09:30, include sedotan dan paper bag"
              class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:bg-white focus:border-merchant-primary focus:outline-none focus:ring-1 focus:ring-merchant-primary"
            />
          </div>
        </div>
      </div>

      <!-- SECTION 2: PILIHAN MENU & PRODUK PESANAN -->
      <div class="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 class="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
              <span>Produk Pesanan</span>
            </h2>
          </div>

          <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <!-- Product search input -->
            <div class="relative w-full sm:w-56">
              <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
              <input
                v-model="productSearch"
                type="text"
                placeholder="Cari menu di katalog..."
                class="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 transition focus:bg-white focus:border-merchant-primary focus:outline-none"
              />
            </div>

            <!-- Tombol Buka Kasir untuk Pilih Varian & Add-on -->
            <button
              type="button"
              @click="goToPosForMenu"
              class="flex items-center justify-center gap-2 rounded-xl bg-merchant-primary hover:bg-merchant-primary/90 px-3.5 py-1.5 text-xs text-white shadow-sm transition active:scale-95 shrink-0"
              title="Buka halaman kasir untuk memilih produk lengkap dengan varian dan add-on"
            >
              <span>{{ form.items.length ? 'Pilih Menu dari Kasir' : 'Pilih Menu dari Kasir' }}</span>
              <i class="pi pi-arrow-right text-[10px]" />
            </button>
          </div>
        </div>

        <!-- Quick product selector badges -->
        <div class="mt-3 flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 bg-slate-50/70 rounded-xl border border-slate-100">
          <button
            v-for="product in filteredProducts"
            :key="product.id"
            type="button"
            @click="addItem(product)"
            class="flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm border border-slate-200 hover:border-merchant-primary hover:text-merchant-primary transition active:scale-95"
          >
            <i class="pi pi-plus text-[10px] text-merchant-primary font-bold" />
            <span class="font-bold text-slate-800">{{ product.name }}</span>
            <span class="font-mono text-merchant-primary font-bold">
              {{ formatRupiah(getProductPrice(product)) }}
            </span>
          </button>
          <div v-if="!filteredProducts.length" class="p-2 text-xs text-slate-400">
            {{ isLoadingProducts ? 'Memuat katalog produk...' : 'Tidak ada produk yang cocok dengan pencarian.' }}
          </div>
        </div>

        <!-- Ordered Items Table / List -->
        <div class="mt-4">
          <div v-if="!form.items.length" class="rounded-xl border border-dashed border-slate-200 py-8 px-4 text-center text-slate-400 bg-slate-50/50">
            <i class="pi pi-inbox text-3xl mb-2 text-slate-300 block" />
            <p class="text-xs font-bold text-slate-700">Belum ada menu yang dipilih</p>
            <p class="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
              Pilih menu dari tombol cepat di atas, atau klik tombol di bawah untuk memilih lewat kasir lengkap dengan pilihan rasa, level gula, &amp; add-on.
            </p>
            <button
              type="button"
              @click="goToPosForMenu"
              class="mt-3.5 inline-flex items-center gap-2 rounded-xl bg-merchant-primary border border-blue-200 text-white hover:bg-merchant-primary/80 px-4 py-2 text-xs font-black transition active:scale-95"
            >
              <i class="pi pi-th-large text-xs" />
              <span>Buka Menu Kasir untuk Memilih Produk</span>
            </button>
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="(item, index) in form.items"
              :key="item.id || (item.product_id + '-' + index)"
              class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-slate-50/40 p-3 sm:p-3.5 transition hover:border-slate-300"
            >
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <p class="font-bold text-slate-900 text-sm">{{ item.product_name }}</p>
                  <span
                    v-if="item.variant_label"
                    class="rounded-md bg-merchant-primary/10   border border-merchant-primary/20 px-2 py-0.5 text-[11px] font-bold text-merchant-primary/80"
                  >
                    {{ item.variant_label }}
                  </span>
                  <span class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600">
                    {{ formatRupiah(item.unit_price) }} / item
                  </span>
                </div>
                <input
                  v-model="item.notes"
                  type="text"
                  placeholder="Catatan menu (misal: less sugar / dingin / kemasan khusus)..."
                  class="mt-1.5 w-full max-w-md rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 placeholder-slate-400 focus:border-merchant-primary focus:outline-none"
                />
              </div>

              <!-- Quantity Controls & Subtotal -->
              <div class="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                <div class="flex items-center gap-1.5">
                  <button
                    type="button"
                    @click="updateItemQty(index, item.quantity - 1)"
                    class="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 transition active:scale-95"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    :value="item.quantity"
                    @focus="$event.target.select()"
                    @change="updateItemQty(index, $event.target.value)"
                    class="h-8 w-14 rounded-lg border border-slate-200 bg-white text-center font-black text-sm text-slate-900 focus:border-merchant-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    @click="updateItemQty(index, item.quantity + 1)"
                    class="flex h-8 w-8 items-center justify-center rounded-lg bg-merchant-primary text-white font-bold hover:bg-merchant-primary/90 transition active:scale-95"
                  >
                    +
                  </button>
                </div>

                <div class="text-right min-w-[95px]">
                  <p class="text-[10px] uppercase font-bold text-slate-400">Subtotal</p>
                  <p class="text-sm font-black text-slate-900">{{ formatRupiah(item.unit_price * item.quantity) }}</p>
                </div>

                <button
                  type="button"
                  @click="removeItem(index)"
                  class="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition"
                  title="Hapus menu dari booking"
                >
                  <i class="pi pi-trash text-sm" />
                </button>
              </div>
            </div>

            <!-- Subtotal Standar Katalog & Link Ubah di Kasir -->
            <div class="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 px-4 py-2.5 bg-slate-100/80 rounded-xl text-xs font-bold text-slate-700 border border-slate-200">
              <span class="flex items-center gap-1.5">
                <i class="pi pi-calculator text-slate-400" />
                <span>Nominal Total ({{ form.items.reduce((acc, i) => acc + Number(i.quantity), 0) }} porsi/cup):</span>
              </span>
              <div class="flex items-center justify-between sm:justify-end gap-3">
                <span class="font-mono text-sm font-black text-slate-900">{{ formatRupiah(calculatedNormalTotal) }}</span>
                <button
                  type="button"
                  @click="goToPosForMenu"
                  class="inline-flex items-center gap-1 text-[11px] font-bold text-merchant-primary hover:text-merchant-primary/90 underline underline-offset-2"
                >
                  <i class="pi pi-pencil text-[10px]" />
                  <span>Atur di Kasir</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- SECTION 3: KESEPAKATAN HARGA (CUSTOM TOTAL) -->
      <div class="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 class="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
            <span>Penyesuaian Harga</span>
          </h2>

          <button
            v-if="isCustomTotalTouched && form.custom_total !== calculatedNormalTotal"
            type="button"
            @click="resetToNormalPrice"
            class="text-xs font-bold text-merchant-primary hover:underline flex items-center gap-1"
          >
            <i class="pi pi-sync text-[10px]" />
            <span>Gunakan Harga Normal</span>
          </button>
        </div>

        <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div>
            <label class="block text-xs font-bold text-slate-700">
              Nominal Total<span class="text-rose-500">*</span>
            </label>
            <div class="relative mt-1.5">
              <span class="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-sm text-slate-400">Rp</span>
              <input
                :value="form.custom_total ? Number(form.custom_total).toLocaleString('id-ID') : (form.custom_total === 0 ? '0' : '')"
                @input="handleCustomTotalInput"
                type="text"
                inputmode="numeric"
                placeholder="0"
                required
                class="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-lg font-black text-slate-900 transition focus:bg-white focus:border-merchant-primary focus:outline-none focus:ring-1 focus:ring-merchant-primary"
              />
            </div>            <!-- Shortcut Penyesuaian Persentase Fleksibel -->
            <div class="mt-2.5 flex items-center gap-1.5 flex-wrap">
              <span class="text-[11px] font-bold text-slate-500 shrink-0">Penyesuaian:</span>
              <div class="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1">
                <!-- Tombol Minus (Diskon) -->
                <button
                  type="button"
                  @click="setAdjustmentDirection('-')"
                  class="rounded-lg px-2.5 py-1 text-xs font-black transition active:scale-95 flex items-center gap-1"
                  :class="adjDirection === '-' && (adjPercent || Number(adjPercent) > 0)
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-200/70'"
                  title="Diskon (Mengurangi Harga Normal)"
                >
                  <span>− Diskon</span>
                </button>

                <!-- Tombol Plus (Markup/Tambahan) -->
                <button
                  type="button"
                  @click="setAdjustmentDirection('+')"
                  class="rounded-lg px-2.5 py-1 text-xs font-black transition active:scale-95 flex items-center gap-1"
                  :class="adjDirection === '+' && (adjPercent || Number(adjPercent) > 0)
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-200/70'"
                  title="Tambahan Profit / Biaya Khusus (Menambah Harga Normal)"
                >
                  <span>+ Tambahan</span>
                </button>

                <!-- Input Angka Persen Bebas -->
                <div class="flex items-center bg-white rounded-lg border border-slate-200 px-2 py-0.5 focus-within:border-merchant-primary">
                  <input
                    :value="adjPercent"
                    @input="onAdjPercentInput"
                    type="text"
                    inputmode="decimal"
                    placeholder="0"
                    class="w-12 text-center text-xs font-black text-slate-900 outline-none"
                    title="Ketik persentase penyesuaian (+ atau -)"
                  />
                  <span class="text-xs font-bold text-slate-400 select-none">%</span>
                </div>

                <!-- Tombol Reset / Normal (0%) -->
                <button
                  type="button"
                  @click="resetAdjustment"
                  class="rounded-lg px-2 py-1 text-xs font-bold transition active:scale-95 ml-0.5"
                  :class="!adjPercent || Number(adjPercent) === 0
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-200/70'"
                  title="Kembalikan ke harga normal katalog (0%)"
                >
                  Normal
                </button>
              </div>
            </div>
          </div>

          <!-- Analisis & Status Penyesuaian Harga -->
          <div
            class="rounded-xl border p-4 transition-all"
            :class="[
              priceDiff < 0 ? 'bg-amber-50/70 border-amber-200 text-amber-900' : '',
              priceDiff > 0 ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : '',
              priceDiff === 0 ? 'bg-slate-50 border-slate-200 text-slate-700' : '',
            ]"
          >
            <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Ringkasan Penyesuaian Harga:</p>
            
            <!-- Kasus: Harga Kesepakatan di bawah Normal (Diskon) -->
            <div v-if="priceDiff < 0" class="mt-1.5">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="rounded-lg bg-amber-200/70 px-2 py-0.5 text-xs font-black text-amber-900">
                  Diskon Booking
                </span>
                <span class="text-base font-black text-amber-900">
                  - {{ formatRupiah(Math.abs(priceDiff)) }}
                </span>
                <span class="text-xs font-bold text-amber-700">
                  ({{ Math.round((Math.abs(priceDiff) / (calculatedNormalTotal || 1)) * 100) }}%)
                </span>
              </div>
            </div>

            <!-- Kasus: Harga Kesepakatan di atas Normal (Keuntungan Tambahan) -->
            <div v-else-if="priceDiff > 0" class="mt-1.5">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="rounded-lg bg-emerald-200/70 px-2 py-0.5 text-xs font-black text-emerald-900">
                  Profit Tambahan
                </span>
                <span class="text-base font-black text-emerald-900">
                  + {{ formatRupiah(priceDiff) }}
                </span>
              </div>
            </div>

            <!-- Kasus: Harga Sesuai Normal Katalog -->
            <div v-else class="mt-1.5">
              <div class="flex items-center gap-2">
                <span class="rounded-lg bg-slate-200 px-2 py-0.5 text-xs font-black text-slate-700">
                  Harga Normal
                </span>
                <span class="text-sm font-black text-slate-800">
                  {{ formatRupiah(calculatedNormalTotal) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- SECTION 4: PEMBAYARAN AWAL / DP -->
      <div class="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 class="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
            <span>Pembayaran Awal</span>
          </h2>

        </div>

        <div class="mt-4 space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-700">
                Nominal Pembayaran DP (Rp)
              </label>
              <div class="relative mt-1.5">
                <span class="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-sm text-slate-400">Rp</span>
                <input
                  :value="form.dp_amount ? Number(form.dp_amount).toLocaleString('id-ID') : (form.dp_amount === 0 ? '0' : '')"
                  @input="handleDpAmountInput"
                  type="text"
                  inputmode="numeric"
                  placeholder="0"
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-11 pr-4 text-base font-black text-slate-900 transition focus:bg-white focus:border-merchant-primary focus:outline-none"
                />
              </div>

              <!-- Quick presets (Termasuk Belum Bayar / Belum DP) -->
              <div class="mt-2.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  @click="setPresetDp(0)"
                  class="rounded-xl px-3 py-1.5 text-xs font-bold transition border"
                  :class="isPresetActive(0) ? 'bg-slate-800 text-white border-slate-800 shadow-sm' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'"
                >
                  Belum Bayar (DP Rp 0)
                </button>
                <button
                  type="button"
                  @click="setPresetDp(25)"
                  class="rounded-xl px-3 py-1.5 text-xs font-bold transition border"
                  :class="isPresetActive(25) ? 'bg-merchant-primary text-white border-merchant-primary shadow-sm' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'"
                >
                  DP 25%
                </button>
                <button
                  type="button"
                  @click="setPresetDp(50)"
                  class="rounded-xl px-3 py-1.5 text-xs font-bold transition border"
                  :class="isPresetActive(50) ? 'bg-merchant-primary text-white border-merchant-primary shadow-sm' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'"
                >
                  DP 50%
                </button>
                <button
                  type="button"
                  @click="setPresetDp(100)"
                  class="rounded-xl px-3 py-1.5 text-xs font-bold transition border"
                  :class="isPresetActive(100) ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'"
                >
                  Lunas (100%)
                </button>
              </div>
            </div>

            <!-- Bagian Metode & Catatan Pembayaran jika ada DP -->
            <div v-if="form.dp_amount > 0" class="space-y-3">
              <div>
                <label class="block text-xs font-bold text-slate-700">
                  Metode Pembayaran DP
                </label>
                <select
                  v-model="form.dp_payment_method"
                  class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-merchant-primary focus:outline-none font-medium"
                >
                  <option value="cash">Tunai (Cash)</option>
                  <option value="qris">QRIS</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700">
                  Catatan Pembayaran DP
                </label>
                <input
                  v-model="form.dp_notes"
                  type="text"
                  placeholder="Contoh: DP via transfer BCA an Sarah"
                  class="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-merchant-primary focus:outline-none"
                />
              </div>
            </div>

            <!-- Informasi jika Belum Bayar / DP 0 -->
            <div v-else class="flex flex-col justify-center rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
              <div class="flex items-center gap-2 font-bold text-slate-700 mb-1">
                <i class="pi pi-info-circle text-slate-500" />
                <span>Status: Belum Ada Pembayaran Awal</span>
              </div>
            </div>
          </div>

          <!-- DP Summary Card -->
          <div
            v-if="form.dp_amount > 0"
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs"
          >
            <div class="flex items-center gap-4">
              <div>
                <span class="text-[10px] uppercase font-bold text-emerald-700">Total Tagihan:</span>
                <p class="font-black text-sm text-emerald-950">{{ formatRupiah(form.custom_total) }}</p>
              </div>
              <div>
                <span class="text-[10px] uppercase font-bold text-emerald-700">DP Dibayar:</span>
                <p class="font-black text-sm text-emerald-700">{{ formatRupiah(form.dp_amount) }}</p>
              </div>
            </div>

            <div class="sm:text-right border-t sm:border-t-0 border-emerald-200/60 pt-2 sm:pt-0">
              <span class="text-[10px] uppercase font-bold text-emerald-800">Sisa Tagihan:</span>
              <p class="font-black text-base text-emerald-900">
                {{ formatRupiah(Math.max(0, Number(form.custom_total) - Number(form.dp_amount))) }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center justify-end    gap-3 pt-2">
        <button
          type="button"
          @click="router.push('/pos/bookings')"
          class="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition active:scale-95 shadow-sm"
        >
          Batal
        </button>
        <AppButton
          type="submit"
          :disabled="isSubmitting"
          class="px-8 py-3 text-sm font-bold shadow-md shadow-merchant-primary/20"
        >
          <i v-if="isSubmitting" class="pi pi-spin pi-spinner mr-2" />
          <i v-else class="pi pi-check mr-2" />
          <span>{{ isSubmitting ? 'Menyimpan...' : 'Buat Booking' }}</span>
        </AppButton>
      </div>
    </form>
  </div>
</template>
