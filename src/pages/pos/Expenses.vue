<script setup>
import { computed, onMounted, ref } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import AppCreatableSelect from '@/components/common/AppCreatableSelect.vue'
import AppAlert from '@/components/common/AppAlert.vue'
import { fetchExpenses, addExpense, fetchExpenseCategories, fetchCriticalIngredients, requestEditExpense, requestCancelExpense } from '@/api/shifts'
import { formatRupiah } from '@/utils/currency'
import dayjs from 'dayjs'
import { db } from '@/utils/db'
import { idbGet, idbSet } from '@/utils/indexeddb'
import { enqueue, SYNC_TYPE } from '@/services/SyncService'
import { useAuthStore } from '@/stores/auth.store'

const authStore = useAuthStore()

const expenses = ref([])
const categories = ref([])
const loading = ref(false)
const loadingSubmit = ref(false)
const error = ref('')
const successMessage = ref('')

const form = ref({
  category: '',
  qty: 1,
  price_per_item: '',
})

const ingredients = ref([])

const selectedIngredient = computed(() => {
  return ingredients.value.find(i => i.name === form.value.category)
})

const totalExpenses = computed(() => {
  return expenses.value.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0)
})

const amountPreview = computed(() => {
  const qty = Number(form.value.qty) || 0
  const price = Number(String(form.value.price_per_item).replace(/\D/g, '')) || 0
  return qty * price
})

const isValid = computed(() => {
  return form.value.category && form.value.qty > 0 && amountPreview.value > 0
})

const filterSearch = ref('')
const sortBy = ref('time_desc')
const showFilters = ref(false)

const filteredExpenses = computed(() => {
  let list = [...expenses.value]
  
  if (filterSearch.value) {
    const q = filterSearch.value.toLowerCase()
    list = list.filter(e => e.category.toLowerCase().includes(q))
  }
  
  list.sort((a, b) => {
    if (sortBy.value === 'time_desc') return new Date(b.created_at) - new Date(a.created_at)
    if (sortBy.value === 'time_asc') return new Date(a.created_at) - new Date(b.created_at)
    if (sortBy.value === 'amount_desc') return Number(b.amount) - Number(a.amount)
    if (sortBy.value === 'amount_asc') return Number(a.amount) - Number(b.amount)
    return 0
  })
  
  return list
})

const loadData = async () => {
  loading.value = true
  error.value = ''
  try {
    const [expensesData, categoriesData, ingredientsData] = await Promise.all([
      fetchExpenses(),
      fetchExpenseCategories(),
      fetchCriticalIngredients(),
    ])
    expenses.value = expensesData
    categories.value = categoriesData.map((c) => ({ label: c, value: c }))
    ingredients.value = ingredientsData

    // Cache ke IDB untuk offline
    try {
      await idbSet('expense-categories', categoriesData)
      await idbSet('expense-ingredients', JSON.parse(JSON.stringify(ingredientsData)))
    } catch { /* silent */ }
  } catch (err) {
    const isNetworkError = !navigator.onLine || err?.message === 'Network Error' || err?.name === 'TypeError'
    if (isNetworkError) {
      // Offline: load dari IndexedDB
      try {
        const localExpenses = await db.expenses.toArray()
        expenses.value = localExpenses.map(e => ({
          id: e.local_id,
          category: e.category,
          amount: e.amount,
          qty: e.qty,
          price_per_item: e.price_per_item,
          created_at: e.created_at,
          is_offline: e.sync_status !== 'synced',
        }))
        // Load kategori & bahan baku dari IDB cache
        const cachedCategories = await idbGet('expense-categories')
        const cachedIngredients = await idbGet('expense-ingredients')
        if (cachedCategories) categories.value = cachedCategories.map(c => ({ label: c, value: c }))
        if (cachedIngredients) ingredients.value = cachedIngredients
      } catch { /* silent */ }
      error.value = ''
    } else {
      error.value = 'Gagal memuat data pengeluaran.'
    }
  } finally {
    loading.value = false
  }
}

const submitExpense = async () => {
  if (!isValid.value || loadingSubmit.value) return

  loadingSubmit.value = true
  error.value = ''
  successMessage.value = ''
  
  const payload = {
    category: form.value.category,
    qty: Number(form.value.qty),
    price_per_item: Number(String(form.value.price_per_item).replace(/\D/g, '')),
    amount: amountPreview.value,
  }

  try {
    const newExpense = await addExpense(payload)
    
    // Cache ke IndexedDB juga (saat online)
    const localId = 'exp_' + crypto.randomUUID()
    await db.expenses.put({
      local_id: localId,
      shift_local_id: authStore.shift?.local_id ?? authStore.shift?.id,
      ...payload,
      created_at: new Date().toISOString(),
      sync_status: 'synced',
    }).catch(() => {})

    expenses.value.unshift(newExpense)
    
    if (!categories.value.find(c => c.value === payload.category)) {
      categories.value.push({ label: payload.category, value: payload.category })
    }
    
    form.value.category = ''
    form.value.qty = 1
    form.value.price_per_item = ''
    successMessage.value = 'Pengeluaran berhasil dicatat!'
    setTimeout(() => successMessage.value = '', 3000)
    
  } catch (err) {
    const isNetworkError = !navigator.onLine || err?.message === 'Network Error' || err?.name === 'TypeError' || err?.code === 'ECONNABORTED' || (err?.response?.status >= 500)
    
    if (isNetworkError) {
      // Offline: simpan lokal dan masuk antrian
      const localId = 'exp_' + crypto.randomUUID()
      const offlineExpense = {
        local_id: localId,
        shift_local_id: authStore.shift?.local_id ?? authStore.shift?.id,
        ...payload,
        created_at: new Date().toISOString(),
        sync_status: 'pending',
      }
      await db.expenses.put(offlineExpense)
      await enqueue(SYNC_TYPE.EXPENSE, payload, localId)

      expenses.value.unshift({
        id: localId,
        ...payload,
        created_at: new Date().toISOString(),
        is_offline: true,
      })
      
      form.value.category = ''
      form.value.qty = 1
      form.value.price_per_item = ''
      successMessage.value = 'Pengeluaran disimpan offline. Akan tersinkron saat koneksi pulih.'
      setTimeout(() => successMessage.value = '', 4000)
    } else {
      error.value = err.response?.data?.message || 'Gagal menambahkan pengeluaran.'
    }
  } finally {
    loadingSubmit.value = false
  }
}

const cancelingExpense = ref(null)
const cancelReason = ref('')
const loadingCancel = ref(false)

const openCancelModal = (exp) => {
  cancelingExpense.value = exp
  cancelReason.value = ''
}

const submitCancel = async () => {
  if (!cancelReason.value) {
    error.value = 'Alasan pembatalan harus diisi.'
    return
  }
  
  loadingCancel.value = true
  try {
    await requestCancelExpense(cancelingExpense.value.id, cancelReason.value)
    successMessage.value = 'Pengajuan pembatalan berhasil dikirim. Silahkan tunggu admin.'
    cancelingExpense.value = null
    loadData()
  } catch (err) {
    error.value = err.response?.data?.message || 'Gagal mengajukan pembatalan.'
  } finally {
    loadingCancel.value = false
  }
}

const editingExpense = ref(null)
const editReason = ref('')
const editData = ref({ amount: '', qty: 1, price_per_item: '' })
const loadingEdit = ref(false)

const openEditModal = (exp) => {
  editingExpense.value = exp
  editReason.value = ''
  editData.value = { 
    amount: exp.amount, 
    qty: exp.qty, 
    price_per_item: exp.price_per_item 
  }
}

const submitEdit = async () => {
  if (!editReason.value) {
    error.value = 'Alasan edit harus diisi.'
    return
  }
  
  loadingEdit.value = true
  try {
    await requestEditExpense(editingExpense.value.id, {
      reason: editReason.value,
      amount: Number(editData.value.amount),
      category: editingExpense.value.category,
      qty: Number(editData.value.qty),
      price_per_item: Number(editData.value.amount) / Number(editData.value.qty)
    })
    successMessage.value = 'Pengajuan edit berhasil dikirim. Silahkan tunggu admin.'
    editingExpense.value = null
    loadData()
  } catch (err) {
    error.value = err.response?.data?.message || 'Gagal mengajukan edit.'
  } finally {
    loadingEdit.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="flex h-[calc(100vh-5.5rem)] min-h-[500px] flex-col lg:h-[calc(100vh-10.5rem)] pb-20 lg:pb-0">
    <div class="mb-3 md:mb-4">
      <h2 class="text-lg md:text-xl font-black text-slate-900">Pengeluaran Shift</h2>
      <p class="text-xs md:text-sm text-slate-500">Catat pengeluaran operasional selama shift berlangsung.</p>
    </div>
    
    <AppAlert v-if="error" type="error" :message="error" class="mb-4" dismissible @dismiss="error = ''" />
    <AppAlert v-if="successMessage" type="success" :message="successMessage" class="mb-4" dismissible @dismiss="successMessage = ''" />

    <div class="grid flex-1 gap-4 md:gap-6 min-h-0 lg:grid-cols-5">
      <!-- Form Input -->
      <section class="flex flex-col min-h-0 lg:col-span-2">
        <div class="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
          <h3 class="mb-3 md:mb-4 text-[10px] md:text-sm font-bold uppercase tracking-wider text-slate-400">Tambah Pengeluaran</h3>
          
          <div class="space-y-3 md:space-y-4">
            <div>
              <label class="mb-1 block text-[10px] md:text-xs font-bold uppercase tracking-wider text-slate-500">Nama Pengeluaran</label>
              <AppCreatableSelect
                v-model="form.category"
                :options="categories"
                placeholder="Pilih atau ketik nama..."
              />
            </div>
            
            <div class="flex gap-3 md:gap-4">
              <div class="w-20 md:w-24">
                <label class="mb-1 block text-[10px] md:text-xs font-bold uppercase tracking-wider text-slate-500">Qty</label>
                <div class="relative">
                  <input
                    v-model="form.qty"
                    type="number"
                    min="0.01"
                    step="0.01"
                    class="w-full rounded-xl border border-slate-200 px-2 md:px-3 py-2 md:py-2.5 text-center text-xs md:text-sm font-medium focus:border-merchant-primary focus:outline-none focus:ring-2 focus:ring-merchant-primary/20"
                    :class="{ 'pr-8': selectedIngredient }"
                  />
                  <span v-if="selectedIngredient" class="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] md:text-xs font-bold text-slate-400">
                    {{ selectedIngredient.unit }}
                  </span>
                </div>
              </div>
              <div class="flex-1">
                <label class="mb-1 block text-[10px] md:text-xs font-bold uppercase tracking-wider text-slate-500">Harga Satuan</label>
                <div class="relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs md:text-sm font-bold text-slate-400">Rp</span>
                  <input
                    v-model="form.price_per_item"
                    type="text"
                    class="w-full rounded-xl border border-slate-200 py-2 md:py-2.5 pl-8 md:pl-10 pr-3 md:pr-4 text-xs md:text-sm font-medium focus:border-merchant-primary focus:outline-none focus:ring-2 focus:ring-merchant-primary/20"
                    placeholder="0"
                    @input="form.price_per_item = form.price_per_item.replace(/\D/g, '')"
                  />
                </div>
              </div>
            </div>
            
            <div class="rounded-xl bg-slate-50 p-3 md:p-4 border border-slate-100 flex items-center justify-between">
              <span class="text-xs md:text-sm font-bold text-slate-500">Total Harga</span>
              <span class="text-base md:text-lg font-black text-merchant-primary">{{ formatRupiah(amountPreview) }}</span>
            </div>
            
            <AppButton
              class="w-full mt-2"
              variant="primary"
              :disabled="!isValid"
              :loading="loadingSubmit"
              @click="submitExpense"
            >
              <i class="pi pi-plus text-xs md:text-base" /> <span class="text-sm">Simpan Pengeluaran</span>
            </AppButton>
          </div>
        </div>
      </section>

      <!-- History List -->
      <section class="flex flex-col min-h-0 lg:col-span-3">
        <div class="flex flex-col h-full rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div class="border-b border-slate-100 p-3 md:p-4 flex items-center justify-between bg-slate-50/50">
            <h3 class="text-[10px] md:text-sm font-bold uppercase tracking-wider text-slate-400">Riwayat Pengeluaran</h3>
            <span class="text-xs md:text-sm font-bold text-slate-900">Total: {{ formatRupiah(totalExpenses) }}</span>
          </div>

          <div class="border-b border-slate-100 p-3 flex flex-col gap-3 bg-white">
            <div class="flex gap-2">
              <div class="relative flex-1">
                <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                <input
                  v-model="filterSearch"
                  type="text"
                  placeholder="Cari pengeluaran..."
                  class="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-xs focus:border-merchant-primary focus:outline-none focus:ring-1 focus:ring-merchant-primary"
                />
              </div>
              <button
                @click="showFilters = !showFilters"
                class="flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                :class="{ 'bg-slate-100': showFilters }"
              >
                <i class="pi pi-filter" />
                <span class="hidden sm:inline">Filter</span>
              </button>
            </div>
            
            <div v-show="showFilters" class="flex flex-wrap gap-2">
              <select v-model="sortBy" class="rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:border-merchant-primary focus:outline-none flex-1 min-w-[120px]">
                <option value="time_desc">Terbaru</option>
                <option value="time_asc">Terlama</option>
                <option value="amount_desc">Harga Tertinggi</option>
                <option value="amount_asc">Harga Terendah</option>
              </select>
            </div>
          </div>
          
          <div class="flex-1 overflow-y-auto p-3 md:p-4 relative">
            <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
              <i class="pi pi-spin pi-spinner text-2xl md:text-3xl text-merchant-primary" />
            </div>
            
            <div v-if="filteredExpenses.length" class="space-y-2 md:space-y-3">
              <div v-for="exp in filteredExpenses" :key="exp.id" class="flex items-center justify-between rounded-xl border border-slate-100 p-3 md:p-4 hover:bg-slate-50 transition">
                <div class="flex flex-col gap-0.5 md:gap-1">
                  <span class="text-sm md:text-base font-bold text-slate-900">{{ exp.category }}</span>
                  <div class="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs text-slate-500">
                    <span>{{ exp.qty }} x {{ formatRupiah(exp.price_per_item) }}</span>
                    <span class="w-1 h-1 rounded-full bg-slate-300"></span>
                    <span>{{ dayjs(exp.created_at).format('HH:mm') }}</span>
                  </div>
                </div>
                <div class="flex flex-col items-end gap-2">
                  <span class="text-sm md:text-base font-black text-rose-500">{{ formatRupiah(exp.amount) }}</span>
                  <div class="flex gap-2" v-if="!exp.edit_status">
                    <button @click="openEditModal(exp)" class="flex flex-1 items-center justify-center rounded-xl bg-amber-50 px-3 py-1.5 text-[10px] font-bold text-amber-600 transition hover:bg-amber-100 active:scale-95" title="Ajukan Edit">
                      <i class="pi pi-pencil sm:mr-1" /> <span class="hidden sm:inline">Edit</span>
                    </button>
                    <button @click="openCancelModal(exp)" class="flex flex-1 items-center justify-center rounded-xl bg-rose-50 px-3 py-1.5 text-[10px] font-bold text-rose-600 transition hover:bg-rose-100 active:scale-95" title="Ajukan Batal">
                      <i class="pi pi-trash sm:mr-1" /> <span class="hidden sm:inline">Batal</span>
                    </button>
                  </div>
                  <span v-else class="text-[10px] font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 uppercase">
                    Menunggu Review
                  </span>
                </div>
              </div>
            </div>
            
            <div v-else-if="!loading" class="flex h-full flex-col items-center justify-center text-slate-400 p-8 text-center">
              <i class="pi pi-inbox text-4xl mb-3 opacity-20" />
              <p class="font-medium">Tidak ada pengeluaran yang sesuai.</p>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- Modal Pengajuan Batal -->
    <div v-if="cancelingExpense" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="cancelingExpense = null"></div>
      <div class="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 class="mb-2 text-xl font-black text-rose-600">Pengajuan Batal Pengeluaran</h3>
        <p class="mb-4 text-sm text-slate-500">
          Pengeluaran <strong>{{ cancelingExpense?.category }}</strong>. Masukkan alasan pembatalan. Permintaan ini harus disetujui oleh admin.
        </p>
        <textarea
          v-model="cancelReason"
          rows="3"
          placeholder="Alasan batal..."
          class="mb-4 w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-merchant-primary focus:ring-merchant-primary"
        ></textarea>
        <div class="flex gap-3">
          <button @click="cancelingExpense = null" class="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-600 hover:bg-slate-200">
            Tutup
          </button>
          <AppButton
            variant="primary"
            class="flex-1 bg-rose-500 hover:bg-rose-600"
            :loading="loadingCancel"
            @click="submitCancel"
          >
            Ajukan Batal
          </AppButton>
        </div>
      </div>
    </div>

    <!-- Modal Pengajuan Edit -->
    <div v-if="editingExpense" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="editingExpense = null"></div>
      <div class="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 class="mb-2 text-xl font-black text-amber-600">Pengajuan Edit Pengeluaran</h3>
        <p class="mb-4 text-sm text-slate-500">
          Pengeluaran <strong>{{ editingExpense?.category }}</strong>. Masukkan data perbaikan dan alasan edit.
        </p>
        
        <div class="space-y-3 mb-4">
          <div>
            <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Harga Baru (Total)</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">Rp</span>
              <input
                v-model="editData.amount"
                type="text"
                class="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm font-medium focus:border-merchant-primary focus:outline-none"
                placeholder="0"
                @input="editData.amount = String(editData.amount).replace(/\D/g, '')"
              />
            </div>
          </div>
          <div>
            <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Alasan Edit</label>
            <textarea
              v-model="editReason"
              rows="2"
              placeholder="Alasan edit..."
              class="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-merchant-primary focus:ring-merchant-primary"
            ></textarea>
          </div>
        </div>

        <div class="flex gap-3">
          <button @click="editingExpense = null" class="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-600 hover:bg-slate-200">
            Tutup
          </button>
          <AppButton
            variant="primary"
            class="flex-1 bg-amber-500 hover:bg-amber-600"
            :loading="loadingEdit"
            @click="submitEdit"
          >
            Ajukan Edit
          </AppButton>
        </div>
      </div>
    </div>
  </div>
</template>
