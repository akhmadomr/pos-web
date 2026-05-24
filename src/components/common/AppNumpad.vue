<script setup>
import { computed } from 'vue'
import { formatRupiah } from '@/utils/currency'

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  confirmLabel: {
    type: String,
    default: 'Konfirmasi',
  },
  showConfirm: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['update:modelValue', 'confirm'])

const displayValue = computed(() => {
  const digits = props.modelValue.replace(/\D/g, '')
  return digits === '' ? '0' : digits
})

const formattedDisplay = computed(() => formatRupiah(displayValue.value))

const appendDigit = (digit) => {
  const current = props.modelValue.replace(/\D/g, '')
  if (current === '0') {
    emit('update:modelValue', digit)
    return
  }
  emit('update:modelValue', `${current}${digit}`)
}

const backspace = () => {
  const current = props.modelValue.replace(/\D/g, '')
  emit('update:modelValue', current.slice(0, -1))
}

const clearAll = () => {
  emit('update:modelValue', '')
}

const handleConfirm = () => {
  emit('confirm', displayValue.value)
}

const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫']
</script>

<template>
  <div class="space-y-4">
    <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-right">
      <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Jumlah</p>
      <p class="mt-1 font-mono text-3xl font-black tabular-nums text-slate-900 sm:text-4xl">
        {{ formattedDisplay }}
      </p>
    </div>

    <div class="grid grid-cols-3 gap-3">
      <button
        v-for="key in keys"
        :key="key"
        type="button"
        class="flex min-h-[60px] min-w-[60px] items-center justify-center rounded-2xl text-2xl font-black transition active:scale-95"
        :class="
          key === 'C'
            ? 'bg-slate-200 text-slate-600 hover:bg-slate-300'
            : key === '⌫'
              ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
              : 'bg-white text-slate-900 shadow-md ring-1 ring-slate-200 hover:bg-merchant-accent'
        "
        @click="
          key === 'C' ? clearAll() : key === '⌫' ? backspace() : appendDigit(key)
        "
      >
        <i v-if="key === '⌫'" class="pi pi-delete-left text-xl" />
        <span v-else>{{ key }}</span>
      </button>
    </div>

    <button
      v-if="showConfirm"
      type="button"
      class="flex min-h-[60px] w-full items-center justify-center gap-2 rounded-2xl bg-merchant-primary text-lg font-black text-white shadow-lg shadow-merchant-primary/30 transition active:scale-[0.98] hover:bg-merchant-primary/90"
      @click="handleConfirm"
    >
      <i class="pi pi-check" />
      {{ confirmLabel }}
    </button>
  </div>
</template>
