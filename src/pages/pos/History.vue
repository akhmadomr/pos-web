<script setup>
import { computed, onMounted, ref } from 'vue'
import AppAlert from '@/components/common/AppAlert.vue'
import { useOrderStore } from '@/stores/order.store'
import { formatRupiah } from '@/utils/currency'
import dayjs from 'dayjs'
import client from '@/api/client'

const orderStore = useOrderStore()

const appAlertMessage = ref('')
const appAlertTitle = ref('')
const appAlertType = ref('success') // 'success' or 'error'
const showAppAlert = ref(false)

const triggerAlert = (title, message, type = 'success') => {
  appAlertTitle.value = title
  appAlertMessage.value = message
  appAlertType.value = type
  showAppAlert.value = true
  setTimeout(() => {
    showAppAlert.value = false
  }, 3000)
}

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
const printingOrderId = ref(null)

const handlePrint = async (order) => {
  if (printingOrderId.value) return // Cegah klik ganda
  printingOrderId.value = order.id
  
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
      name: i.product_name + (i.variant_label ? ` - ${i.variant_label}` : ''),
      addons_label: i.addons_label,
      qty: i.quantity,
      unit_price: Number(i.unit_price),
      addons_price: Number(i.addons_price),
      total: Number(i.total_price),
    })),
  }
  
  const success = await printer.printReceipt(receiptData)
  if (!success) {
    alert('Gagal mencetak struk. Pastikan printer terhubung.')
  }
  printingOrderId.value = null
}

import { useRouter } from 'vue-router'
const router = useRouter()
const showEditModal = ref(false)
const editingOrder = ref(null)
const editReason = ref('')
const isSubmittingEdit = ref(false)

const openEditModal = (order) => {
  if (order.status === 'cancelled') {
    triggerAlert('Gagal', 'Pesanan ini sudah dibatalkan.', 'error')
    return
  }
  if (order.edit_status === 'pending') {
    triggerAlert('Gagal', 'Pesanan ini sudah dalam pengajuan edit.', 'error')
    return
  }
  
  editingOrder.value = order
  editReason.value = ''
  showEditModal.value = true
}

const closeEditModal = () => {
  showEditModal.value = false
  editingOrder.value = null
  editReason.value = ''
}

const showCancelModal = ref(false)
const cancelingOrder = ref(null)
const cancelReason = ref('')
const isSubmittingCancel = ref(false)

const openCancelModal = (order) => {
  if (order.status === 'cancelled') {
    triggerAlert('Gagal', 'Pesanan ini sudah dibatalkan.', 'error')
    return
  }
  if (order.edit_status === 'pending' || order.edit_status === 'pending_cancel') {
    triggerAlert('Gagal', 'Pesanan ini sudah dalam pengajuan.', 'error')
    return
  }
  cancelingOrder.value = order
  cancelReason.value = ''
  showCancelModal.value = true
}

const closeCancelModal = () => {
  showCancelModal.value = false
  cancelingOrder.value = null
  cancelReason.value = ''
}

const showDetailModal = ref(false)
const detailOrder = ref(null)

const openDetailModal = (order) => {
  detailOrder.value = order
  showDetailModal.value = true
}

const closeDetailModal = () => {
  showDetailModal.value = false
  detailOrder.value = null
}

import { useCartStore } from '@/stores/cart.store'

const cartStore = useCartStore()

const submitEditRequest = async () => {
  if (!editReason.value.trim()) {
    triggerAlert('Peringatan', 'Alasan edit harus diisi.', 'error')
    return
  }
  
  // Load order data to cart and transition to POS for editing
  cartStore.loadOrderToCart(editingOrder.value, editReason.value)
  closeEditModal()
  router.push('/pos')
}

const submitCancelRequest = async () => {
  if (!cancelReason.value.trim()) {
    triggerAlert('Peringatan', 'Alasan pembatalan harus diisi.', 'error')
    return
  }
  
  isSubmittingCancel.value = true
  try {
    await client.post(`/pos/orders/${cancelingOrder.value.id}/request-cancel`, {
      reason: cancelReason.value
    })
    
    triggerAlert('Pengajuan Terkirim', 'Pengajuan pembatalan berhasil dikirim. Silahkan hubungi admin.', 'success')
    closeCancelModal()
    loadOrders()
  } catch (err) {
    triggerAlert('Gagal', err.response?.data?.message || 'Gagal mengajukan pembatalan.', 'error')
  } finally {
    isSubmittingCancel.value = false
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
              <span v-if="order.edit_status === 'pending'" class="rounded-lg bg-orange-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-orange-700">
                Menunggu Persetujuan Edit
              </span>
              <span v-else-if="order.edit_status === 'pending_cancel'" class="rounded-lg bg-rose-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-700">
                Menunggu Persetujuan Batal
              </span>
            </div>
            <p class="text-xs text-slate-500 mt-1">{{ dayjs(order.created_at).format('DD MMM YYYY, HH:mm') }}</p>
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
              <p v-if="item.notes" class="ml-6 text-xs italic text-slate-500 font-medium">"{{ item.notes }}"</p>
            </li>
          </ul>
        </div>
        <div class="flex items-center gap-2 border-t border-slate-100 p-3 bg-white">
          <button 
            type="button" 
            @click="openDetailModal(order)"
            class="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
          >
            <i class="pi pi-eye mr-1" /> Detail
          </button>
          <button 
            type="button" 
            @click="openEditModal(order)"
            :disabled="['pending', 'pending_cancel'].includes(order.edit_status) || order.status === 'cancelled'"
            class="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i class="pi pi-pencil mr-1" /> Edit
          </button>
          <button 
            type="button" 
            @click="openCancelModal(order)"
            :disabled="['pending', 'pending_cancel'].includes(order.edit_status) || order.status === 'cancelled'"
            class="flex-1 rounded-xl border border-rose-200 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i class="pi pi-trash mr-1" /> Batal
          </button>
          <button 
            type="button" 
            @click="handlePrint(order)"
            :disabled="printingOrderId === order.id"
            class="flex-1 flex items-center justify-center rounded-xl bg-merchant-primary/10 py-2 text-sm font-bold text-merchant-primary hover:bg-merchant-primary/20 transition disabled:opacity-50"
          >
            <i class="pi mr-1" :class="printingOrderId === order.id ? 'pi-spinner animate-spin' : 'pi-print'" /> 
            {{ printingOrderId === order.id ? 'Mencetak...' : 'Print Ulang' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Pengajuan Edit -->
    <div v-if="showEditModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" @click="closeEditModal" />
      <div class="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 class="mb-2 text-xl font-black text-slate-900">Pengajuan Edit Pesanan</h3>
        <p class="mb-4 text-sm text-slate-500">
          Pesanan <strong>{{ editingOrder?.order_number }}</strong>. Masukkan alasan pengeditan. Setelah ini Anda akan diarahkan ke layar kasir untuk mengubah pesanan dan meninjau total baru.
        </p>
        <textarea
          v-model="editReason"
          rows="3"
          placeholder="Misal: Salah input item, atau pelanggan minta ganti ukuran"
          class="mb-4 w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-merchant-primary focus:outline-none focus:ring-1 focus:ring-merchant-primary"
        ></textarea>
        <div class="flex gap-2">
          <button @click="closeEditModal" class="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-600 hover:bg-slate-200">
            Batal
          </button>
          <button @click="submitEditRequest" :disabled="isSubmittingEdit || !editReason.trim()" class="flex-1 rounded-xl bg-merchant-primary py-3 text-sm font-bold text-white hover:bg-merchant-primary/90 disabled:opacity-50">
            {{ isSubmittingEdit ? 'Mengirim...' : 'Kirim Pengajuan' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Pengajuan Batal -->
    <div v-if="showCancelModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" @click="closeCancelModal" />
      <div class="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 class="mb-2 text-xl font-black text-rose-600">Pengajuan Batal Pesanan</h3>
        <p class="mb-4 text-sm text-slate-500">
          Pesanan <strong>{{ cancelingOrder?.order_number }}</strong>. Masukkan alasan pembatalan. Permintaan ini harus disetujui oleh admin sebelum transaksi dihapus dan stok dikembalikan.
        </p>
        <textarea
          v-model="cancelReason"
          rows="3"
          class="w-full rounded-xl border-slate-200 p-3 text-sm focus:border-rose-500 focus:ring-rose-500"
          placeholder="Contoh: Pelanggan tidak jadi beli, pesanan ganda, dll"
        />
        <div class="mt-6 flex justify-end gap-3">
          <button
            type="button"
            class="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200"
            @click="closeCancelModal"
          >
            Tutup
          </button>
          <button
            type="button"
            class="flex items-center justify-center rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50"
            @click="submitCancelRequest"
            :disabled="!cancelReason.trim() || isSubmittingCancel"
          >
            <i v-if="isSubmittingCancel" class="pi pi-spin pi-spinner mr-2" />
            Ajukan Pembatalan
          </button>
        </div>
      </div>
    </div>
    
    <!-- Modal Detail Pesanan -->
    <div v-if="showDetailModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" @click="closeDetailModal" />
      <div class="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl flex flex-col">
        <div class="sticky top-0 bg-white p-6 border-b border-slate-100 flex justify-between items-center z-10">
          <h3 class="text-xl font-black text-slate-900">Detail Pesanan</h3>
          <button @click="closeDetailModal" class="text-slate-400 hover:text-slate-600">
            <i class="pi pi-times text-xl" />
          </button>
        </div>
        <div class="p-6 space-y-6 flex-1 overflow-y-auto">
          <!-- Info Pesanan -->
          <div class="space-y-3 bg-slate-50 p-4 rounded-xl">
            <div class="flex justify-between">
              <span class="text-sm text-slate-500">No. Order</span>
              <span class="text-sm font-bold">{{ detailOrder?.order_number }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-slate-500">Pelanggan</span>
              <span class="text-sm font-bold">{{ detailOrder?.customer_name || 'Kopirex' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-slate-500">Waktu</span>
              <span class="text-sm font-bold">{{ dayjs(detailOrder?.created_at).format('DD MMM YYYY, HH:mm') }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-slate-500">Tipe Order</span>
              <span class="text-sm font-bold">{{ detailOrder?.order_type === 'dine_in' ? 'Dine In' : 'Take Away' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-slate-500">Metode Pembayaran</span>
              <span class="text-sm font-bold capitalize">{{ detailOrder?.payment_method || '-' }}</span>
            </div>
          </div>
          
          <!-- Info Produk -->
          <div>
            <h4 class="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">Daftar Produk</h4>
            <ul class="space-y-3">
              <li v-for="item in detailOrder?.order_items" :key="item.id" class="text-sm">
                <div class="flex justify-between">
                  <div>
                    <span class="font-bold text-slate-900">{{ item.quantity }}x</span>
                    <span class="ml-2 font-semibold text-slate-700">{{ item.product_name }}</span>
                    <p v-if="item.variant_label" class="ml-6 text-xs text-slate-500">{{ item.variant_label }}</p>
                  </div>
                  <div class="font-bold text-slate-900 text-right">
                    {{ formatRupiah(Number(item.unit_price) * Number(item.quantity)) }}
                  </div>
                </div>
                <div v-if="item.addons_label && Number(item.addons_price) > 0" class="flex justify-between mt-1">
                  <div>
                    <p class="ml-6 text-xs text-slate-500">+ {{ item.addons_label }}</p>
                  </div>
                  <div class="font-bold text-slate-500 text-right text-xs">
                    {{ formatRupiah(Number(item.addons_price) * Number(item.quantity)) }}
                  </div>
                </div>
              </li>
            </ul>
          </div>
          
          <hr class="border-slate-100" />
          
          <!-- Subtotal & Grand Total -->
          <div class="space-y-2">
            <div class="flex justify-between text-sm">
              <span class="text-slate-500">Subtotal</span>
              <span class="font-bold">{{ formatRupiah(detailOrder?.subtotal) }}</span>
            </div>
            <div v-if="detailOrder?.discount_amount > 0" class="flex justify-between text-sm text-emerald-600">
              <span>Diskon</span>
              <span class="font-bold">-{{ formatRupiah(detailOrder?.discount_amount) }}</span>
            </div>
            <div v-if="detailOrder?.tax_amount > 0" class="flex justify-between text-sm">
              <span class="text-slate-500">PPN</span>
              <span class="font-bold">{{ formatRupiah(detailOrder?.tax_amount) }}</span>
            </div>
            <div class="flex justify-between text-base mt-2 pt-2 border-t border-slate-200">
              <span class="font-black text-slate-900">Total</span>
              <span class="font-black text-merchant-primary">{{ formatRupiah(detailOrder?.total_amount) }}</span>
            </div>
          </div>
        </div>
        <div class="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex gap-2">
          <button @click="closeDetailModal" class="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-100">
            Tutup
          </button>
          <button @click="handlePrint(detailOrder)" class="flex-1 rounded-xl bg-merchant-primary py-3 text-sm font-bold text-white hover:bg-merchant-primary/90">
            <i class="pi pi-print mr-2" /> Print Struk
          </button>
        </div>
      </div>
    </div>

    <!-- Custom Alert Popup -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300"
        enter-from-class="opacity-0 translate-y-4"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-200"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showAppAlert"
          class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 rounded-2xl px-5 py-4 shadow-2xl backdrop-blur-md"
          :class="appAlertType === 'success' ? 'bg-emerald-600/95 text-white' : 'bg-rose-600/95 text-white'"
        >
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
            <i class="pi text-xl" :class="appAlertType === 'success' ? 'pi-check' : 'pi-times'" />
          </div>
          <div>
            <h4 class="font-black">{{ appAlertTitle }}</h4>
            <p class="text-sm font-medium text-white/90">{{ appAlertMessage }}</p>
          </div>
          <button @click="showAppAlert = false" class="ml-4 p-2 text-white/70 hover:text-white transition">
            <i class="pi pi-times" />
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
