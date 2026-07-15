<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppAlert from '@/components/common/AppAlert.vue'
import AppButton from '@/components/common/AppButton.vue'
import AppModal from '@/components/common/AppModal.vue'
import AppNumpad from '@/components/common/AppNumpad.vue'
import AppCreatableSelect from '@/components/common/AppCreatableSelect.vue'
import { closeShift, fetchShiftSummary, fetchExpenseCategories } from '@/api/shifts'
import { useAuthStore } from '@/stores/auth.store'
import { formatRupiah } from '@/utils/currency'
import { PAYMENT_METHOD_LABELS } from '@/utils/shift'

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'closed'])

const router = useRouter()
const authStore = useAuthStore()

const summary = ref(null)
const closingCash = ref('')
const notes = ref('')
const loading = ref(false)
const loadingSummary = ref(false)
const error = ref('')
const apiWarnings = ref([])

const expenses = ref([])
const expenseCategories = ref([])

const addExpense = () => {
  expenses.value.push({ category: '', qty: 1, price_per_item: '', amount: 0 })
}

const removeExpense = (index) => {
  expenses.value.splice(index, 1)
}

const calculateExpenseAmount = (exp) => {
  const qty = Number(exp.qty) || 0
  const price = Number(String(exp.price_per_item).replace(/\D/g, '')) || 0
  exp.amount = qty * price
}

const totalExpenses = computed(() => {
  return expenses.value.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0)
})

const paymentRows = computed(() => {
  if (!summary.value?.payments_by_method) return []

  return Object.entries(summary.value.payments_by_method)
    .filter(([, total]) => Number(total) > 0)
    .map(([method, total]) => ({
      method,
      label: PAYMENT_METHOD_LABELS[method] ?? method,
      total: Number(total),
    }))
})

const systemCash = computed(() => {
  const base = Number(summary.value?.system_cash ?? 0)
  return base - totalExpenses.value
})
const threshold = computed(() => Number(summary.value?.cash_diff_threshold ?? 10000))

const closingCashAmount = computed(() => Number(closingCash.value.replace(/\D/g, '') || 0))

const cashDifference = computed(() => closingCashAmount.value - systemCash.value)

const showCashWarning = computed(
  () => props.show && closingCash.value !== '' && Math.abs(cashDifference.value) > threshold.value,
)

const loadSummary = async () => {
  loadingSummary.value = true
  error.value = ''
  try {
    const [summaryData, categories] = await Promise.all([
      fetchShiftSummary(authStore.user?.outlet_id),
      fetchExpenseCategories(),
    ])
    summary.value = summaryData
    expenseCategories.value = categories.map(c => ({ label: c, value: c }))
  } catch (err) {
    error.value = err.response?.data?.message || 'Gagal memuat ringkasan shift.'
    summary.value = null
  } finally {
    loadingSummary.value = false
  }
}

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      closingCash.value = ''
      notes.value = ''
      expenses.value = []
      apiWarnings.value = []
      loadSummary()
    }
  },
)

const handleClose = () => emit('close')

const submitCloseShift = async () => {
  error.value = ''
  apiWarnings.value = []

  if (closingCashAmount.value < 0) {
    error.value = 'Kas fisik tidak valid.'
    return
  }

  loading.value = true
  try {
    const formattedExpenses = expenses.value
      .filter(e => e.category && Number(e.amount) > 0)
      .map(e => ({
        category: e.category,
        qty: Number(e.qty) || 1,
        price_per_item: Number(String(e.price_per_item).replace(/\D/g, '')) || 0,
        amount: Number(e.amount),
      }))

    const response = await closeShift({
      closing_cash: closingCashAmount.value,
      notes: notes.value.trim() || null,
      expenses: formattedExpenses,
    })

    authStore.setShift(null)
    apiWarnings.value = response.warnings ?? []

    emit('closed', response.data)
    emit('close')

    if (apiWarnings.value.length) {
      window.alert(apiWarnings.value.join('\n'))
    }

    router.push({ name: 'shift-open' })
  } catch (err) {
    error.value = err.data?.message || err.response?.data?.message || 'Gagal menutup shift.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AppModal :show="show" title="Tutup Shift" size="xl" @close="handleClose">
    <div v-if="loadingSummary" class="flex justify-center py-12">
      <i class="pi pi-spin pi-spinner text-3xl text-merchant-primary" />
    </div>

    <template v-else-if="summary">
      <div class="grid gap-6 lg:grid-cols-2">
        <div class="space-y-4">
          <h4 class="text-sm font-bold uppercase tracking-wider text-slate-400">Ringkasan Shift</h4>

          <div class="grid gap-3 sm:grid-cols-2">
            <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p class="text-xs font-bold uppercase text-slate-400">Total Transaksi</p>
              <p class="mt-1 text-2xl font-black text-slate-900">{{ summary.total_transactions }}</p>
            </div>
            <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p class="text-xs font-bold uppercase text-slate-400">Pendapatan Sistem</p>
              <p class="mt-1 text-xl font-black text-slate-900">{{ formatRupiah(summary.total_revenue) }}</p>
            </div>
          </div>

          <div class="rounded-2xl border border-slate-100 bg-white p-4">
            <p class="mb-3 text-xs font-bold uppercase text-slate-400">Per Metode Bayar</p>
            <ul v-if="paymentRows.length" class="space-y-2">
              <li
                v-for="row in paymentRows"
                :key="row.method"
                class="flex items-center justify-between text-sm font-semibold"
              >
                <span class="flex items-center gap-2 text-slate-600">
                  <i
                    :class="[
                      'pi',
                      row.method === 'cash'
                        ? 'pi-money-bill'
                        : row.method === 'qris'
                          ? 'pi-qrcode'
                          : 'pi-credit-card',
                    ]"
                  />
                  {{ row.label }}
                </span>
                <span class="text-slate-900">{{ formatRupiah(row.total) }}</span>
              </li>
            </ul>
            <p v-else class="text-sm text-slate-400">Belum ada pembayaran tercatat.</p>
          </div>

          <div class="rounded-2xl border border-merchant-primary/20 bg-merchant-accent p-4">
            <p class="text-xs font-bold uppercase text-slate-500">Kas Menurut Sistem</p>
            <p class="mt-1 text-2xl font-black text-merchant-primary">{{ formatRupiah(systemCash) }}</p>
            <p class="mt-1 text-xs text-slate-500">
              Kas awal {{ formatRupiah(summary.opening_cash) }} + penjualan tunai bersih
              <span v-if="totalExpenses > 0">- pengeluaran {{ formatRupiah(totalExpenses) }}</span>
            </p>
          </div>

          <!-- Expenses Section -->
          <div class="rounded-2xl border border-slate-100 bg-white p-4">
            <div class="mb-3 flex items-center justify-between">
              <p class="text-xs font-bold uppercase text-slate-400">Pengeluaran</p>
              <button
                type="button"
                class="text-xs font-bold text-merchant-primary hover:text-merchant-primary/80"
                @click="addExpense"
              >
                + Tambah
              </button>
            </div>
            
            <div v-if="expenses.length" class="space-y-4">
              <div v-for="(exp, index) in expenses" :key="index" class="relative rounded-xl border border-slate-100 bg-slate-50 p-3">
                <button
                  type="button"
                  class="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors"
                  @click="removeExpense(index)"
                >
                  <i class="pi pi-times text-xs" />
                </button>
                <div class="mb-3">
                  <label class="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Nama</label>
                  <AppCreatableSelect
                    v-model="exp.category"
                    :options="expenseCategories"
                    placeholder="Nama pengeluaran..."
                  />
                </div>
                <div class="flex gap-2">
                  <div class="w-16">
                    <label class="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Qty</label>
                    <input
                      v-model="exp.qty"
                      type="number"
                      min="1"
                      class="w-full rounded-xl border border-slate-200 px-2 py-2 text-center text-sm font-medium focus:border-merchant-primary focus:outline-none focus:ring-2 focus:ring-merchant-primary/20"
                      @input="calculateExpenseAmount(exp)"
                    />
                  </div>
                  <div class="flex-1">
                    <label class="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Harga per Item</label>
                    <div class="relative">
                      <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">Rp</span>
                      <input
                        v-model="exp.price_per_item"
                        type="text"
                        class="w-full rounded-xl border border-slate-200 py-2 pl-10 pr-3 text-sm font-medium focus:border-merchant-primary focus:outline-none focus:ring-2 focus:ring-merchant-primary/20"
                        placeholder="0"
                        @input="exp.price_per_item = exp.price_per_item.replace(/\D/g, ''); calculateExpenseAmount(exp)"
                      />
                    </div>
                  </div>
                </div>
                <div class="mt-2 text-right">
                  <p class="text-[10px] font-bold uppercase text-slate-400">Total</p>
                  <p class="text-sm font-black text-rose-500">{{ formatRupiah(exp.amount) }}</p>
                </div>
              </div>
            </div>
            <p v-else class="text-sm text-slate-400">Tidak ada pengeluaran tambahan.</p>
          </div>
        </div>

        <div class="space-y-4">
          <h4 class="text-sm font-bold uppercase tracking-wider text-slate-400">Kas Fisik Saat Ini</h4>

          <AppNumpad
            v-model="closingCash"
            confirm-label="Tutup Shift"
            @confirm="submitCloseShift"
          />

          <div
            v-if="closingCash"
            class="rounded-2xl border p-4"
            :class="
              showCashWarning
                ? 'border-amber-300 bg-amber-50'
                : cashDifference === 0
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-slate-200 bg-slate-50'
            "
          >
            <p class="text-xs font-bold uppercase text-slate-500">Selisih Kas</p>
            <p
              class="mt-1 text-2xl font-black"
              :class="
                showCashWarning
                  ? 'text-amber-700'
                  : cashDifference === 0
                    ? 'text-emerald-700'
                    : cashDifference > 0
                      ? 'text-sky-700'
                      : 'text-rose-700'
              "
            >
              {{ cashDifference >= 0 ? '+' : '' }}{{ formatRupiah(cashDifference) }}
            </p>
            <p v-if="showCashWarning" class="mt-2 text-xs font-semibold text-amber-800">
              <i class="pi pi-exclamation-triangle" />
              Selisih melebihi {{ formatRupiah(threshold) }} — pastikan perhitungan kas sudah benar.
            </p>
          </div>

          <div>
            <label class="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Catatan</label>
            <textarea
              v-model="notes"
              rows="3"
              placeholder="Opsional — misalnya selisih karena kembalian"
              class="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-merchant-primary focus:outline-none focus:ring-2 focus:ring-merchant-primary/20"
            />
          </div>
        </div>
      </div>

      <AppAlert v-if="error" type="error" :message="error" class="mt-4" dismissible @dismiss="error = ''" />
    </template>

    <template #footer>
      <AppButton variant="secondary" @click="handleClose">Batal</AppButton>
      <AppButton variant="danger" :loading="loading" @click="submitCloseShift">
        <i class="pi pi-sign-out" />
        Tutup Shift
      </AppButton>
    </template>
  </AppModal>
</template>
