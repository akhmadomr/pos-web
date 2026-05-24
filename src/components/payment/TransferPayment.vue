<script setup>
import { formatRupiah } from '@/utils/currency'

defineProps({
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
</script>

<template>
  <div class="space-y-5">
    <div class="rounded-2xl bg-slate-800 p-4 text-center text-white">
      <p class="text-xs font-bold uppercase text-white/70">Total Transfer</p>
      <p class="font-mono text-3xl font-black">{{ formatRupiah(total) }}</p>
    </div>

    <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
      <p class="font-bold text-slate-800">Instruksi</p>
      <p class="mt-2">Transfer ke rekening outlet sesuai nominal di atas, lalu masukkan nomor referensi (opsional).</p>
    </div>

    <div>
      <label class="mb-2 block text-xs font-bold uppercase text-slate-400">No. Referensi (opsional)</label>
      <input
        :value="modelValue"
        type="text"
        placeholder="Contoh: TRF123456"
        class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold focus:border-merchant-primary focus:outline-none"
        @input="emit('update:modelValue', $event.target.value)"
      />
    </div>

    <button
      type="button"
      class="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-base font-black text-white"
      @click="emit('confirm')"
    >
      <i class="pi pi-check" />
      Konfirmasi transfer diterima
    </button>
  </div>
</template>
