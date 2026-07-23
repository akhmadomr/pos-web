<script setup>
import { computed, onMounted, ref } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import AppCreatableSelect from '@/components/common/AppCreatableSelect.vue'
import AppAlert from '@/components/common/AppAlert.vue'
import { fetchExpenses, addExpense, fetchExpenseCategories } from '@/api/shifts'
import { formatRupiah } from '@/utils/currency'
import dayjs from 'dayjs'

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

const loadData = async () => {
  loading.value = true
  error.value = ''
  try {
    const [expensesData, categoriesData] = await Promise.all([
      fetchExpenses(),
      fetchExpenseCategories(),
    ])
    expenses.value = expensesData
    categories.value = categoriesData.map((c) => ({ label: c, value: c }))
  } catch (err) {
    error.value = 'Gagal memuat data pengeluaran.'
  } finally {
    loading.value = false
  }
}

const submitExpense = async () => {
  if (!isValid.value || loadingSubmit.value) return

  loadingSubmit.value = true
  error.value = ''
  successMessage.value = ''
  
  try {
    const payload = {
      category: form.value.category,
      qty: Number(form.value.qty),
      price_per_item: Number(String(form.value.price_per_item).replace(/\D/g, '')),
      amount: amountPreview.value,
    }
    
    const newExpense = await addExpense(payload)
    expenses.value.unshift(newExpense)
    
    if (!categories.value.find(c => c.value === payload.category)) {
      categories.value.push({ label: payload.category, value: payload.category })
    }
    
    // Reset form
    form.value.category = ''
    form.value.qty = 1
    form.value.price_per_item = ''
    successMessage.value = 'Pengeluaran berhasil dicatat!'
    setTimeout(() => successMessage.value = '', 3000)
    
  } catch (err) {
    error.value = err.response?.data?.message || 'Gagal menambahkan pengeluaran.'
  } finally {
    loadingSubmit.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="flex h-[calc(100vh-5.5rem)] min-h-[500px] flex-col lg:h-[calc(100vh-10.5rem)] pb-20 lg:pb-0">
    <div class="mb-4">
      <h2 class="text-xl font-black text-slate-900">Pengeluaran Shift</h2>
      <p class="text-sm text-slate-500">Catat pengeluaran operasional selama shift berlangsung.</p>
    </div>
    
    <AppAlert v-if="error" type="error" :message="error" class="mb-4" dismissible @dismiss="error = ''" />
    <AppAlert v-if="successMessage" type="success" :message="successMessage" class="mb-4" dismissible @dismiss="successMessage = ''" />

    <div class="grid flex-1 gap-6 min-h-0 lg:grid-cols-5">
      <!-- Form Input -->
      <section class="flex flex-col min-h-0 lg:col-span-2">
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 class="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">Tambah Pengeluaran</h3>
          
          <div class="space-y-4">
            <div>
              <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Nama Pengeluaran</label>
              <AppCreatableSelect
                v-model="form.category"
                :options="categories"
                placeholder="Pilih atau ketik nama..."
              />
            </div>
            
            <div class="flex gap-4">
              <div class="w-24">
                <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Qty</label>
                <input
                  v-model="form.qty"
                  type="number"
                  min="0.01"
                  step="0.01"
                  class="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-center text-sm font-medium focus:border-merchant-primary focus:outline-none focus:ring-2 focus:ring-merchant-primary/20"
                />
              </div>
              <div class="flex-1">
                <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Harga Satuan</label>
                <div class="relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">Rp</span>
                  <input
                    v-model="form.price_per_item"
                    type="text"
                    class="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm font-medium focus:border-merchant-primary focus:outline-none focus:ring-2 focus:ring-merchant-primary/20"
                    placeholder="0"
                    @input="form.price_per_item = form.price_per_item.replace(/\D/g, '')"
                  />
                </div>
              </div>
            </div>
            
            <div class="rounded-xl bg-slate-50 p-4 border border-slate-100 flex items-center justify-between">
              <span class="text-sm font-bold text-slate-500">Total Harga</span>
              <span class="text-lg font-black text-merchant-primary">{{ formatRupiah(amountPreview) }}</span>
            </div>
            
            <AppButton
              class="w-full mt-2"
              variant="primary"
              :disabled="!isValid"
              :loading="loadingSubmit"
              @click="submitExpense"
            >
              <i class="pi pi-plus" /> Simpan Pengeluaran
            </AppButton>
          </div>
        </div>
      </section>

      <!-- History List -->
      <section class="flex flex-col min-h-0 lg:col-span-3">
        <div class="flex flex-col h-full rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div class="border-b border-slate-100 p-4 flex items-center justify-between bg-slate-50/50">
            <h3 class="text-sm font-bold uppercase tracking-wider text-slate-400">Riwayat Pengeluaran Shift Ini</h3>
            <span class="text-sm font-bold text-slate-900">Total: {{ formatRupiah(totalExpenses) }}</span>
          </div>
          
          <div class="flex-1 overflow-y-auto p-4 relative">
            <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
              <i class="pi pi-spin pi-spinner text-3xl text-merchant-primary" />
            </div>
            
            <div v-if="expenses.length" class="space-y-3">
              <div v-for="exp in expenses" :key="exp.id" class="flex items-center justify-between rounded-xl border border-slate-100 p-4 hover:bg-slate-50 transition">
                <div class="flex flex-col gap-1">
                  <span class="font-bold text-slate-900">{{ exp.category }}</span>
                  <div class="flex items-center gap-2 text-xs text-slate-500">
                    <span>{{ exp.qty }} x {{ formatRupiah(exp.price_per_item) }}</span>
                    <span class="w-1 h-1 rounded-full bg-slate-300"></span>
                    <span>{{ dayjs(exp.created_at).format('HH:mm') }}</span>
                  </div>
                </div>
                <span class="font-black text-rose-500">{{ formatRupiah(exp.amount) }}</span>
              </div>
            </div>
            
            <div v-else-if="!loading" class="flex h-full flex-col items-center justify-center text-slate-400 p-8 text-center">
              <i class="pi pi-inbox text-4xl mb-3 opacity-20" />
              <p class="font-medium">Belum ada pengeluaran di shift ini.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
