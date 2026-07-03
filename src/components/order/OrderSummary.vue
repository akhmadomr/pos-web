<script setup>
import { useCartStore } from '@/stores/cart.store'
import { formatRupiah } from '@/utils/currency'
import { SERVICE_CHARGE_RATE, TAX_RATE } from '@/utils/order'
import VoucherInput from '@/components/order/VoucherInput.vue'
import CustomerSelect from '@/components/order/CustomerSelect.vue'

defineProps({
  showExtras: {
    type: Boolean,
    default: true,
  },
})

const cartStore = useCartStore()
</script>

<template>
  <div class="space-y-4">
    <template v-if="showExtras">
      <CustomerSelect />
      <VoucherInput />
      <div class="border-t border-slate-100" />
    </template>

    <div class="space-y-2 text-sm">
      <div class="flex justify-between text-slate-600">
        <span>Subtotal</span>
        <span class="font-semibold text-slate-900">{{ formatRupiah(cartStore.subtotal) }}</span>
      </div>

      <div v-if="cartStore.discountAmount > 0" class="flex justify-between text-emerald-700">
        <span>Diskon{{ cartStore.discountLabel ? ` (${cartStore.discountLabel})` : '' }}</span>
        <span class="font-semibold">−{{ formatRupiah(cartStore.discountAmount) }}</span>
      </div>

      <div v-if="SERVICE_CHARGE_RATE > 0" class="flex justify-between text-slate-600">
        <span>Service</span>
        <span class="font-semibold text-slate-900">{{ formatRupiah(cartStore.serviceCharge) }}</span>
      </div>

      <div class="flex items-end justify-between border-t border-slate-200 pt-3 text-base">
        <div>
          <span class="font-bold text-slate-900">Total</span>
          <p class="text-[10px] font-medium text-slate-400">Sudah termasuk PPN 11%</p>
        </div>
        <span class="font-black text-merchant-primary">{{ formatRupiah(cartStore.total) }}</span>
      </div>
    </div>
  </div>
</template>
