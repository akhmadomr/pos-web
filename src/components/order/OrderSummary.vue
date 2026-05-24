<script setup>
import { useCartStore } from '@/stores/cart.store'
import { formatRupiah } from '@/utils/currency'
import { SERVICE_CHARGE_RATE, TAX_RATE } from '@/utils/order'

const cartStore = useCartStore()
</script>

<template>
  <div class="space-y-2 text-sm">
    <div class="flex justify-between text-slate-600">
      <span>Subtotal</span>
      <span class="font-semibold text-slate-900">{{ formatRupiah(cartStore.subtotal) }}</span>
    </div>

    <div v-if="cartStore.discountAmount > 0" class="flex justify-between text-emerald-700">
      <span>Diskon</span>
      <span class="font-semibold">−{{ formatRupiah(cartStore.discountAmount) }}</span>
    </div>

    <div class="flex justify-between text-slate-600">
      <span>Pajak ({{ (TAX_RATE * 100).toFixed(0) }}%)</span>
      <span class="font-semibold text-slate-900">{{ formatRupiah(cartStore.taxAmount) }}</span>
    </div>

    <div v-if="SERVICE_CHARGE_RATE > 0" class="flex justify-between text-slate-600">
      <span>Service</span>
      <span class="font-semibold text-slate-900">{{ formatRupiah(cartStore.serviceCharge) }}</span>
    </div>

    <div class="flex justify-between border-t border-slate-200 pt-3 text-base">
      <span class="font-bold text-slate-900">Total</span>
      <span class="font-black text-merchant-primary">{{ formatRupiah(cartStore.total) }}</span>
    </div>
  </div>
</template>
