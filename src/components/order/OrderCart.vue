<script setup>
import AppButton from '@/components/common/AppButton.vue'
import CartItem from '@/components/order/CartItem.vue'
import OrderSummary from '@/components/order/OrderSummary.vue'
import { useCartStore } from '@/stores/cart.store'

const emit = defineEmits(['checkout'])

const cartStore = useCartStore()

// Pastikan selalu take_away (dine-in belum dalam scope)
if (cartStore.orderType !== 'take_away') {
  cartStore.setOrderType('take_away')
}

const handleCheckout = () => {
  if (!cartStore.items.length) return
  emit('checkout')
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div class="shrink-0 border-b border-slate-100 p-4">
      <h2 class="text-lg font-black text-slate-900">Keranjang</h2>
      <p class="text-xs text-slate-500">{{ cartStore.itemCount }} item</p>

      <!-- Order type: hanya Take Away yang aktif untuk saat ini -->
      <div class="mt-4">
        <div
          class="flex items-center gap-2 rounded-xl bg-merchant-primary/10 px-4 py-2.5"
        >
          <i class="pi pi-shopping-bag text-merchant-primary" />
          <span class="text-xs font-bold uppercase tracking-wide text-merchant-primary">Take Away</span>
        </div>
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
