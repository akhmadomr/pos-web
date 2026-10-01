<script setup>
import AppButton from '@/components/common/AppButton.vue'
import CartItem from '@/components/order/CartItem.vue'
import OrderSummary from '@/components/order/OrderSummary.vue'
import { useCartStore } from '@/stores/cart.store'
import { formatRupiah } from '@/utils/currency'

const props = defineProps({
  isBookingMode: {
    type: Boolean,
    default: false,
  },
})

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
    <div class="hidden shrink-0 border-b border-slate-100 p-4 lg:block">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-black text-slate-900">Keranjang</h2>
        <span
          v-if="isBookingMode"
          class="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-800"
        >
          Pesanan Booking
        </span>
      </div>
      <p class="text-xs text-slate-500">{{ cartStore.itemCount }} item</p>

      <!-- Order type: hanya Take Away yang aktif untuk saat ini -->
      <div class="mt-4">
        <div
          v-if="isBookingMode"
          class="flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-200/80 px-4 py-2.5"
        >
          <i class="pi pi-calendar text-blue-700 font-bold" />
          <span class="text-xs font-bold uppercase tracking-wide text-blue-800">Menu Khusus Booking</span>
        </div>
        <div
          v-else
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
        <p class="mt-1 text-sm text-slate-400">
          {{ isBookingMode ? 'Pilih menu & varian untuk pesanan booking' : 'Pilih produk untuk memulai pesanan' }}
        </p>
      </div>

      <div v-else class="space-y-3 flex flex-col">
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

    <div v-if="cartStore.items.length" class="shrink-0 border-t border-slate-100 bg-slate-50 p-4 rounded-b-2xl">
      <div class="mb-4">
        <OrderSummary />
      </div>
      <AppButton
        class="w-full py-4 text-base shadow-lg"
        :class="isBookingMode ? 'bg-blue-700 hover:bg-blue-800 text-white shadow-blue-700/20' : 'shadow-merchant-primary/20'"
        @click="handleCheckout"
      >
        <div class="flex items-center justify-between w-full px-2">
          <span class="flex items-center gap-2 font-black">
            <i :class="isBookingMode ? 'pi pi-check' : 'pi pi-credit-card'" />
            {{ isBookingMode ? 'Simpan ke Booking' : 'Proses' }}
          </span>
          <span class="font-black">{{ formatRupiah(cartStore.total) }}</span>
        </div>
      </AppButton>
    </div>
  </div>
</template>
