<script setup>
import { onMounted, ref } from 'vue'
import AppAlert from '@/components/common/AppAlert.vue'
import { fetchOrders } from '@/api/orders'
import { formatRupiah } from '@/utils/currency'
import dayjs from 'dayjs'

const orders = ref([])
const loading = ref(false)
const error = ref(null)

const loadHistory = async () => {
  loading.value = true
  error.value = null
  try {
    const result = await fetchOrders({ status: 'completed' })
    orders.value = Array.isArray(result) ? result : result.data ?? []
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Gagal memuat riwayat transaksi.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadHistory()
})
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-black text-slate-900">Riwayat Transaksi</h1>
        <p class="text-slate-500">Daftar transaksi yang sudah selesai.</p>
      </div>
      <button
        type="button"
        class="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-merchant-primary"
        @click="loadHistory"
        :disabled="loading"
      >
        <i class="pi pi-refresh" :class="{ 'animate-spin': loading }" />
      </button>
    </header>

    <AppAlert
      v-if="error"
      type="error"
      :message="error"
      dismissible
      @dismiss="error = null"
    />

    <div v-if="loading && !orders.length" class="flex justify-center py-12">
      <i class="pi pi-spin pi-spinner text-3xl text-merchant-primary" />
    </div>

    <div v-else-if="!orders.length" class="glass-card flex flex-col items-center p-12 text-center">
      <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <i class="pi pi-history text-2xl" />
      </div>
      <h3 class="text-lg font-bold text-slate-900">Belum Ada Riwayat</h3>
      <p class="text-slate-500">Transaksi yang sudah selesai akan muncul di sini.</p>
    </div>

    <div v-else class="glass-card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th class="px-4 py-3">No. Order</th>
              <th class="px-4 py-3">Waktu</th>
              <th class="px-4 py-3">Tipe</th>
              <th class="px-4 py-3 text-right">Total</th>
              <th class="px-4 py-3">Pembayaran</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="order in orders" :key="order.id" class="transition hover:bg-slate-50">
              <td class="px-4 py-3 font-bold text-slate-900">{{ order.order_number }}</td>
              <td class="px-4 py-3 text-slate-600">{{ dayjs(order.completed_at).format('DD MMM YYYY HH:mm') }}</td>
              <td class="px-4 py-3 text-slate-600">
                <span class="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider">
                  {{ order.order_type === 'dine_in' ? 'Dine In' : 'Take Away' }}
                </span>
              </td>
              <td class="px-4 py-3 text-right font-bold text-merchant-primary">{{ formatRupiah(order.total_amount) }}</td>
              <td class="px-4 py-3">
                <span class="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <i :class="['pi', order.payment_method === 'cash' ? 'pi-money-bill' : order.payment_method === 'qris' ? 'pi-qrcode' : 'pi-credit-card']" />
                  <span class="capitalize">{{ order.payment_method }}</span>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
