<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { formatRupiah } from '@/utils/currency'

const props = defineProps({
  total: {
    type: Number,
    required: true,
  },
})

const emit = defineEmits(['confirm'])

const secondsLeft = ref(300)
let timer = null

const minutesLabel = computed(() => {
  const m = Math.floor(secondsLeft.value / 60)
  const s = secondsLeft.value % 60
  return `${m}:${String(s).padStart(2, '0')}`
})

onMounted(() => {
  timer = window.setInterval(() => {
    if (secondsLeft.value > 0) {
      secondsLeft.value -= 1
    }
  }, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="space-y-5 text-center">
    <div class="rounded-2xl bg-merchant-primary p-4 text-white">
      <p class="text-xs font-bold uppercase text-white/70">Total QRIS</p>
      <p class="font-mono text-3xl font-black">{{ formatRupiah(total) }}</p>
    </div>

    <div class="mx-auto flex h-48 w-48 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50">
      <div class="text-center">
        <i class="pi pi-qrcode mb-2 text-6xl text-slate-300" />
        <p class="text-xs font-bold text-slate-400">QRIS Placeholder</p>
      </div>
    </div>

    <ol class="space-y-2 text-left text-sm text-slate-600">
      <li class="flex gap-2">
        <span class="font-bold text-merchant-primary">1.</span>
        Buka aplikasi e-wallet / m-banking
      </li>
      <li class="flex gap-2">
        <span class="font-bold text-merchant-primary">2.</span>
        Scan QR atau transfer ke merchant
      </li>
      <li class="flex gap-2">
        <span class="font-bold text-merchant-primary">3.</span>
        Klik tombol di bawah setelah pembayaran berhasil
      </li>
    </ol>

    <p class="text-sm font-semibold text-slate-500">
      <i class="pi pi-clock" />
      Selesaikan dalam
      <span class="font-black text-merchant-primary">{{ minutesLabel }}</span>
    </p>

    <button
      type="button"
      class="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-base font-black text-white shadow-lg"
      @click="emit('confirm')"
    >
      <i class="pi pi-check-circle" />
      Saya sudah transfer
    </button>
  </div>
</template>
