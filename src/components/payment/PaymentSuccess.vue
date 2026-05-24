<script setup>
import { watch } from 'vue'
import { formatRupiah } from '@/utils/currency'

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  orderNumber: {
    type: String,
    default: '',
  },
  total: {
    type: Number,
    default: 0,
  },
  changeAmount: {
    type: Number,
    default: 0,
  },
  paymentMethod: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['done'])

const methodLabels = {
  cash: 'Tunai',
  qris: 'QRIS',
  transfer: 'Transfer',
}

let timer = null

watch(
  () => props.show,
  (visible) => {
    if (timer) clearTimeout(timer)
    if (visible) {
      timer = window.setTimeout(() => emit('done'), 3000)
    }
  },
)
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
      <div
        v-if="show"
        class="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      >
        <div class="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl">
          <div
            class="mx-auto mb-6 flex h-24 w-24 animate-[pop_0.4s_ease-out] items-center justify-center rounded-full bg-emerald-100"
          >
            <i class="pi pi-check text-5xl text-emerald-600" />
          </div>

          <h2 class="text-2xl font-black text-slate-900">Pembayaran Berhasil</h2>
          <p class="mt-2 font-mono text-lg font-bold text-merchant-primary">{{ orderNumber }}</p>

          <p class="mt-4 text-sm text-slate-500">
            {{ methodLabels[paymentMethod] ?? paymentMethod }}
          </p>
          <p class="mt-1 font-mono text-3xl font-black text-slate-900">{{ formatRupiah(total) }}</p>

          <p v-if="changeAmount > 0" class="mt-4 rounded-2xl bg-emerald-50 py-3 text-emerald-800">
            Kembalian:
            <span class="font-black">{{ formatRupiah(changeAmount) }}</span>
          </p>

          <p class="mt-6 text-xs text-slate-400">Menutup otomatis...</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
@keyframes pop {
  0% {
    transform: scale(0.5);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
