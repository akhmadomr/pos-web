<script setup>
import { computed, onMounted } from 'vue'
import AppAlert from '@/components/common/AppAlert.vue'
import { useOrderStore } from '@/stores/order.store'
import { formatRupiah } from '@/utils/currency'
import dayjs from 'dayjs'

const orderStore = useOrderStore()

const loadOrders = () => {
  orderStore.fetchOrders()
}

onMounted(() => {
  loadOrders()
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

import { usePrinter } from '@/composables/usePrinter'
const printer = usePrinter()

const handlePrint = async (order) => {
  const receiptData = {
    order_number: order.order_number,
    order_type: order.order_type,
    table_number: order.table?.table_number || null,
    timestamp: dayjs(order.created_at).format('DD/MM/YYYY HH:mm'),
    subtotal: order.subtotal,
    discount_amount: order.discount_amount,
    tax_amount: order.tax_amount,
    service_charge: order.service_charge,
    total_amount: order.total_amount,
    payment_method: order.payment_method || 'Cash',
    cash_received: order.total_amount, // Asumsi uang pas jika tidak ada data dari backend
    change_amount: 0,
    items: (order.order_items || []).map((i) => ({
      name: i.product_name + (i.variant_label ? ` - ${i.variant_label}` : '') + (i.addons_label ? ` (+${i.addons_label})` : ''),
      qty: i.quantity,
      unit_price: Number(i.unit_price) + Number(i.addons_price),
      total: Number(i.total_price),
    })),
  }
  
  const success = await printer.printReceipt(receiptData)
  if (!success) {
    alert('Gagal mencetak struk. Pastikan printer terhubung.')
  }
}

import { useRouter } from 'vue-router'
const router = useRouter()
const editOrder = (order) => {
  // Bawa ke halaman index/kasir tapi memuat order ini?
  // Atau karena tidak ada EditOrder.vue, kita beri peringatan.
  if (order.status === 'completed') {
    alert('Transaksi yang sudah selesai tidak dapat diubah isinya. Anda hanya bisa membatalkannya melalui menu detail/aktif (jika diizinkan).')
    return
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-black text-slate-900">Riwayat Pesanan</h1>
        <p class="text-slate-500">Daftar pesanan yang sudah selesai atau dibatalkan pada shift ini.</p>
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

    <!-- Wait, orderStore.completedOrders is used here, but we should include cancelled as well. Let's create a computed property. -->
    <div v-else-if="!orderStore.orders.filter(o => ['completed', 'cancelled'].includes(o.status)).length" class="glass-card flex flex-col items-center p-12 text-center">
      <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <i class="pi pi-history text-2xl" />
      </div>
      <h3 class="text-lg font-bold text-slate-900">Belum Ada Riwayat Pesanan</h3>
      <p class="text-slate-500">Pesanan yang telah selesai akan muncul di sini.</p>
    </div>

    <div v-else class="grid gap-4 lg:grid-cols-2">
      <div
        v-for="order in orderStore.orders.filter(o => ['completed', 'cancelled'].includes(o.status))"
        :key="order.id"
        class="glass-card flex flex-col overflow-hidden"
      >
        <div class="flex items-start justify-between border-b border-slate-100 p-4">
          <div>
            <div class="flex items-center gap-2">
              <span class="font-bold text-slate-900">{{ order.order_number }}</span>
              <span
                class="rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
                :class="getStatusBadge(order.status).class"
              >
                {{ getStatusBadge(order.status).label }}
              </span>
            </div>
            <p class="text-xs text-slate-500">{{ dayjs(order.created_at).format('DD MMM YYYY, HH:mm') }}</p>
          </div>
          <div class="text-right">
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
        <div class="flex items-center gap-2 border-t border-slate-100 p-3 bg-white">
          <button 
            type="button" 
            @click="editOrder(order)"
            class="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
          >
            <i class="pi pi-pencil mr-1" /> Edit
          </button>
          <button 
            type="button" 
            @click="handlePrint(order)"
            class="flex-1 rounded-xl bg-merchant-primary/10 py-2 text-sm font-bold text-merchant-primary hover:bg-merchant-primary/20 transition"
          >
            <i class="pi pi-print mr-1" /> Print Ulang
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
