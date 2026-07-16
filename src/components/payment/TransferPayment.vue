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
  loading: {
    type: Boolean,
    default: false,
  }
})

const emit = defineEmits(['update:modelValue', 'confirm'])
</script>

<template>
  <div class="space-y-5 text-left">
    <div class="rounded-2xl bg-violet-600 p-4 text-center text-white">
      <p class="text-xs font-bold uppercase text-white/80">Total Tagihan Transfer</p>
      <p class="font-mono text-3xl font-black">{{ formatRupiah(total) }}</p>
    </div>

    <div class="rounded-2xl border border-violet-100 bg-violet-50 p-5 text-sm text-violet-800">
      <div class="mb-3 flex justify-center">
        <i class="pi pi-building-columns text-4xl text-violet-500" />
      </div>
      <p class="font-bold">Transfer Manual</p>
      <ul class="mt-3 space-y-2 text-violet-700">
        <li class="flex items-start gap-2">
          <i class="pi pi-check-circle mt-0.5 text-violet-500" />
          <span>Berikan nomor rekening toko kepada pelanggan.</span>
        </li>
        <li class="flex items-start gap-2">
          <i class="pi pi-check-circle mt-0.5 text-violet-500" />
          <span>Kasir <strong>wajib</strong> mengecek mutasi rekening sebelum melakukan konfirmasi pesanan.</span>
        </li>
      </ul>
    </div>

    <div>
      <label class="mb-2 block text-xs font-bold uppercase text-slate-400">No. Referensi Bank (Opsional)</label>
      <input
        :value="modelValue"
        type="text"
        placeholder="Cth: TRF123456"
        class="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
        @input="emit('update:modelValue', $event.target.value)"
      />
    </div>

    <button
      type="button"
      class="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 text-base font-black text-white shadow-lg transition-all hover:bg-violet-700 disabled:opacity-50"
      :disabled="loading"
      @click="emit('confirm')"
    >
      <i v-if="loading" class="pi pi-spin pi-spinner" />
      <i v-else class="pi pi-check-square" />
      Konfirmasi Dana Sudah Masuk
    </button>
  </div>
</template>
