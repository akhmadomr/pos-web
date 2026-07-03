<script setup>
import { computed } from 'vue'
import AppNumpad from '@/components/common/AppNumpad.vue'
import { formatRupiah } from '@/utils/currency'

const props = defineProps({
  total: {
    type: Number,
    required: true,
  },
  modelValue: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:modelValue', 'confirm'])

const received = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const receivedAmount = computed(() => Number(String(received.value).replace(/\D/g, '') || 0))

const change = computed(() => Math.max(0, receivedAmount.value - props.total))

const isValid = computed(() => receivedAmount.value >= props.total)

const shortcuts = computed(() => {
  const total = props.total
  return [
    { label: 'Pas', value: Math.ceil(total / 1000) * 1000 || total },
    { label: '20rb', value: 20000 },
    { label: '30rb', value: 30000 },
    { label: '40rb', value: 40000 },
    { label: '50rb', value: 50000 },
    { label: '100rb', value: 100000 },
    { label: '150rb', value: 150000 },
    { label: '200rb', value: 200000 },
  ]
})

const applyShortcut = (amount) => {
  received.value = String(amount)
}
</script>

<template>
  <div class="space-y-5">
    <div class="rounded-2xl bg-merchant-primary p-6 text-center text-white">
      <p class="text-xs font-bold uppercase tracking-wider text-white/70">Total Bayar</p>
      <p class="mt-2 font-mono text-4xl font-black">{{ formatRupiah(total) }}</p>
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        v-for="btn in shortcuts"
        :key="btn.label"
        type="button"
        class="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-merchant-accent"
        @click="applyShortcut(btn.value)"
      >
        {{ btn.label }}
      </button>
    </div>

    <AppNumpad
      v-model="received"
      confirm-label="Konfirmasi"
      :show-confirm="false"
    />

    <div
      class="rounded-2xl border-2 p-4 text-center"
      :class="isValid ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'"
    >
      <p class="text-xs font-bold uppercase text-slate-500">Kembalian</p>
      <p
        class="mt-1 font-mono text-3xl font-black"
        :class="isValid ? 'text-emerald-700' : 'text-amber-700'"
      >
        {{ isValid ? formatRupiah(change) : 'Uang kurang' }}
      </p>
    </div>
  </div>
</template>
