<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppAlert from '@/components/common/AppAlert.vue'
import AppButton from '@/components/common/AppButton.vue'
import AppModal from '@/components/common/AppModal.vue'
import AppNumpad from '@/components/common/AppNumpad.vue'
import { closeShift, fetchShiftSummary } from '@/api/shifts'
import { useAuthStore } from '@/stores/auth.store'
import { useOrderStore } from '@/stores/order.store'
import { formatRupiah } from '@/utils/currency'
import { PAYMENT_METHOD_LABELS } from '@/utils/shift'
import { db } from '@/utils/db'
import { enqueue, SYNC_TYPE } from '@/services/SyncService'

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'closed'])

const router = useRouter()
const authStore = useAuthStore()
const orderStore = useOrderStore()

const isOfflineClose = ref(false)

const step = ref(0)

const picName = ref('')

const summary = ref(null)
const closingCash = ref('')
const loading = ref(false)
const loadingSummary = ref(false)
const error = ref('')
const apiWarnings = ref([])


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
  return Number(summary.value?.system_cash ?? 0)
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
    const summaryData = await fetchShiftSummary(authStore.user?.outlet_id)
    summary.value = summaryData
  } catch (err) {
    const isNetworkError = !navigator.onLine ||
      err.message === 'Network Error' ||
      err.name === 'TypeError' ||
      err.code === 'ECONNABORTED' ||
      (err.response && err.response.status >= 500)
    
    if (isNetworkError) {
      // Hitung dari IndexedDB: order yang ada di shift ini
      isOfflineClose.value = true
      const offlineOrders = await db.offline_orders.toArray()
      const completed = offlineOrders.filter(o => o.sync_status !== 'cancelled')
      const totalRevenue = completed.reduce((sum, o) => sum + (o.methodData?.amount ?? 0), 0)
      summary.value = {
        total_transactions: completed.length,
        total_revenue: totalRevenue,
        system_cash: Number(authStore.shift?.opening_cash ?? 0) + totalRevenue,
        payments_by_method: {},
        cash_diff_threshold: 10000,
        is_offline_summary: true,
      }
      error.value = 'Mode Offline: Ringkasan dikalkulasi dari data lokal.'
    } else {
      error.value = err.response?.data?.message || 'Gagal memuat ringkasan shift.'
      summary.value = null
    }
  } finally {
    loadingSummary.value = false
  }
}

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      step.value = 0
      picName.value = authStore.user?.name ?? ''
      closingCash.value = ''
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
    const closePayload = {
      closing_cash: closingCashAmount.value,
      notes: picName.value ? `Penanggung Jawab: ${picName.value}` : null,
      expenses: [],
    }

    try {
      const response = await closeShift(closePayload)
      authStore.setShift(null)
      apiWarnings.value = response.warnings ?? []
      
      // Auto-print struk shift
      try {
        if (response.data?.id) {
          const { fetchShiftReceipt } = await import('@/api/shifts')
          const { usePrinter } = await import('@/composables/usePrinter')
          const receiptData = await fetchShiftReceipt(response.data.id)
          if (receiptData?.data?.receipt_lines) {
            const printer = usePrinter()
            await printer.printShiftReceipt(receiptData.data.receipt_lines)
          }
        }
      } catch (err) {
        console.error('Gagal cetak struk shift otomatis', err)
      }

      emit('closed', response.data)
      emit('close')
      if (apiWarnings.value.length) {
        window.alert(apiWarnings.value.join('\n'))
      }
      router.push({ name: 'shift-open' })
    } catch (err) {
      const isNetworkError = !navigator.onLine ||
        err.message === 'Network Error' ||
        err.name === 'TypeError' ||
        err.code === 'ECONNABORTED' ||
        (err.response && err.response.status >= 500)

      if (isNetworkError) {
        // OFFLINE: simpan lokal dan masukkan ke antrian sync
        const localId = authStore.shift?.local_id ?? authStore.shift?.id
        const now = new Date().toISOString()
        
        await db.shifts.where('local_id').equals(localId).modify({
          closing_cash: closingCashAmount.value,
          status: 'closed',
          closed_at: now,
          sync_status: 'pending_close',
        }).catch(() => {})

        await enqueue(SYNC_TYPE.CLOSE_SHIFT, closePayload, localId)

        authStore.setShift(null)
        emit('closed', null)
        emit('close')
        router.push({ name: 'shift-open' })
      } else {
        error.value = err.data?.message || err.response?.data?.message || 'Gagal menutup shift.'
      }
    }
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
      <!-- Step 0: Penanggung Jawab -->
      <div v-if="step === 0" class="space-y-6 py-2">
        <div class="flex items-center justify-center">
          <div class="flex h-20 w-20 items-center justify-center rounded-full bg-merchant-primary/10">
            <i class="pi pi-user text-4xl text-merchant-primary" />
          </div>
        </div>
        <div class="text-center">
          <h3 class="text-lg font-black text-slate-900">Konfirmasi Penanggung Jawab</h3>
          <p class="mt-1 text-sm text-slate-500">Pastikan nama penanggung jawab shift ini sudah benar sebelum melanjutkan.</p>
        </div>
        <div class="space-y-1.5">
          <label class="text-xs font-bold uppercase tracking-wider text-slate-500">Nama Penanggung Jawab</label>
          <div class="relative">
            <i class="pi pi-user absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              v-model="picName"
              type="text"
              placeholder="Nama penanggung jawab shift..."
              class="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm font-semibold focus:border-merchant-primary focus:outline-none focus:ring-2 focus:ring-merchant-primary/20"
            />
          </div>
          <p class="text-xs text-slate-400">Terisi otomatis dari akun yang sedang login. Dapat diubah jika diperlukan.</p>
        </div>
      </div>

      <div v-else-if="step === 1" class="grid gap-4 lg:gap-6 lg:grid-cols-2">
        <div class="space-y-2 sm:space-y-4">
          <h4 class="hidden sm:block text-sm font-bold uppercase tracking-wider text-slate-400">Ringkasan Shift</h4>

          <div class="grid gap-2 sm:gap-3 grid-cols-2">
            <div class="rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50 p-2 sm:p-4 text-center sm:text-left">
              <p class="text-[10px] sm:text-xs font-bold uppercase text-slate-400">Total TRX</p>
              <p class="mt-0.5 sm:mt-1 text-lg sm:text-2xl font-black text-slate-900">{{ summary.total_transactions }}</p>
            </div>
            <div class="rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50 p-2 sm:p-4 text-center sm:text-left">
              <p class="text-[10px] sm:text-xs font-bold uppercase text-slate-400">Pendapatan</p>
              <p class="mt-0.5 sm:mt-1 text-lg sm:text-xl font-black text-slate-900">{{ formatRupiah(summary.total_revenue) }}</p>
            </div>
          </div>

          <div class="rounded-xl sm:rounded-2xl border border-slate-100 bg-white p-2 sm:p-4">
            <p class="mb-1.5 sm:mb-3 text-[10px] sm:text-xs font-bold uppercase text-slate-400">Per Metode Bayar</p>
            <ul v-if="paymentRows.length" class="space-y-1 sm:space-y-2">
              <li
                v-for="row in paymentRows"
                :key="row.method"
                class="flex items-center justify-between text-xs sm:text-sm font-semibold"
              >
                <span class="flex items-center gap-1.5 sm:gap-2 text-slate-600">
                  <i
                    :class="[
                      'pi text-[10px] sm:text-base',
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
            <p v-else class="text-[10px] sm:text-sm text-slate-400">Belum ada pembayaran.</p>
          </div>

          <div class="rounded-xl sm:rounded-2xl border border-merchant-primary/20 bg-merchant-accent p-2 sm:p-4 text-center sm:text-left">
            <p class="text-[10px] sm:text-xs font-bold uppercase text-slate-500">Kas Menurut Sistem</p>
            <p class="mt-0.5 sm:mt-1 text-xl sm:text-2xl font-black text-merchant-primary">{{ formatRupiah(systemCash) }}</p>
            <p class="mt-0.5 sm:mt-1 text-[9px] sm:text-xs text-slate-500">
              Kas awal {{ formatRupiah(summary.opening_cash) }} + jualan
              <span v-if="summary.total_expenses > 0">- keluar {{ formatRupiah(summary.total_expenses) }}</span>
            </p>
          </div>

          <div
            v-if="closingCash"
            class="rounded-xl sm:rounded-2xl border p-2 sm:p-4 text-center sm:text-left"
            :class="
              showCashWarning
                ? 'border-amber-300 bg-amber-50'
                : cashDifference === 0
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-slate-200 bg-slate-50'
            "
          >
            <p class="text-[10px] sm:text-xs font-bold uppercase text-slate-500">Selisih Kas</p>
            <p
              class="mt-0.5 sm:mt-1 text-xl sm:text-2xl font-black"
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
            <p v-if="showCashWarning" class="mt-1 sm:mt-2 text-[9px] sm:text-xs font-semibold text-amber-800">
              <i class="pi pi-exclamation-triangle" />
              Selisih melebihi {{ formatRupiah(threshold) }}
            </p>
          </div>
        </div>

        <div>
          <h4 class="hidden sm:block text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">Kas Fisik Saat Ini</h4>

          <AppNumpad
            v-model="closingCash"
            :show-confirm="false"
          />
        </div>
      </div>


      <AppAlert v-if="error" type="error" :message="error" class="mt-4" dismissible @dismiss="error = ''" />
    </template>

    <template #footer>
      <div v-if="step === 0" class="flex gap-2 w-full">
        <AppButton variant="secondary" @click="handleClose" class="flex-1">Batal</AppButton>
        <AppButton
          variant="primary"
          class="flex-1"
          :disabled="!picName.trim()"
          @click="step = 1"
        >
          Lanjut Input Kas
          <i class="pi pi-arrow-right ml-2" />
        </AppButton>
      </div>
      <div v-else-if="step === 1" class="flex gap-2 w-full">
        <AppButton variant="secondary" @click="step = 0" class="flex-1">
          <i class="pi pi-arrow-left mr-1" />
          <span class="hidden sm:inline">Kembali</span>
          <span class="sm:hidden">Back</span>
        </AppButton>
        <AppButton 
          variant="danger" 
          class="flex-1"
          :disabled="closingCashAmount < 0 || closingCash === ''"
          :loading="loading"
          @click="submitCloseShift"
        >
          <i class="pi pi-sign-out sm:mr-1" />
          <span class="hidden sm:inline">Tutup Shift</span>
          <span class="sm:hidden">Tutup</span>
        </AppButton>
      </div>
    </template>
  </AppModal>
</template>
