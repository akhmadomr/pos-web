<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppAlert from '@/components/common/AppAlert.vue'
import AppButton from '@/components/common/AppButton.vue'
import AppModal from '@/components/common/AppModal.vue'
import AppNumpad from '@/components/common/AppNumpad.vue'
import { closeShift, fetchShiftSummary } from '@/api/shifts'
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

const systemCash = computed(() => Number(summary.value?.system_cash ?? 0))
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
    summary.value = await fetchShiftSummary(authStore.user?.outlet_id)
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
    const response = await closeShift({
      closing_cash: closingCashAmount.value,
      notes: notes.value.trim() || null,
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
            </p>
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
