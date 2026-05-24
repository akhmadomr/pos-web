<script setup>
import { computed, onMounted, ref } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import CartItem from '@/components/order/CartItem.vue'
import OrderSummary from '@/components/order/OrderSummary.vue'
import { fetchTables } from '@/api/tables'
import { useAuthStore } from '@/stores/auth.store'
import { useCartStore } from '@/stores/cart.store'

const emit = defineEmits(['checkout'])

const authStore = useAuthStore()
const cartStore = useCartStore()

const tables = ref([])
const loadingTables = ref(false)

const selectedTableLabel = computed(() => {
  const table = tables.value.find((t) => t.id === cartStore.tableId)
  if (!table) return 'Pilih meja'
  return table.name ? `${table.table_number} — ${table.name}` : table.table_number
})

const loadTables = async () => {
  loadingTables.value = true
  try {
    tables.value = await fetchTables(authStore.outletId)
  } catch {
    tables.value = []
  } finally {
    loadingTables.value = false
  }
}

onMounted(() => {
  if (cartStore.orderType === 'dine_in') {
    loadTables()
  }
})

const setOrderType = (type) => {
  cartStore.setOrderType(type)
  if (type === 'dine_in' && !tables.value.length) {
    loadTables()
  }
}

const handleCheckout = () => {
  if (!cartStore.items.length) return
  if (cartStore.orderType === 'dine_in' && !cartStore.tableId) {
    window.alert('Pilih meja untuk dine in.')
    return
  }
  emit('checkout')
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div class="shrink-0 border-b border-slate-100 p-4">
      <h2 class="text-lg font-black text-slate-900">Keranjang</h2>
      <p class="text-xs text-slate-500">{{ cartStore.itemCount }} item</p>

      <div class="mt-4 flex gap-2">
        <button
          type="button"
          class="flex-1 rounded-xl py-2.5 text-xs font-bold uppercase tracking-wide transition"
          :class="
            cartStore.orderType === 'dine_in'
              ? 'bg-merchant-primary text-white'
              : 'bg-slate-100 text-slate-600'
          "
          @click="setOrderType('dine_in')"
        >
          <i class="pi pi-home mr-1" />
          Dine In
        </button>
        <button
          type="button"
          class="flex-1 rounded-xl py-2.5 text-xs font-bold uppercase tracking-wide transition"
          :class="
            cartStore.orderType === 'take_away'
              ? 'bg-merchant-primary text-white'
              : 'bg-slate-100 text-slate-600'
          "
          @click="setOrderType('take_away')"
        >
          <i class="pi pi-shopping-bag mr-1" />
          Take Away
        </button>
      </div>

      <div v-if="cartStore.orderType === 'dine_in'" class="mt-3">
        <label class="mb-1 block text-[10px] font-bold uppercase text-slate-400">Meja</label>
        <select
          :value="cartStore.tableId ?? ''"
          class="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold focus:border-merchant-primary focus:outline-none"
          :disabled="loadingTables"
          @change="cartStore.setTable($event.target.value ? Number($event.target.value) : null)"
        >
          <option value="">{{ loadingTables ? 'Memuat meja...' : selectedTableLabel }}</option>
          <option v-for="table in tables" :key="table.id" :value="table.id">
            {{ table.table_number }}{{ table.name ? ` — ${table.name}` : '' }}
            ({{ table.capacity }} org)
          </option>
        </select>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-4">
      <div v-if="!cartStore.items.length" class="flex flex-col items-center justify-center py-12 text-center">
        <div class="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-merchant-accent">
          <i class="pi pi-shopping-cart text-4xl text-merchant-primary/50" />
        </div>
        <p class="font-bold text-slate-700">Keranjang kosong</p>
        <p class="mt-1 text-sm text-slate-400">Pilih produk untuk memulai pesanan</p>
      </div>

      <div v-else class="space-y-3">
        <CartItem
          v-for="(item, index) in cartStore.items"
          :key="item.id"
          :item="item"
          :index="index"
          @update-qty="cartStore.updateQty"
          @remove="cartStore.removeItem"
        />
      </div>
    </div>

    <div v-if="cartStore.items.length" class="shrink-0 border-t border-slate-100 bg-slate-50/80 p-4">
      <OrderSummary class="mb-4" />
      <AppButton class="w-full py-4 text-base" @click="handleCheckout">
        <i class="pi pi-credit-card" />
        Proses Pembayaran
      </AppButton>
    </div>
  </div>
</template>
