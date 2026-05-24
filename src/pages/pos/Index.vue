<script setup>
import { useAuthStore } from '@/stores/auth.store'
import { formatRupiah } from '@/utils/currency'
import { formatDateTime } from '@/utils/date'

const authStore = useAuthStore()
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-black text-slate-900">Kasir</h1>
      <p class="mt-1 text-sm text-slate-500">Halaman transaksi utama — Task 4.3 akan mengisi grid produk & keranjang.</p>
    </div>

    <div class="grid gap-4 sm:grid-cols-3">
      <div class="glass-card p-5">
        <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Kas Awal</p>
        <p class="mt-2 text-xl font-black text-slate-900">
          {{ formatRupiah(authStore.shift?.opening_cash) }}
        </p>
      </div>
      <div class="glass-card p-5">
        <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Shift ID</p>
        <p class="mt-2 text-xl font-black text-slate-900">#{{ authStore.shift?.id }}</p>
      </div>
      <div class="glass-card p-5">
        <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Dibuka</p>
        <p class="mt-2 text-sm font-bold text-slate-900">{{ formatDateTime(authStore.shift?.opened_at) }}</p>
      </div>
    </div>
  </div>
</template>
