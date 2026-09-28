<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import AppButton from '@/components/common/AppButton.vue'
import AppAlert from '@/components/common/AppAlert.vue'
import { fetchPosProducts } from '@/api/products'
import { createBooking } from '@/api/bookings'
import { formatRupiah } from '@/utils/currency'

const router = useRouter()

const isSubmitting = ref(false)
const isLoadingProducts = ref(false)
const products = ref([])
const productSearch = ref('')

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

// Form state
const form = ref({
  customer_name: '',
  customer_phone: '',
  customer_email: '',
  customer_address: '',
  event_name: '',
  event_date: dayjs().add(1, 'day').hour(10).minute(0).format('YYYY-MM-DDTHH:mm'),
  notes: '',
  custom_total: 0,
  has_dp: false,
  dp_amount: 0,
  dp_payment_method: 'transfer',
  dp_notes: '',
  items: [],
})

const isCustomTotalTouched = ref(false)

onMounted(async () => {
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

const addItem = (product) => {
  const existing = form.value.items.find(i => i.product_id === product.id)
  if (existing) {
    existing.quantity += 1
  } else {
    form.value.items.push({
      product_id: product.id,
      product_name: product.name,
      unit_price: Number(product.price || 0),
      quantity: 1,
      notes: '',
    })
  }

  // Update custom_total if user hasn't manually edited it
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

const onCustomTotalChange = () => {
  isCustomTotalTouched.value = true
  if (form.value.has_dp && form.value.dp_amount > form.value.custom_total) {
    form.value.dp_amount = form.value.custom_total
  }
}

const setPresetDp = (percent) => {
  const total = Number(form.value.custom_total || 0)
  form.value.dp_amount = Math.round((total * percent) / 100)
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
  if (!form.value.event_date) {
    triggerAlert('Validasi Gagal', 'Jadwal tanggal & waktu acara wajib ditentukan', 'error')
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
  if (form.value.has_dp) {
    if (Number(form.value.dp_amount) <= 0) {
      triggerAlert('Validasi Gagal', 'Nominal DP harus lebih dari Rp 0 jika mencentang pembayaran awal', 'error')
      return
    }
    if (Number(form.value.dp_amount) > Number(form.value.custom_total)) {
      triggerAlert('Validasi Gagal', 'Nominal DP tidak boleh melebihi total kesepakatan', 'error')
      return
    }
  }

  isSubmitting.value = true
  try {
    const payload = {
      customer_name: form.value.customer_name.trim(),
      customer_phone: form.value.customer_phone.trim(),
      customer_email: form.value.customer_email?.trim() || null,
      customer_address: form.value.customer_address?.trim() || null,
      event_name: form.value.event_name?.trim() || null,
      event_date: form.value.event_date.replace('T', ' ') + ':00',
      notes: form.value.notes?.trim() || null,
      custom_total: Number(form.value.custom_total),
      items: form.value.items.map(i => ({
        product_id: i.product_id,
        quantity: Number(i.quantity),
        notes: i.notes?.trim() || null,
      })),
    }

    if (form.value.has_dp && Number(form.value.dp_amount) > 0) {
      payload.dp_amount = Number(form.value.dp_amount)
      payload.dp_payment_method = form.value.dp_payment_method
      payload.dp_notes = form.value.dp_notes?.trim() || 'Pembayaran DP saat booking'
    }

    const created = await createBooking(payload)
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
  <div class="mx-auto max-w-5xl space-y-6 pb-16">
    <!-- Header -->
    <header class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <button
          type="button"
          @click="router.push('/pos/bookings')"
          class="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
        >
          <i class="pi pi-arrow-left text-sm" />
        </button>
        <div>
          <h1 class="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Buat Booking Baru</h1>
          <p class="text-xs md:text-sm text-slate-500">Pencatatan pesanan khusus wedding, katering, party, dan pesanan besar.</p>
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
      <!-- SECTION 1: INFORMASI PELANGGAN & ACARA -->
      <div class="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
        <h2 class="text-base font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
          <i class="pi pi-user text-merchant-primary" />
          <span>Informasi Pemesan & Acara</span>
        </h2>

        <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-700">
              Nama Pemesan <span class="text-rose-500">*</span>
            </label>
            <input
              v-model="form.customer_name"
              type="text"
              placeholder="Contoh: Sarah Angelina / Pak Budi"
              required
              class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-merchant-primary focus:outline-none focus:ring-1 focus:ring-merchant-primary"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700">
              No. Telepon / WhatsApp <span class="text-rose-500">*</span>
            </label>
            <input
              v-model="form.customer_phone"
              type="tel"
              placeholder="Contoh: 081234567890"
              required
              class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-merchant-primary focus:outline-none focus:ring-1 focus:ring-merchant-primary"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700">
              Nama Acara / Keperluan
            </label>
            <input
              v-model="form.event_name"
              type="text"
              placeholder="Contoh: Resepsi Pernikahan Sarah & Budi, Gathering Kantor"
              class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-merchant-primary focus:outline-none focus:ring-1 focus:ring-merchant-primary"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700">
              Tanggal & Waktu Acara <span class="text-rose-500">*</span>
            </label>
            <input
              v-model="form.event_date"
              type="datetime-local"
              required
              class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-merchant-primary focus:outline-none focus:ring-1 focus:ring-merchant-primary"
            />
          </div>

          <div class="md:col-span-2">
            <label class="block text-xs font-bold text-slate-700">
              Lokasi / Alamat Pengiriman Acara
            </label>
            <textarea
              v-model="form.customer_address"
              rows="2"
              placeholder="Contoh: Gedung Graha Sabha Pramana, Jl. Kaliurang KM 5"
              class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-merchant-primary focus:outline-none focus:ring-1 focus:ring-merchant-primary"
            ></textarea>
          </div>

          <div class="md:col-span-2">
            <label class="block text-xs font-bold text-slate-700">
              Catatan Tambahan
            </label>
            <input
              v-model="form.notes"
              type="text"
              placeholder="Contoh: Siapkan sebelum jam 09:30, include sedotan dan paper bag"
              class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-merchant-primary focus:outline-none focus:ring-1 focus:ring-merchant-primary"
            />
          </div>
        </div>
      </div>

      <!-- SECTION 2: MENU & PRODUK PESANAN -->
      <div class="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <h2 class="text-base font-black text-slate-900 flex items-center gap-2">
            <i class="pi pi-shopping-bag text-merchant-primary" />
            <span>Pilihan Menu & Produk Pesanan</span>
          </h2>

          <!-- Product search input -->
          <div class="relative w-full sm:w-64">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
            <input
              v-model="productSearch"
              type="text"
              placeholder="Cari menu di katalog..."
              class="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-merchant-primary focus:outline-none"
            />
          </div>
        </div>

        <!-- Quick product selector badges -->
        <div class="mt-3 flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-100">
          <button
            v-for="product in filteredProducts"
            :key="product.id"
            type="button"
            @click="addItem(product)"
            class="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm border border-slate-200 hover:border-merchant-primary hover:text-merchant-primary transition"
          >
            <i class="pi pi-plus text-[10px]" />
            <span>{{ product.name }}</span>
            <span class="font-mono text-slate-400">({{ formatRupiah(product.price) }})</span>
          </button>
          <div v-if="!filteredProducts.length" class="p-2 text-xs text-slate-400">
            Tidak ada produk yang cocok dengan pencarian.
          </div>
        </div>

        <!-- Ordered Items Table / List -->
        <div class="mt-4">
          <div v-if="!form.items.length" class="rounded-xl border border-dashed border-slate-200 py-8 text-center text-slate-400">
            <i class="pi pi-inbox text-2xl mb-1 text-slate-300" />
            <p class="text-xs font-bold text-slate-600">Belum ada menu yang dipilih</p>
            <p class="text-[11px] text-slate-400">Klik salah satu produk di atas untuk menambahkan ke pesanan booking</p>
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="(item, index) in form.items"
              :key="item.product_id"
              class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5"
            >
              <div class="flex-1 min-w-0">
                <p class="font-bold text-slate-900 text-sm">{{ item.product_name }}</p>
                <div class="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span>Harga normal: {{ formatRupiah(item.unit_price) }}</span>
                </div>
                <input
                  v-model="item.notes"
                  type="text"
                  placeholder="Catatan khusus menu ini (misal: less sugar / dingin)..."
                  class="mt-1.5 w-full max-w-md rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 placeholder-slate-400 focus:border-merchant-primary focus:outline-none"
                />
              </div>

              <!-- Quantity Controls & Subtotal -->
              <div class="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                <div class="flex items-center gap-1.5">
                  <button
                    type="button"
                    @click="updateItemQty(index, item.quantity - 1)"
                    class="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100"
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
                    class="flex h-8 w-8 items-center justify-center rounded-lg bg-merchant-primary text-white font-bold hover:bg-merchant-primary/90"
                  >
                    +
                  </button>
                </div>

                <div class="text-right min-w-[100px]">
                  <p class="text-xs text-slate-400">Subtotal</p>
                  <p class="text-sm font-black text-slate-900">{{ formatRupiah(item.unit_price * item.quantity) }}</p>
                </div>

                <button
                  type="button"
                  @click="removeItem(index)"
                  class="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                >
                  <i class="pi pi-trash text-sm" />
                </button>
              </div>
            </div>

            <!-- Subtotal Katalog Info -->
            <div class="flex justify-between items-center px-4 py-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">
              <span>Total Standar Katalog ({{ form.items.reduce((acc, i) => acc + Number(i.quantity), 0) }} porsi/cup):</span>
              <span class="font-mono text-sm text-slate-800">{{ formatRupiah(calculatedNormalTotal) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- SECTION 3: KESEPAKATAN HARGA (CUSTOM TOTAL) -->
      <div class="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
        <h2 class="text-base font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
          <i class="pi pi-tag text-merchant-primary" />
          <span>Harga Kesepakatan Booking (Custom Price)</span>
        </h2>

        <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div>
            <label class="block text-xs font-bold text-slate-700">
              Nominal Total yang Disepakati (Rp) <span class="text-rose-500">*</span>
            </label>
            <div class="relative mt-1.5">
              <span class="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-sm text-slate-400">Rp</span>
              <input
                v-model="form.custom_total"
                type="number"
                min="0"
                required
                class="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-lg font-black text-slate-900 focus:bg-white focus:border-merchant-primary focus:outline-none focus:ring-1 focus:ring-merchant-primary"
                @input="onCustomTotalChange"
              />
            </div>
            <p class="mt-1 text-[11px] text-slate-500">
              Bisa diatur lebih tinggi (biaya katering/ongkir/layanan) atau lebih rendah (diskon paket).
            </p>
          </div>

          <!-- Difference Badge -->
          <div class="rounded-xl border p-4" :class="[
            priceDiff > 0 ? 'bg-blue-50 border-blue-200 text-blue-800' : '',
            priceDiff < 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : '',
            priceDiff === 0 ? 'bg-slate-50 border-slate-200 text-slate-700' : '',
          ]">
            <p class="text-xs font-bold uppercase tracking-wider">Status Penyesuaian Harga:</p>
            <div class="mt-1 flex items-center gap-2">
              <span v-if="priceDiff > 0" class="text-sm font-black">
                + {{ formatRupiah(priceDiff) }} (Markup / Biaya Layanan Acara)
              </span>
              <span v-else-if="priceDiff < 0" class="text-sm font-black">
                - {{ formatRupiah(Math.abs(priceDiff)) }} (Diskon Khusus Borongan)
              </span>
              <span v-else class="text-sm font-black">
                Sesuai Harga Normal Katalog
              </span>
            </div>
            <p class="mt-1 text-[11px] opacity-80">
              Harga normal: {{ formatRupiah(calculatedNormalTotal) }} &rarr; Harga disepakati: {{ formatRupiah(form.custom_total) }}
            </p>
          </div>
        </div>
      </div>

      <!-- SECTION 4: PEMBAYARAN AWAL / DP -->
      <div class="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <div class="flex items-center gap-2">
            <i class="pi pi-wallet text-merchant-primary" />
            <span class="text-base font-black text-slate-900">Pembayaran Awal / Uang Muka (DP)</span>
          </div>

          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" v-model="form.has_dp" class="sr-only peer">
            <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-merchant-primary"></div>
            <span class="ml-3 text-xs font-bold text-slate-700">Terima DP Sekarang</span>
          </label>
        </div>

        <div v-if="form.has_dp" class="mt-4 space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-700">
                Nominal Pembayaran DP (Rp)
              </label>
              <div class="relative mt-1.5">
                <span class="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-sm text-slate-400">Rp</span>
                <input
                  v-model="form.dp_amount"
                  type="number"
                  min="1"
                  :max="form.custom_total"
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-11 pr-4 text-base font-black text-slate-900 focus:bg-white focus:border-merchant-primary focus:outline-none"
                />
              </div>

              <!-- Quick presets -->
              <div class="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  @click="setPresetDp(25)"
                  class="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200"
                >
                  DP 25%
                </button>
                <button
                  type="button"
                  @click="setPresetDp(50)"
                  class="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200"
                >
                  DP 50%
                </button>
                <button
                  type="button"
                  @click="setPresetDp(100)"
                  class="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200"
                >
                  Langsung Lunas (100%)
                </button>
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700">
                Metode Pembayaran DP
              </label>
              <select
                v-model="form.dp_payment_method"
                class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-merchant-primary focus:outline-none"
              >
                <option value="transfer">Transfer Bank (BCA / Mandiri / BNI / BRI)</option>
                <option value="qris">QRIS</option>
                <option value="cash">Tunai (Cash)</option>
                <option value="debit">Kartu Debit</option>
              </select>

              <div class="mt-3">
                <label class="block text-xs font-bold text-slate-700">
                  Catatan Pembayaran DP
                </label>
                <input
                  v-model="form.dp_notes"
                  type="text"
                  placeholder="Contoh: DP 50% via transfer BCA an Sarah"
                  class="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-merchant-primary focus:outline-none"
                />
              </div>
            </div>
          </div>

          <!-- DP Summary -->
          <div class="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-xs">
            <span class="font-bold text-emerald-800">Sisa Tagihan Setelah DP:</span>
            <span class="font-black text-sm text-emerald-900">
              {{ formatRupiah(Math.max(0, Number(form.custom_total) - Number(form.dp_amount))) }}
            </span>
          </div>
        </div>

        <div v-else class="mt-3 text-xs text-slate-400">
          Booking dapat dicatat terlebih dahulu tanpa pembayaran (status: Belum Bayar). Pembayaran DP atau pelunasan dapat ditambahkan kapan saja sebelum hari H.
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center justify-end gap-3 pt-4">
        <button
          type="button"
          @click="router.push('/pos/bookings')"
          class="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
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
          <span>{{ isSubmitting ? 'Menyimpan...' : 'Simpan & Buat Booking' }}</span>
        </AppButton>
      </div>
    </form>
  </div>
</template>
