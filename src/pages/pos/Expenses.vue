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

const formatInputRupiah = (val) => {
  const num = String(val).replace(/\D/g, '')
  return num ? parseInt(num, 10).toLocaleString('id-ID') : ''
}

const authStore = useAuthStore()

const expenses = ref([])
const categories = ref([])
const loading = ref(false)
const loadingSubmit = ref(false)
const error = ref('')
const successMessage = ref('')

const priceMode = ref('unit') // 'unit' | 'total'

const form = ref({
  type: 'ops',
  category: '',
  qty: 1,
  price_per_item: '',
  total_amount: '',
  notes: '',
})

const setPriceMode = (mode) => {
  if (priceMode.value === mode) return
  const qty = Number(form.value.qty) || 1
  if (mode === 'total') {
    const price = Number(String(form.value.price_per_item).replace(/\D/g, '')) || 0
    if (price > 0) {
      form.value.total_amount = formatInputRupiah(Math.round(price * qty))
    }
  } else {
    const total = Number(String(form.value.total_amount).replace(/\D/g, '')) || 0
    if (total > 0 && qty > 0) {
      form.value.price_per_item = formatInputRupiah(Math.round(total / qty))
    }
  }
  priceMode.value = mode
}

const ingredients = ref([])

const selectedIngredient = computed(() => {
  return ingredients.value.find(i => i.name === form.value.category)
})

const unifiedOptions = computed(() => {
  const ingOptions = ingredients.value.map(i => ({ label: i.name + ' (Bahan)', value: i.name, rawLabel: i.name, type: 'hpp' }))
  const catOptions = categories.value.map(c => {
    const typeLabel = c.type === 'hpp' ? 'Bahan' : 'OPS'
    return { label: (c.name ?? c.label) + ' (' + typeLabel + ')', value: c.name ?? c.value, rawLabel: c.name ?? c.label, type: c.type || 'ops' }
  })
  return [...ingOptions, ...catOptions.filter(c => !ingOptions.some(i => i.value === c.value))]
})

const handleSelectExisting = (option) => {
  form.value.category = option.rawLabel || option.value
  form.value.type = option.type || 'ops'
}

const handleCreateNew = (payload) => {
  form.value.category = payload.label
  form.value.type = payload.type || 'ops'
}

const totalExpenses = computed(() => {
  const list = filterType.value === 'all'
    ? expenses.value
    : expenses.value.filter(e => e.type === filterType.value)
  return list
    .filter(e => e.status !== 'cancelled')
    .reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0)
})

const amountPreview = computed(() => {
  const qty = Number(form.value.qty) || 0
  if (priceMode.value === 'unit') {
    const price = Number(String(form.value.price_per_item).replace(/\D/g, '')) || 0
    return qty * price
  } else {
    return Number(String(form.value.total_amount).replace(/\D/g, '')) || 0
  }
})

const unitPricePreview = computed(() => {
  const qty = Number(form.value.qty) || 0
  if (priceMode.value === 'unit') {
    return Number(String(form.value.price_per_item).replace(/\D/g, '')) || 0
  } else {
    const total = Number(String(form.value.total_amount).replace(/\D/g, '')) || 0
    return qty > 0 ? Math.round(total / qty) : total
  }
})

const isValid = computed(() => {
  return form.value.category && Number(form.value.qty) > 0 && amountPreview.value > 0
})

const filterSearch = ref('')
const filterType = ref('all') // 'all' | 'ops' | 'hpp'
const sortBy = ref('time_desc')
const showFilters = ref(false)

const filteredExpenses = computed(() => {
  let list = expenses.value.filter(e => e.status !== 'cancelled')
  
  if (filterSearch.value) {
    const q = filterSearch.value.toLowerCase()
    list = list.filter(e => e.category.toLowerCase().includes(q))
  }

  if (filterType.value !== 'all') {
    list = list.filter(e => e.type === filterType.value)
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
    expenses.value = (expensesData || []).filter(e => e.status !== 'cancelled')
    // categoriesData sekarang array of {name, type}
    categories.value = categoriesData.map((c) => ({
      label: c.name ?? c,
      value: c.name ?? c,
      name: c.name ?? c,
      type: c.type ?? 'ops',
    }))
    ingredients.value = ingredientsData

    // Cache ke IDB untuk offline
    try {
      await idbSet('expense-categories', categoriesData) // {name, type}[]
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
          type: e.type || 'ops',
          amount: e.amount,
          qty: e.qty,
          price_per_item: e.price_per_item,
          created_at: e.created_at,
          is_offline: e.sync_status !== 'synced',
        }))
        // Load kategori & bahan baku dari IDB cache
        const cachedCategories = await idbGet('expense-categories')
        const cachedIngredients = await idbGet('expense-ingredients')
        if (cachedCategories) categories.value = cachedCategories.map(c => ({ label: c.name ?? c, value: c.name ?? c, name: c.name ?? c, type: c.type ?? 'ops' }))
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
  
  const qty = Number(form.value.qty)
  const amount = amountPreview.value
  const price_per_item = qty > 0 ? unitPricePreview.value : amount

  const payload = {
    type: form.value.type,
    category: form.value.category,
    qty: qty,
    price_per_item: price_per_item,
    amount: amount,
    notes: form.value.notes ? form.value.notes.trim() : null,
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
    
    form.value.type = 'ops'
    form.value.category = ''
    form.value.qty = 1
    form.value.price_per_item = ''
    form.value.total_amount = ''
    form.value.notes = ''
    priceMode.value = 'unit'
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
      
      form.value.type = 'ops'
      form.value.category = ''
      form.value.qty = 1
      form.value.price_per_item = ''
      form.value.total_amount = ''
      form.value.notes = ''
      priceMode.value = 'unit'
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
const cancelErrors = ref({})

const openCancelModal = (exp) => {
  cancelingExpense.value = exp
  cancelReason.value = ''
  cancelErrors.value = {}
}

const submitCancel = async () => {
  cancelErrors.value = {}
  if (!cancelReason.value) {
    cancelErrors.value.reason = 'Alasan pembatalan harus diisi.'
    return
  }
  
  loadingCancel.value = true
  try {
    await requestCancelExpense(cancelingExpense.value.id, cancelReason.value)
    successMessage.value = 'Pengajuan pembatalan berhasil dikirim. Silahkan tunggu admin.'
    cancelingExpense.value = null
    loadData()
  } catch (err) {
    if (err.response?.status === 422) {
      const msgs = err.response.data.errors
      if (msgs?.reason) cancelErrors.value.reason = msgs.reason[0]
    } else {
      cancelErrors.value.general = err.response?.data?.message || 'Gagal mengajukan pembatalan.'
    }
  } finally {
    loadingCancel.value = false
  }
}

const editingExpense = ref(null)
const editReason = ref('')
const editPriceMode = ref('total') // 'unit' | 'total'
const editData = ref({ amount: '', qty: 1, price_per_item: '', total_amount: '', notes: '' })
const loadingEdit = ref(false)
const editErrors = ref({})

const setEditPriceMode = (mode) => {
  if (editPriceMode.value === mode) return
  const qty = Number(editData.value.qty) || 1
  if (mode === 'total') {
    const price = Number(String(editData.value.price_per_item).replace(/\D/g, '')) || 0
    if (price > 0) {
      editData.value.total_amount = formatInputRupiah(Math.round(price * qty))
    }
  } else {
    const total = Number(String(editData.value.total_amount).replace(/\D/g, '')) || 0
    if (total > 0 && qty > 0) {
      editData.value.price_per_item = formatInputRupiah(Math.round(total / qty))
    }
  }
  editPriceMode.value = mode
}

const editAmountPreview = computed(() => {
  const qty = Number(editData.value.qty) || 0
  if (editPriceMode.value === 'unit') {
    const price = Number(String(editData.value.price_per_item).replace(/\D/g, '')) || 0
    return qty * price
  } else {
    return Number(String(editData.value.total_amount).replace(/\D/g, '')) || 0
  }
})

const editUnitPricePreview = computed(() => {
  const qty = Number(editData.value.qty) || 0
  if (editPriceMode.value === 'unit') {
    return Number(String(editData.value.price_per_item).replace(/\D/g, '')) || 0
  } else {
    const total = Number(String(editData.value.total_amount).replace(/\D/g, '')) || 0
    return qty > 0 ? Math.round(total / qty) : total
  }
})

const openEditModal = (exp) => {
  editingExpense.value = exp
  editReason.value = ''
  editErrors.value = {}
  editPriceMode.value = 'total'
  const expAmount = Math.round(Number(exp.amount))
  const expQty = Number(exp.qty) || 1
  const expUnitPrice = Math.round(Number(exp.price_per_item || (expAmount / expQty)))
  editData.value = { 
    amount: formatInputRupiah(expAmount),
    total_amount: formatInputRupiah(expAmount),
    qty: expQty, 
    price_per_item: formatInputRupiah(expUnitPrice),
    notes: exp.notes || ''
  }
}

const submitEdit = async () => {
  editErrors.value = {}
  const qty = Number(editData.value.qty) || 0
  const numericAmount = editAmountPreview.value
  const numericPricePerItem = editUnitPricePreview.value

  if (qty <= 0) {
    editErrors.value.qty = 'Kuantitas harus lebih dari 0.'
    return
  }
  if (numericAmount <= 0) {
    editErrors.value.amount = 'Harga harus lebih dari 0.'
    return
  }
  if (!editReason.value) {
    editErrors.value.reason = 'Alasan edit harus diisi.'
    return
  }
  
  loadingEdit.value = true
  try {
    await requestEditExpense(editingExpense.value.id, {
      reason: editReason.value,
      amount: numericAmount,
      category: editingExpense.value.category,
      qty: qty,
      price_per_item: numericPricePerItem,
      notes: editData.value.notes ? editData.value.notes.trim() : null
    })
    successMessage.value = 'Pengajuan edit berhasil dikirim. Silahkan tunggu admin.'
    editingExpense.value = null
    loadData()
  } catch (err) {
    if (err.response?.status === 422) {
      const msgs = err.response.data.errors
      if (msgs?.reason) editErrors.value.reason = msgs.reason[0]
      if (msgs?.amount) editErrors.value.amount = msgs.amount[0]
    } else {
      editErrors.value.general = err.response?.data?.message || 'Gagal mengajukan edit.'
    }
  } finally {
    loadingEdit.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="flex flex-col min-h-screen lg:h-[calc(100vh-10.5rem)] lg:min-h-0 pb-20 lg:pb-0">
    <div class="mb-3 md:mb-4">
      <h2 class="text-lg md:text-xl font-black text-slate-900">Pengeluaran Shift</h2>
      <p class="text-xs md:text-sm text-slate-500">Catat pengeluaran operasional selama shift berlangsung.</p>
    </div>
    
    <AppAlert v-if="error" type="error" :message="error" class="mb-4" dismissible @dismiss="error = ''" />
    <AppAlert v-if="successMessage" type="success" :message="successMessage" class="mb-4" dismissible @dismiss="successMessage = ''" />

    <div class="grid flex-1 gap-4 md:gap-6 min-h-0 lg:grid-cols-5 lg:overflow-visible pb-4 lg:pb-0">
      <!-- Form Input -->
      <section class="flex flex-col shrink-0 lg:col-span-2">
        <div class="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
          <h3 class="mb-3 md:mb-4 text-[10px] md:text-sm font-bold uppercase tracking-wider text-slate-400">Tambah Pengeluaran</h3>
          
          <div class="space-y-3 md:space-y-4">
            <div>
              <label class="mb-1 block text-[10px] md:text-xs font-bold uppercase tracking-wider text-slate-500">Nama Pengeluaran</label>
              <AppCreatableSelect
                v-model="form.category"
                :options="unifiedOptions"
                :create-types="[{ label: 'Buat baru Operasional', value: 'ops' }, { label: 'Buat baru Bahan Baku', value: 'hpp' }]"
                placeholder="Pilih atau ketik nama..."
                @select-existing="handleSelectExisting"
                @create-new="handleCreateNew"
              />
            </div>
            
            <!-- Mode Input Harga Selector -->
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="text-[10px] md:text-xs font-bold uppercase tracking-wider text-slate-500">Metode Input Harga</label>
                <div class="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200/60">
                  <button
                    type="button"
                    @click="setPriceMode('unit')"
                    class="rounded-md px-2.5 py-1 text-[10px] md:text-xs font-bold transition flex items-center gap-1"
                    :class="priceMode === 'unit' ? 'bg-white text-merchant-primary shadow-sm' : 'text-slate-500 hover:text-slate-800'"
                  >
                    <span>Harga Satuan</span>
                  </button>
                  <button
                    type="button"
                    @click="setPriceMode('total')"
                    class="rounded-md px-2.5 py-1 text-[10px] md:text-xs font-bold transition flex items-center gap-1"
                    :class="priceMode === 'total' ? 'bg-white text-merchant-primary shadow-sm' : 'text-slate-500 hover:text-slate-800'"
                  >
                    <span>Harga Total</span>
                  </button>
                </div>
              </div>
            </div>

            <div class="flex gap-3 md:gap-4">
              <div class="w-20 md:w-24">
                <label class="mb-1 block text-[10px] md:text-xs font-bold uppercase tracking-wider text-slate-500">Qty</label>
                <div class="relative">
                  <input
                    v-model="form.qty"
                    type="number"
                    min="0.01"
                    step="any"
                    class="w-full rounded-xl border border-slate-200 px-2 md:px-3 py-2 md:py-2.5 text-center text-xs md:text-sm font-medium focus:border-merchant-primary focus:outline-none focus:ring-2 focus:ring-merchant-primary/20"
                    :class="{ 'pr-8': selectedIngredient }"
                  />
                  <span v-if="selectedIngredient" class="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] md:text-xs font-bold text-slate-400">
                    {{ selectedIngredient.unit }}
                  </span>
                </div>
              </div>
              <div class="flex-1">
                <label class="mb-1 block text-[10px] md:text-xs font-bold uppercase tracking-wider text-slate-500">
                  {{ priceMode === 'unit' ? 'Harga Satuan' : 'Harga Total' }}
                </label>
                <div class="relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs md:text-sm font-bold text-slate-400">Rp</span>
                  <input
                    v-if="priceMode === 'unit'"
                    v-model="form.price_per_item"
                    type="text"
                    class="w-full rounded-xl border border-slate-200 py-2 md:py-2.5 pl-8 md:pl-10 pr-3 md:pr-4 text-xs md:text-sm font-medium focus:border-merchant-primary focus:outline-none focus:ring-2 focus:ring-merchant-primary/20"
                    placeholder="0"
                    @input="form.price_per_item = formatInputRupiah($event.target.value)"
                  />
                  <input
                    v-else
                    v-model="form.total_amount"
                    type="text"
                    class="w-full rounded-xl border border-slate-200 py-2 md:py-2.5 pl-8 md:pl-10 pr-3 md:pr-4 text-xs md:text-sm font-medium focus:border-merchant-primary focus:outline-none focus:ring-2 focus:ring-merchant-primary/20"
                    placeholder="0"
                    @input="form.total_amount = formatInputRupiah($event.target.value)"
                  />
                </div>
              </div>
            </div>
            
            <div class="rounded-xl bg-slate-50 p-3 md:p-4 border border-slate-100 flex items-center justify-between">
              <div>
                <span class="text-xs md:text-sm font-bold text-slate-500 block">Total Pengeluaran</span>
                <span v-if="priceMode === 'total' && Number(form.qty) > 0" class="text-[10px] md:text-xs text-slate-400 font-medium">
                  Estimasi Satuan: {{ formatRupiah(unitPricePreview) }}{{ selectedIngredient ? ' / ' + selectedIngredient.unit : ' / item' }}
                </span>
                <span v-else-if="priceMode === 'unit' && Number(form.qty) > 0" class="text-[10px] md:text-xs text-slate-400 font-medium">
                  {{ form.qty }} x {{ formatRupiah(unitPricePreview) }}
                </span>
              </div>
              <span class="text-base md:text-lg font-black text-merchant-primary">{{ formatRupiah(amountPreview) }}</span>
            </div>

            <div>
              <label class="mb-1 block text-[10px] md:text-xs font-bold uppercase tracking-wider text-slate-500">Keterangan / Catatan (Opsional)</label>
              <input
                v-model="form.notes"
                type="text"
                class="w-full rounded-xl border border-slate-200 px-3 py-2 md:py-2.5 text-xs md:text-sm font-medium focus:border-merchant-primary focus:outline-none focus:ring-2 focus:ring-merchant-primary/20"
                placeholder="Contoh: Merekk biasanya habis..."
              />
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
      <section class="flex flex-col lg:min-h-0 lg:col-span-3">
        <div class="flex flex-col h-full rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div class="border-b border-slate-100 p-3 md:p-4 flex items-center justify-between bg-slate-50/50">
            <h3 class="text-[10px] md:text-sm font-bold uppercase tracking-wider text-slate-400">Riwayat Pengeluaran</h3>
            <span class="text-xs md:text-sm font-bold text-slate-900">Total: {{ formatRupiah(totalExpenses) }}</span>
          </div>

          <div class="border-b border-slate-100 p-3 flex flex-col gap-3 bg-white">
            <!-- Filter Tipe: Semua / Bahan / OPS -->
            <div class="flex gap-1.5">
              <button
                v-for="tab in [{label: 'Semua', value: 'all'}, {label: 'Bahan', value: 'hpp'}, {label: 'OPS', value: 'ops'}]"
                :key="tab.value"
                @click="filterType = tab.value"
                :class="[
                  'flex-1 rounded-lg py-1.5 text-[10px] font-bold uppercase tracking-wide transition',
                  filterType === tab.value
                    ? (tab.value === 'hpp' ? 'bg-amber-100 text-amber-700' : tab.value === 'ops' ? 'bg-purple-100 text-purple-700' : 'bg-slate-200 text-slate-700')
                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                ]"
              >{{ tab.label }}</button>
            </div>
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
          
          <div class="flex-1 lg:overflow-y-auto p-3 md:p-4 relative">
            <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
              <i class="pi pi-spin pi-spinner text-2xl md:text-3xl text-merchant-primary" />
            </div>
            
            <div v-if="filteredExpenses.length" class="space-y-2 md:space-y-3">
              <div v-for="exp in filteredExpenses" :key="exp.id" class="flex items-center justify-between rounded-xl border border-slate-100 p-3 md:p-4 hover:bg-slate-50 transition">
                <div class="flex flex-col gap-0.5 md:gap-1">
                  <div class="flex items-center gap-2">
                    <span class="text-sm md:text-base font-bold text-slate-900">{{ exp.category }}</span>
                    <span :class="['px-1.5 py-0.5 rounded text-[8px] font-bold uppercase', exp.type === 'hpp' ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700']">
                      {{ exp.type === 'hpp' ? 'BAHAN' : 'OPS' }}
                    </span>
                  </div>
                  <div class="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs text-slate-500">
                    <span>{{ exp.qty }} x {{ formatRupiah(exp.price_per_item) }}</span>
                    <span class="w-1 h-1 rounded-full bg-slate-300"></span>
                    <span>{{ dayjs(exp.created_at).format('HH:mm') }}</span>
                  </div>
                  <p v-if="exp.notes" class="text-[10px] md:text-xs text-slate-500 italic mt-0.5">
                    <i class="pi pi-align-left text-[9px] mr-1 text-slate-400"></i>{{ exp.notes }}
                  </p>
                </div>
                <div class="flex flex-col items-end gap-2">
                  <span class="text-sm md:text-base font-black text-rose-500">{{ formatRupiah(exp.amount) }}</span>
                  <div class="flex gap-2" v-if="exp.status !== 'cancelled' && !exp.edit_status">
                    <button @click="openEditModal(exp)" class="flex flex-1 items-center justify-center rounded-xl bg-amber-50 px-3 py-1.5 text-[10px] font-bold text-amber-600 transition hover:bg-amber-100 active:scale-95" title="Ajukan Edit">
                      <i class="pi pi-pencil sm:mr-1" /> <span class="hidden sm:inline">Edit</span>
                    </button>
                    <button @click="openCancelModal(exp)" class="flex flex-1 items-center justify-center rounded-xl bg-rose-50 px-3 py-1.5 text-[10px] font-bold text-rose-600 transition hover:bg-rose-100 active:scale-95" title="Ajukan Batal">
                      <i class="pi pi-trash sm:mr-1" /> <span class="hidden sm:inline">Batal</span>
                    </button>
                  </div>
                  <span v-else-if="exp.status === 'cancelled'" class="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 uppercase">
                    Dibatalkan
                  </span>
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
        <AppAlert v-if="cancelErrors.general" type="error" :message="cancelErrors.general" class="mb-3" />
        <textarea
          v-model="cancelReason"
          rows="3"
          placeholder="Alasan batal..."
          class="mb-1 w-full rounded-xl border p-3 text-sm focus:border-merchant-primary focus:ring-merchant-primary"
          :class="cancelErrors.reason ? 'border-rose-300' : 'border-slate-200'"
        ></textarea>
        <p v-if="cancelErrors.reason" class="mb-4 text-xs font-medium text-rose-500">{{ cancelErrors.reason }}</p>
        <div class="flex gap-3 mt-4">
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
        
        <AppAlert v-if="editErrors.general" type="error" :message="editErrors.general" class="mb-3" />
        
        <div class="space-y-3 mb-4">
          <!-- Mode Input Harga Selector di Modal Edit -->
          <div class="flex items-center justify-between">
            <label class="text-xs font-bold uppercase tracking-wider text-slate-500">Metode Input Harga</label>
            <div class="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200/60">
              <button
                type="button"
                @click="setEditPriceMode('unit')"
                class="rounded-md px-2.5 py-1 text-xs font-bold transition flex items-center gap-1"
                :class="editPriceMode === 'unit' ? 'bg-white text-merchant-primary shadow-sm' : 'text-slate-500 hover:text-slate-800'"
              >
                <span>Harga Satuan</span>
              </button>
              <button
                type="button"
                @click="setEditPriceMode('total')"
                class="rounded-md px-2.5 py-1 text-xs font-bold transition flex items-center gap-1"
                :class="editPriceMode === 'total' ? 'bg-white text-merchant-primary shadow-sm' : 'text-slate-500 hover:text-slate-800'"
              >
                <span>Harga Total</span>
              </button>
            </div>
          </div>

          <div class="flex gap-3">
            <div class="w-24">
              <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Qty</label>
              <input
                v-model="editData.qty"
                type="number"
                min="0.01"
                step="any"
                class="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-center text-sm font-medium focus:border-merchant-primary focus:outline-none"
                :class="editErrors.qty ? 'border-rose-300' : 'border-slate-200'"
              />
              <p v-if="editErrors.qty" class="mt-1 text-xs font-medium text-rose-500">{{ editErrors.qty }}</p>
            </div>

            <div class="flex-1">
              <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
                {{ editPriceMode === 'unit' ? 'Harga Satuan Baru' : 'Harga Total Baru' }}
              </label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">Rp</span>
                <input
                  v-if="editPriceMode === 'unit'"
                  v-model="editData.price_per_item"
                  type="text"
                  class="w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm font-medium focus:border-merchant-primary focus:outline-none"
                  :class="editErrors.amount ? 'border-rose-300' : 'border-slate-200'"
                  placeholder="0"
                  @input="editData.price_per_item = formatInputRupiah($event.target.value)"
                />
                <input
                  v-else
                  v-model="editData.total_amount"
                  type="text"
                  class="w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm font-medium focus:border-merchant-primary focus:outline-none"
                  :class="editErrors.amount ? 'border-rose-300' : 'border-slate-200'"
                  placeholder="0"
                  @input="editData.total_amount = formatInputRupiah($event.target.value)"
                />
              </div>
              <p v-if="editErrors.amount" class="mt-1 text-xs font-medium text-rose-500">{{ editErrors.amount }}</p>
            </div>
          </div>

          <div class="rounded-xl bg-slate-50 p-3 border border-slate-100 flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-500 block">Total Pengeluaran Baru</span>
              <span v-if="editPriceMode === 'total' && Number(editData.qty) > 0" class="text-xs text-slate-400 font-medium">
                Estimasi Satuan: {{ formatRupiah(editUnitPricePreview) }}
              </span>
              <span v-else-if="editPriceMode === 'unit' && Number(editData.qty) > 0" class="text-xs text-slate-400 font-medium">
                {{ editData.qty }} x {{ formatRupiah(editUnitPricePreview) }}
              </span>
            </div>
            <span class="text-base font-black text-merchant-primary">{{ formatRupiah(editAmountPreview) }}</span>
          </div>

          <div>
            <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Keterangan / Catatan (Opsional)</label>
            <input
              v-model="editData.notes"
              type="text"
              class="w-full rounded-xl border border-slate-200 p-2.5 text-sm font-medium focus:border-merchant-primary focus:outline-none"
              placeholder="Contoh: Tambahan keterangan..."
            />
          </div>

          <div>
            <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Alasan Edit <span class="text-rose-500">*</span></label>
            <textarea
              v-model="editReason"
              rows="2"
              placeholder="Alasan edit..."
              class="w-full rounded-xl border p-3 text-sm focus:border-merchant-primary focus:ring-merchant-primary"
              :class="editErrors.reason ? 'border-rose-300' : 'border-slate-200'"
            ></textarea>
            <p v-if="editErrors.reason" class="mt-1 text-xs font-medium text-rose-500">{{ editErrors.reason }}</p>
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

