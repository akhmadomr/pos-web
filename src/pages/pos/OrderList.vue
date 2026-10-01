<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import AppAlert from '@/components/common/AppAlert.vue'
import { useOrderStore } from '@/stores/order.store'
import { formatRupiah } from '@/utils/currency'
import dayjs from 'dayjs'

const orderStore = useOrderStore()
let refreshTimer = null

const loadOrders = () => {
  orderStore.fetchOrders()
}

onMounted(() => {
  loadOrders()
  // Refresh setiap 30 detik
  refreshTimer = setInterval(loadOrders, 30000)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})

const getStatusBadge = (status) => {
  const map = {
    pending: 'bg-amber-100 text-amber-700',
    processing: 'bg-sky-100 text-sky-700',
    ready: 'bg-indigo-100 text-indigo-700',
    completed: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-rose-100 text-rose-700',
  }
  const labelMap = {
    pending: 'Menunggu',
    processing: 'Diproses',
    ready: 'Siap',
    completed: 'Selesai',
    cancelled: 'Batal',
  }
  return {
    class: map[status] || 'bg-slate-100 text-slate-700',
    label: labelMap[status] || status,
  }
}

const updateStatus = async (orderId, newStatus) => {
  try {
    await orderStore.updateOrderStatus(orderId, newStatus)
  } catch (err) {
    window.alert('Gagal update status order.')
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-black text-slate-900">Pesanan Aktif</h1>
        <p class="text-slate-500">Kelola pesanan yang sedang berlangsung.</p>
      </div>
      <button
        type="button"
        class="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-merchant-primary"
        @click="loadOrders"
        :disabled="orderStore.loading"
      >
        <i class="pi pi-refresh" :class="{ 'animate-spin': orderStore.loading }" />
      </button>
    </header>

    <AppAlert
      v-if="orderStore.error"
      type="error"
      :message="orderStore.error"
      dismissible
      @dismiss="orderStore.error = null"
    />

    <div v-if="orderStore.loading && !orderStore.orders.length" class="flex justify-center py-12">
      <i class="pi pi-spin pi-spinner text-3xl text-merchant-primary" />
    </div>

    <div v-else-if="!orderStore.activeOrders.length" class="glass-card flex flex-col items-center p-12 text-center">
      <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <i class="pi pi-receipt text-2xl" />
      </div>
      <h3 class="text-lg font-bold text-slate-900">Belum Ada Pesanan</h3>
      <p class="text-slate-500">Pesanan yang masuk akan muncul di sini.</p>
    </div>

    <div v-else class="grid gap-4 lg:grid-cols-2">
      <div
        v-for="order in orderStore.activeOrders"
        :key="order.id"
        class="glass-card flex flex-col overflow-hidden"
      >
        <div class="flex flex-col sm:flex-row sm:items-start justify-between border-b border-slate-100 p-4 gap-3 sm:gap-0">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-bold text-slate-900">{{ order.order_number }}</span>
              <span
                class="rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
                :class="getStatusBadge(order.status).class"
              >
                {{ getStatusBadge(order.status).label }}
              </span>
            </div>
            <p class="text-xs text-slate-500 mt-1">{{ dayjs(order.created_at).format('HH:mm') }}</p>
            <p class="text-sm font-semibold mt-1">Pelanggan: {{ order.customer_name || 'Kopirex' }}</p>
          </div>
          <div class="text-left sm:text-right">
            <p class="font-bold text-merchant-primary">{{ formatRupiah(order.total_amount) }}</p>
            <p class="text-xs font-semibold uppercase text-slate-400">
              {{ order.order_type === 'dine_in' ? `Dine In — Meja ${order.table?.table_number ?? '-'}` : 'Take Away' }}
            </p>
          </div>
        </div>
        <div class="flex-1 bg-slate-50/50 p-4">
          <ul class="space-y-2">
            <li v-for="item in order.order_items" :key="item.id" class="text-sm">
              <span class="font-bold text-slate-900">{{ item.quantity }}x</span>
              <span class="ml-2 text-slate-700">{{ item.product_name }}</span>
              <p v-if="item.variant_label" class="ml-6 text-xs text-slate-500">{{ item.variant_label }}</p>
              <p v-if="item.addons_label" class="ml-6 text-xs text-slate-500">+ {{ item.addons_label }}</p>
            </li>
          </ul>
        </div>
        <div class="flex gap-2 p-4">
          <button
            v-if="order.status === 'pending'"
            class="flex-1 rounded-xl bg-sky-50 py-2.5 text-sm font-bold text-sky-600 hover:bg-sky-100"
            @click="updateStatus(order.id, 'processing')"
          >
            Proses
          </button>
          <button
            v-if="order.status === 'processing'"
            class="flex-1 rounded-xl bg-indigo-50 py-2.5 text-sm font-bold text-indigo-600 hover:bg-indigo-100"
            @click="updateStatus(order.id, 'ready')"
          >
            Siap
          </button>
          <button
            v-if="order.status === 'ready'"
            class="flex-1 rounded-xl bg-emerald-50 py-2.5 text-sm font-bold text-emerald-600 hover:bg-emerald-100"
            @click="updateStatus(order.id, 'completed')"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
