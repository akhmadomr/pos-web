<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { fetchOutletStocks, fetchPosStockOpnames, submitStockOpname } from '@/api/stockOpname'
import dayjs from 'dayjs'
import 'dayjs/locale/id'
dayjs.locale('id')

const loading = ref(true)
const activeTab = ref('stocks') // 'stocks' or 'history'

// Data Stok Outlet
const stocks = ref([])
const searchStock = ref('')

// Riwayat Opname
const opnameHistory = ref([])
const historyMeta = ref({})
const historyPage = ref(1)

// Form Pengajuan Opname
const showSubmitModal = ref(false)
const submitForm = ref({ notes: '', items: [] })
const saving = ref(false)
const searchIngredient = ref('')
const activeNoteItem = ref(null)
const showNoteModal = ref(false)

const openItemNote = (item) => {
  activeNoteItem.value = item
  showNoteModal.value = true
}

const alert = ref({ show: false, type: 'success', message: '' })
const showAlert = (type, message) => {
  alert.value = { show: true, type, message }
  setTimeout(() => { alert.value.show = false }, 4000)
}

const loadData = async () => {
  loading.value = true
  try {
    if (activeTab.value === 'stocks') {
      const res = await fetchOutletStocks()
      stocks.value = res.data
    } else {
      const res = await fetchPosStockOpnames({ page: historyPage.value })
      opnameHistory.value = res.data
      historyMeta.value = res.meta
    }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

watch(activeTab, () => {
  loadData()
})

onMounted(loadData)

const filteredStocks = computed(() => {
  if (!searchStock.value) return stocks.value
  const s = searchStock.value.toLowerCase()
  return stocks.value.filter(item => item.name.toLowerCase().includes(s))
})

// Buka modal pengajuan stok opname
const openSubmitModal = async () => {
  // Jika stok belum dimuat, muat dulu untuk mengambil daftar bahan baku
  if (!stocks.value.length) {
    loading.value = true
    try {
      const res = await fetchOutletStocks()
      stocks.value = res.data
    } catch (e) {
      console.error(e)
    }
    loading.value = false
  }

  // Siapkan form (semua bahan baku)
  submitForm.value = {
    notes: '',
    items: stocks.value.map(s => ({
      ingredient_id: s.id,
      name: s.name,
      unit: s.unit,
      expected_stock: s.current_stock,
      actual_stock: '', // Kosong = tidak diopname/dihitung
      notes: ''
    }))
  }
  searchIngredient.value = ''
  showSubmitModal.value = true
}

const filteredSubmitItems = computed(() => {
  if (!searchIngredient.value) return submitForm.value.items
  const s = searchIngredient.value.toLowerCase()
  return submitForm.value.items.filter(item => item.name.toLowerCase().includes(s))
})

const doSubmitOpname = async () => {
  // Filter hanya item yang `actual_stock` nya diisi
  const itemsToSubmit = submitForm.value.items.filter(i => i.actual_stock !== '' && i.actual_stock !== null)
  
  if (itemsToSubmit.length === 0) {
    showAlert('error', 'Masukkan setidaknya 1 hasil hitung fisik untuk diajukan.')
    return
  }

  saving.value = true
  try {
    await submitStockOpname({
      notes: submitForm.value.notes,
      items: itemsToSubmit.map(i => ({
        ingredient_id: i.ingredient_id,
        actual_stock: parseFloat(i.actual_stock),
        notes: i.notes
      }))
    })
    
    showAlert('success', 'Stok opname berhasil diajukan. Menunggu persetujuan admin.')
    showSubmitModal.value = false
    activeTab.value = 'history'
    historyPage.value = 1
    await loadData()
  } catch (e) {
    showAlert('error', e.response?.data?.message || 'Gagal mengajukan stok opname.')
  } finally {
    saving.value = false
  }
}

const formatNumber = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '0'
  return Math.round(Number(val)).toLocaleString('id-ID')
}

const formatDiff = (diff) => {
  if (diff === null || diff === undefined || isNaN(diff)) return '0'
  const num = Math.round(Number(diff))
  if (num > 0) return '+' + num.toLocaleString('id-ID')
  return num.toLocaleString('id-ID')
}

const statusBadge = (s) => ({
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
}[s] || 'bg-slate-100 text-slate-700')

const statusLabel = (s) => ({
  pending: 'Menunggu Persetujuan',
  approved: 'Disetujui',
  rejected: 'Ditolak',
}[s] || s)

const getDaysRemainingText = (item) => {
  if (item.avg_daily_usage === 0) return 'Stok aman (belum ada penggunaan rutin)'
  if (item.days_remaining <= 0) return 'Stok habis'
  return `Cukup untuk ~${item.days_remaining} hari`
}
</script>

<template>
  <div class="h-full flex flex-col bg-slate-50">
    <!-- Header & Tabs -->
    <div class="bg-white px-3 sm:px-4 pt-3 border-b border-slate-200 shrink-0">
      <h1 class="text-lg font-black text-slate-900 mb-3">Stok Outlet & Opname</h1>
      
      <div class="flex gap-2 border-b border-slate-100">
        <button @click="activeTab = 'stocks'"
          :class="['px-3 py-2.5 text-xs font-bold border-b-2 transition-colors', activeTab === 'stocks' ? 'border-merchant-primary text-merchant-primary' : 'border-transparent text-slate-500 hover:text-slate-800']">
          <i class="pi pi-box mr-1.5" /> Data Stok
        </button>
        <button @click="activeTab = 'history'"
          :class="['px-3 py-2.5 text-xs font-bold border-b-2 transition-colors', activeTab === 'history' ? 'border-merchant-primary text-merchant-primary' : 'border-transparent text-slate-500 hover:text-slate-800']">
          <i class="pi pi-history mr-1.5" /> Riwayat Opname
        </button>
      </div>
    </div>

    <!-- Alert Toast -->
    <Transition name="slide-down">
      <div v-if="alert.show"
        :class="['fixed top-4 right-4 z-[200] rounded-xl shadow-2xl px-4 py-2.5 flex items-center gap-2.5 text-xs font-bold', alert.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white']">
        <i :class="alert.type === 'success' ? 'pi pi-check-circle' : 'pi pi-exclamation-triangle'" />
        {{ alert.message }}
      </div>
    </Transition>

    <div class="flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar">
      <div v-if="loading" class="flex justify-center py-16">
        <i class="pi pi-spin pi-spinner text-2xl text-merchant-primary" />
      </div>

      <!-- Tab: Data Stok -->
      <div v-else-if="activeTab === 'stocks'" class="space-y-3 max-w-4xl mx-auto pb-10">
        <div class="flex flex-row items-center justify-between gap-2 sm:gap-4">
          <div class="relative flex-1">
            <i class="pi pi-search absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
            <input v-model="searchStock" type="text" placeholder="Cari bahan baku..."
              class="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-merchant-primary focus:ring-1 focus:ring-merchant-primary outline-none bg-white font-bold text-slate-700" />
          </div>
          <button @click="openSubmitModal" class="px-3 sm:px-4 py-2 bg-merchant-primary text-white rounded-xl text-[10px] sm:text-xs font-bold hover:bg-merchant-primary-dark transition shadow-sm shrink-0 flex items-center gap-1.5">
            <i class="pi pi-plus-circle text-xs sm:text-sm" />
            <span class="hidden sm:inline">Ajukan Opname</span>
            <span class="sm:hidden">Opname</span>
          </button>
        </div>

        <div class="bg-white rounded-xl sm:rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div class="divide-y divide-slate-100">
            <div v-for="item in filteredStocks" :key="item.id" :class="['p-3 flex items-center justify-between gap-2 transition hover:bg-slate-50', item.is_low_stock ? 'bg-rose-50/20' : '']">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 mb-0.5">
                  <div v-if="item.is_low_stock" class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" title="Stok Menipis" />
                  <p class="font-black text-slate-900 text-sm truncate">{{ item.name }}</p>
                </div>
                <p class="text-[9px] text-slate-500 mb-1.5">Min. Stok: {{ formatNumber(item.min_stock_outlet) }} {{ item.unit }}</p>
                <div class="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-3 text-[8px] font-bold uppercase tracking-wider text-slate-400">
                  <span>Avg: <span class="text-slate-700">{{ formatNumber(item.avg_daily_usage) }} {{ item.unit }}/hr</span></span>
                  <span>Max: <span class="text-slate-700">{{ formatNumber(item.max_daily_usage) }} {{ item.unit }}/hr</span></span>
                </div>
              </div>
              <div class="flex flex-col items-end shrink-0 text-right">
                <p class="text-[8px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Sisa Stok (Sistem)</p>
                <p :class="['text-lg font-black tabular-nums leading-none', item.is_low_stock ? 'text-rose-600' : 'text-slate-800']">
                  {{ formatNumber(item.current_stock) }} <span class="text-[9px] font-bold text-slate-400 ml-0.5">{{ item.unit }}</span>
                </p>
                <p :class="['text-[8px] font-bold mt-1.5 px-1.5 py-0.5 rounded leading-none', item.days_remaining <= 2 && item.avg_daily_usage > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500']">
                  {{ getDaysRemainingText(item) }}
                </p>
              </div>
            </div>
            
            <div v-if="filteredStocks.length === 0" class="p-6 text-center text-slate-400">
              <i class="pi pi-inbox text-3xl block mb-2 opacity-50" />
              <p class="text-xs font-bold">Tidak ada bahan baku ditemukan.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab: Riwayat Opname -->
      <div v-else-if="activeTab === 'history'" class="max-w-4xl mx-auto space-y-3 pb-10">
        <div class="flex justify-end mb-1">
          <button @click="openSubmitModal" class="px-3 sm:px-4 py-2 bg-merchant-primary text-white rounded-xl text-[10px] sm:text-xs font-bold hover:bg-merchant-primary-dark transition shadow-sm flex items-center gap-1.5">
            <i class="pi pi-plus-circle text-xs sm:text-sm" /> Ajukan Opname
          </button>
        </div>

        <div v-if="opnameHistory.length" class="space-y-3">
          <div v-for="opname in opnameHistory" :key="opname.id" class="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm">
            <div class="flex items-start justify-between gap-3 mb-3">
              <div class="min-w-0">
                <div class="flex items-center flex-wrap gap-1.5 mb-1.5">
                  <span :class="['px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider', statusBadge(opname.status)]">
                    {{ statusLabel(opname.status) }}
                  </span>
                  <span class="text-[9px] font-bold text-slate-400">{{ dayjs(opname.opname_date).format('DD MMM YYYY') }} • {{ opname.opname_time }}</span>
                </div>
                <p class="text-xs font-black text-slate-900">{{ opname.items?.length }} Item Diperiksa</p>
                <p v-if="opname.notes" class="text-[9px] text-slate-500 mt-0.5 italic truncate">Catatan: "{{ opname.notes }}"</p>
              </div>
              <div v-if="opname.status !== 'pending'" class="text-right shrink-0 max-w-[120px] sm:max-w-[200px]">
                <p class="text-[8px] font-bold text-slate-400 uppercase">Reviewer</p>
                <p class="text-[10px] font-bold text-slate-700 truncate">{{ opname.reviewer?.name }}</p>
                <p class="text-[8px] text-slate-400 mt-0.5">{{ dayjs(opname.reviewed_at).format('DD/MM/YY HH:mm') }}</p>
              </div>
            </div>

            <!-- Pesan review jika ditolak / ada pesan -->
            <div v-if="opname.review_notes" :class="['rounded-lg p-2.5 mb-3 text-[10px]', opname.status === 'rejected' ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-slate-50 text-slate-700 border border-slate-100']">
              <span class="font-bold">Pesan Admin:</span> {{ opname.review_notes }}
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              <div v-for="item in opname.items" :key="item.id" class="border border-slate-100 rounded-lg p-2 bg-slate-50 flex items-center justify-between">
                <div class="min-w-0 pr-2">
                  <p class="text-[10px] font-bold text-slate-900 truncate">{{ item.ingredient?.name }}</p>
                  <p class="text-[8px] text-slate-500 mt-0.5">Sistem: {{ formatNumber(item.expected_stock) }}</p>
                </div>
                <div class="text-right shrink-0">
                  <p class="text-[10px] font-black text-slate-800 leading-tight">{{ item.actual_stock !== null ? formatNumber(item.actual_stock) : '—' }} <span class="text-[8px] text-slate-400 font-bold">{{ item.ingredient?.unit }}</span></p>
                  <p v-if="item.actual_stock !== null" :class="['text-[8px] font-bold', (item.actual_stock - item.expected_stock) < 0 ? 'text-rose-500' : (item.actual_stock - item.expected_stock) > 0 ? 'text-blue-500' : 'text-slate-400']">
                    {{ formatDiff(item.actual_stock - item.expected_stock) }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Pagination Info -->
          <div v-if="historyMeta.last_page > 1" class="flex justify-center gap-1 mt-4">
            <button v-for="p in historyMeta.last_page" :key="p" @click="historyPage = p; loadData()" :class="['w-7 h-7 rounded-md text-xs font-bold transition', historyPage === p ? 'bg-merchant-primary text-white shadow' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200']">
              {{ p }}
            </button>
          </div>
        </div>

        <div v-else class="p-6 text-center text-slate-400 bg-white rounded-xl border border-slate-200 shadow-sm">
          <i class="pi pi-list-check text-3xl block mb-2 opacity-50" />
          <p class="text-xs font-bold">Belum ada riwayat pengajuan opname.</p>
        </div>
      </div>
    </div>

    <!-- Modal Pengajuan Stok Opname -->
    <Teleport to="body">
      <div v-if="showSubmitModal" class="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 lg:p-8">
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" @click="!saving && (showSubmitModal = false)" />
        <div class="relative w-full max-w-3xl h-[90vh] sm:h-auto sm:max-h-full rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden">
          
          <div class="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
            <div>
              <h2 class="text-sm sm:text-base font-black text-slate-900">Ajukan Stok Opname</h2>
              <p class="text-[9px] sm:text-[10px] font-bold text-slate-500 mt-0.5">Hitung fisik bahan baku. Kosongkan baris yang tidak dihitung.</p>
            </div>
            <button @click="showSubmitModal = false" :disabled="saving" class="text-slate-400 hover:text-rose-500 disabled:opacity-50 transition p-1">
              <i class="pi pi-times text-lg" />
            </button>
          </div>

          <!-- Form Area -->
          <div class="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-5 space-y-4 sm:space-y-5">
            
            <div>
              <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Pesan/Catatan Pengajuan (Opsional)</label>
              <textarea v-model="submitForm.notes" rows="2" class="w-full px-3 py-2 sm:px-4 sm:py-3 rounded-xl border border-slate-200 bg-white text-xs focus:border-merchant-primary focus:ring-1 focus:ring-merchant-primary outline-none" placeholder="Misal: Opname rutin harian..."></textarea>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Daftar Bahan Baku</label>
              <div class="relative w-full sm:w-56">
                <i class="pi pi-search absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]" />
                <input v-model="searchIngredient" type="text" placeholder="Cari bahan baku..."
                  class="w-full pl-7 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:border-merchant-primary outline-none" />
              </div>
            </div>

            <!-- List form items (scrollable max height) -->
            <div class="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-slate-50">
              <div v-for="(item, idx) in filteredSubmitItems" :key="item.ingredient_id" class="p-2.5 sm:p-3 bg-white flex flex-row items-center gap-2 sm:gap-4 hover:bg-slate-50 transition">
                <div class="flex-1 min-w-0 pr-2">
                  <p class="text-xs font-black text-slate-900 truncate">{{ item.name }}</p>
                  <p class="text-[9px] text-slate-500 mt-0.5">Sistem: <span class="font-bold text-slate-700">{{ formatNumber(item.expected_stock) }} {{ item.unit }}</span></p>
                </div>
                
                <div class="flex items-center gap-2 shrink-0">
                  <div class="relative w-24 sm:w-28">
                    <input v-model="item.actual_stock" type="number" step="0.01" min="0" placeholder="Fisik" class="w-full pr-7 pl-2 py-1.5 rounded-md border border-slate-300 text-xs font-black focus:border-merchant-primary focus:ring-1 focus:ring-merchant-primary outline-none text-right placeholder:font-normal placeholder:text-slate-300" />
                    <span class="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-400 uppercase pointer-events-none">{{ item.unit }}</span>
                  </div>
                  
                  <button 
                    type="button"
                    @click="openItemNote(item)"
                    :class="['p-2 rounded-lg border transition flex items-center justify-center relative', item.notes ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100']"
                    :title="item.notes ? 'Catatan: ' + item.notes : 'Tambah Catatan'"
                  >
                    <i class="pi pi-pencil text-xs"></i>
                    <span v-if="item.notes" class="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500"></span>
                  </button>
                </div>
              </div>
              
              <div v-if="filteredSubmitItems.length === 0" class="p-4 text-center text-xs text-slate-500">
                Pencarian tidak ditemukan.
              </div>
            </div>

          </div>

          <div class="px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
            <p class="text-[10px] sm:text-xs font-bold text-slate-500">
              <span class="text-slate-900">{{ submitForm.items.filter(i => i.actual_stock !== '').length }}</span> item diisi
            </p>
            <div class="flex gap-2 sm:gap-3">
              <button @click="showSubmitModal = false" :disabled="saving" class="px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-white transition disabled:opacity-50">Batal</button>
              <button @click="doSubmitOpname" :disabled="saving" class="px-3 py-1.5 sm:px-5 sm:py-2 rounded-lg bg-merchant-primary text-white text-xs font-bold hover:bg-merchant-primary-dark transition disabled:opacity-50 shadow-sm flex items-center gap-1.5">
                <i v-if="saving" class="pi pi-spin pi-spinner text-xs" />
                {{ saving ? 'Mengirim...' : 'Ajukan Opname' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Modal Input Catatan Item -->
    <Teleport to="body">
      <div v-if="showNoteModal && activeNoteItem" class="fixed inset-0 z-[150] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" @click="showNoteModal = false" />
        <div class="relative w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl space-y-3">
          <div class="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 class="font-bold text-slate-900 text-xs truncate">Catatan: {{ activeNoteItem.name }}</h3>
            <button @click="showNoteModal = false" class="text-slate-400 hover:text-slate-600">
              <i class="pi pi-times text-xs"></i>
            </button>
          </div>
          <textarea
            v-model="activeNoteItem.notes"
            rows="3"
            class="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:border-merchant-primary outline-none"
            placeholder="Tulis catatan khusus untuk bahan baku ini..."
          ></textarea>
          <div class="flex justify-end gap-2">
            <button @click="showNoteModal = false" class="px-3 py-1.5 rounded-lg bg-merchant-primary text-white text-xs font-bold">Simpan</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.slide-down-enter-active, .slide-down-leave-active { transition: all 0.3s ease; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateY(-10px); }

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}
</style>
