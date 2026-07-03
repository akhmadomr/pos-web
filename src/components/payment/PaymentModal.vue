<script setup>
import { computed, ref, watch } from 'vue'
import AppAlert from '@/components/common/AppAlert.vue'
import AppButton from '@/components/common/AppButton.vue'
import CashPayment from '@/components/payment/CashPayment.vue'
import QrisPayment from '@/components/payment/QrisPayment.vue'
import TransferPayment from '@/components/payment/TransferPayment.vue'
import OrderSummary from '@/components/order/OrderSummary.vue'
import { createOrder } from '@/api/orders'
import { fetchTables } from '@/api/tables'
import { usePayment } from '@/composables/usePayment'
import { useAuthStore } from '@/stores/auth.store'
import { useCartStore } from '@/stores/cart.store'
import { formatRupiah } from '@/utils/currency'

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'paid'])

const authStore = useAuthStore()
const cartStore = useCartStore()
const payment = usePayment()

const step = ref(1)
const tables = ref([])
const loadingTables = ref(false)

const paymentMethods = [
  { id: 'cash', label: 'Tunai', icon: 'pi-money-bill', color: 'bg-emerald-500' },
  { id: 'qris', label: 'QRIS', icon: 'pi-qrcode', color: 'bg-sky-500' },
  { id: 'transfer', label: 'Transfer', icon: 'pi-building-columns', color: 'bg-violet-500' },
]

const canProceedStep1 = computed(() => {
  if (cartStore.orderType === 'dine_in' && !cartStore.tableId) return false
  return true
})

const cashReceivedNum = computed(() =>
  Number(String(payment.cashReceived.value).replace(/\D/g, '') || 0),
)

// ─── BUG FIX: akses .value dari ref ───────────────────────────────────────────
const currentMethod = computed(() => payment.paymentMethod.value)
const hasError = computed(() => !!payment.error.value)
const errorMessage = computed(() => payment.error.value)
const isProcessing = computed(() => payment.isProcessing.value)

const canConfirm = computed(() => {
  if (isProcessing.value) return false
  if (!currentMethod.value) return false
  if (currentMethod.value === 'cash') {
    return cashReceivedNum.value >= cartStore.total
  }
  return true
})

// Tombol konfirmasi di footer muncul untuk cash;
// QRIS & Transfer punya tombol confirm di dalam komponen masing-masing
const showFooterConfirm = computed(() => step.value === 3 && currentMethod.value === 'cash')

const loadTables = async () => {
  loadingTables.value = true
  try {
    tables.value = await fetchTables(authStore.outletId)
  } catch {
    tables.value = []
  } finally {
    loadingTables.value = false
  }
}

const resetModal = () => {
  step.value = 1
  payment.resetPayment()
}

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      resetModal()
      if (cartStore.orderType === 'dine_in') {
        loadTables()
      }
    } else {
      document.body.style.overflow = ''
    }
  },
)

watch(step, () => {
  if (props.show) {
    document.body.style.overflow = 'hidden'
  }
})

const close = () => emit('close')

const nextStep = () => {
  if (step.value < 3) step.value += 1
}

const prevStep = () => {
  if (step.value > 1) {
    if (step.value === 3) {
      payment.setMethod(null)
    }
    step.value -= 1
  }
}

const selectMethod = (methodId) => {
  payment.setMethod(methodId)
  step.value = 3
}

const setOrderType = (type) => {
  cartStore.setOrderType(type)
  if (type === 'dine_in' && !tables.value.length) {
    loadTables()
  }
}

const handleConfirm = async () => {
  if (!canConfirm.value) return

  try {
    const order = await createOrder(
      cartStore.buildOrderPayload(authStore.outletId, authStore.shift?.id),
    )

    const amount =
      currentMethod.value === 'cash' ? cashReceivedNum.value : cartStore.total

    const result = await payment.processPayment(
      order.id,
      {
        payment_method: currentMethod.value,
        amount,
        reference_number: payment.referenceNumber.value || null,
      },
      cartStore.total,
    )

    emit('paid', {
      order,
      payment: result,
      receipt_data: result.receipt_data,
      change_amount: result.change_amount ?? 0,
    })
  } catch {
    // error sudah di-set oleh payment.error di usePayment
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="show" class="fixed inset-0 z-[130] flex flex-col bg-white lg:flex lg:items-center lg:justify-center lg:bg-slate-900/50 lg:p-4">
        <div class="absolute inset-0 hidden bg-slate-900/40 lg:block" @click="close" />

        <div
          class="relative flex h-full max-h-full w-full flex-col bg-white lg:h-auto lg:max-h-[92vh] lg:max-w-2xl lg:rounded-3xl lg:shadow-2xl"
        >
          <header class="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-4 lg:px-6">
            <div>
              <p class="text-xs font-bold uppercase text-slate-400">Pembayaran · Langkah {{ step }}/3</p>
              <h2 class="text-xl font-black text-slate-900">Proses Pembayaran</h2>
            </div>
            <button
              type="button"
              class="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100"
              @click="close"
            >
              <i class="pi pi-times" />
            </button>
          </header>

          <div class="min-h-0 flex-1 overflow-y-auto px-4 py-5 lg:px-6">
            <!-- Error hanya tampil saat ada pesan error aktual -->
            <AppAlert v-if="hasError" type="error" :message="errorMessage" class="mb-4" />

            <!-- Step 1: Order type -->
            <div v-if="step === 1" class="space-y-5">
              <p class="text-sm text-slate-500">Pilih tipe order untuk melanjutkan.</p>

              <div class="flex gap-2">
                <button
                  type="button"
                  class="flex-1 rounded-xl py-3 text-sm font-bold transition"
                  :class="
                    cartStore.orderType === 'dine_in'
                      ? 'bg-merchant-primary text-white shadow-lg'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  "
                  @click="setOrderType('dine_in')"
                >
                  Dine In
                </button>
                <button
                  type="button"
                  class="flex-1 rounded-xl py-3 text-sm font-bold transition"
                  :class="
                    cartStore.orderType === 'take_away'
                      ? 'bg-merchant-primary text-white shadow-lg'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  "
                  @click="setOrderType('take_away')"
                >
                  Take Away
                </button>
              </div>

              <div v-if="cartStore.orderType === 'dine_in'">
                <label class="mb-2 block text-xs font-bold uppercase text-slate-400">Pilih Meja</label>
                <select
                  :value="cartStore.tableId ?? ''"
                  class="w-full rounded-xl border border-slate-200 px-4 py-3 font-semibold"
                  @change="cartStore.setTable($event.target.value ? Number($event.target.value) : null)"
                >
                  <option value="">Pilih meja...</option>
                  <option v-for="table in tables" :key="table.id" :value="table.id">
                    {{ table.table_number }}{{ table.name ? ` — ${table.name}` : '' }}
                  </option>
                </select>
              </div>
            </div>

            <!-- Step 2: Summary + pilih metode bayar -->
            <div v-else-if="step === 2" class="space-y-5">
              <!-- Ringkasan item -->
              <div class="max-h-44 space-y-2 overflow-y-auto rounded-2xl bg-slate-50 p-3">
                <div
                  v-for="item in cartStore.items"
                  :key="item.id"
                  class="flex justify-between text-sm"
                >
                  <span class="font-medium text-slate-700">
                    {{ item.quantity }}× {{ item.product_name }}
                    <span v-if="item.variant_label" class="text-slate-400">({{ item.variant_label }})</span>
                  </span>
                  <span class="font-bold text-slate-900">
                    {{ formatRupiah((Number(item.unit_price) + Number(item.addons_price)) * item.quantity) }}
                  </span>
                </div>
              </div>

              <!-- Total (tanpa baris pajak terpisah) -->
              <OrderSummary :show-extras="false" />

              <!-- Pilih metode bayar -->
              <div>
                <p class="mb-3 text-xs font-bold uppercase text-slate-400">Metode Pembayaran</p>
                <div class="grid gap-3 sm:grid-cols-3">
                  <button
                    v-for="method in paymentMethods"
                    :key="method.id"
                    type="button"
                    class="flex min-h-[90px] flex-col items-center justify-center gap-2 rounded-2xl text-white shadow-lg transition active:scale-95 hover:opacity-90"
                    :class="method.color"
                    @click="selectMethod(method.id)"
                  >
                    <i :class="['pi text-2xl', method.icon]" />
                    <span class="text-sm font-black">{{ method.label }}</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Step 3: Input pembayaran -->
            <div v-else class="space-y-4">
              <CashPayment
                v-if="currentMethod === 'cash'"
                v-model="payment.cashReceived.value"
                :total="cartStore.total"
              />

              <QrisPayment
                v-else-if="currentMethod === 'qris'"
                :total="cartStore.total"
                :loading="isProcessing"
                @confirm="handleConfirm"
              />

              <TransferPayment
                v-else-if="currentMethod === 'transfer'"
                v-model="payment.referenceNumber.value"
                :total="cartStore.total"
                :loading="isProcessing"
                @confirm="handleConfirm"
              />
            </div>
          </div>

          <!-- Footer dengan tombol aksi -->
          <footer class="shrink-0 border-t border-slate-100 bg-slate-50/80 p-4 lg:px-6">
            <div class="flex gap-3">
              <!-- Kembali: step 2 kembali ke 1, step 3 kembali ke 2 (ubah metode) -->
              <AppButton
                v-if="step > 1"
                variant="secondary"
                class="flex-1"
                @click="prevStep"
              >
                <i class="pi pi-arrow-left" />
                {{ step === 3 ? 'Ganti Metode' : 'Kembali' }}
              </AppButton>

              <!-- Step 1: Lanjut ke pilih metode -->
              <AppButton
                v-if="step === 1"
                class="flex-1"
                :disabled="!canProceedStep1"
                @click="nextStep"
              >
                Lanjut
                <i class="pi pi-arrow-right" />
              </AppButton>

              <!-- Step 3, metode cash: tombol konfirmasi di footer -->
              <AppButton
                v-if="showFooterConfirm"
                class="flex-1 py-4"
                :loading="isProcessing"
                :disabled="!canConfirm"
                @click="handleConfirm"
              >
                <i class="pi pi-check" />
                Konfirmasi Bayar — {{ formatRupiah(cartStore.total) }}
              </AppButton>
            </div>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
