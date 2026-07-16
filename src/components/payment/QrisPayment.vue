<script setup>
import { formatRupiah } from '@/utils/currency'

defineProps({
  total: {
    type: Number,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  }
})

const emit = defineEmits(['confirm'])
</script>

<template>
  <div class="space-y-5 text-center">
    <div class="rounded-2xl bg-sky-500 p-4 text-white">
      <p class="text-xs font-bold uppercase text-white/80">Total Tagihan QRIS</p>
      <p class="font-mono text-3xl font-black">{{ formatRupiah(total) }}</p>
    </div>

    <div class="rounded-2xl border border-sky-100 bg-sky-50 p-5 text-sm text-sky-800">
      <div class="mb-3 flex justify-center">
        <i class="pi pi-qrcode text-4xl text-sky-500" />
      </div>
      <p class="font-bold">Pembayaran QRIS Manual (Statis/EDC)</p>
      <ul class="mt-3 space-y-2 text-left text-sky-700">
        <li class="flex items-start gap-2">
          <i class="pi pi-check-circle mt-0.5 text-sky-500" />
          <span>Arahkan pelanggan untuk men-scan QRIS toko (stiker akrilik / EDC).</span>
        </li>
        <li class="flex items-start gap-2">
          <i class="pi pi-check-circle mt-0.5 text-sky-500" />
          <span>Kasir <strong>wajib</strong> mengecek mutasi masuk di aplikasi rekening toko.</span>
        </li>
      </ul>
    </div>

    <button
      type="button"
      class="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 text-base font-black text-white shadow-lg transition-all hover:bg-sky-700 disabled:opacity-50"
      :disabled="loading"
      @click="emit('confirm')"
    >
      <i v-if="loading" class="pi pi-spin pi-spinner" />
      <i v-else class="pi pi-check-square" />
      Konfirmasi Dana Sudah Masuk
    </button>
  </div>
</template>
