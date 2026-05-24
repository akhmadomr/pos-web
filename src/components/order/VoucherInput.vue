<script setup>
import { ref } from 'vue'
import { checkVoucher } from '@/api/vouchers'
import { useCartStore } from '@/stores/cart.store'
import { formatRupiah } from '@/utils/currency'

const cartStore = useCartStore()

const code = ref(cartStore.voucherCode ?? '')
const loading = ref(false)
const message = ref('')
const messageType = ref('info')

const applyVoucher = async () => {
  const trimmed = code.value.trim().toUpperCase()
  if (!trimmed) return

  loading.value = true
  message.value = ''
  try {
    const result = await checkVoucher(trimmed, cartStore.subtotal)
    cartStore.applyVoucher(trimmed, result)
    message.value = `Voucher "${result.voucher.name}" diterapkan (−${formatRupiah(result.discount_amount)})`
    messageType.value = 'success'
  } catch (err) {
    cartStore.clearVoucher()
    message.value = err.data?.message || err.response?.data?.message || 'Voucher tidak valid.'
    messageType.value = 'error'
  } finally {
    loading.value = false
  }
}

const removeVoucher = () => {
  code.value = ''
  cartStore.clearVoucher()
  message.value = ''
}
</script>

<template>
  <div class="space-y-2">
    <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Kode Voucher</label>
    <div class="flex gap-2">
      <input
        v-model="code"
        type="text"
        placeholder="KODEVOUCHER"
        class="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold uppercase focus:border-merchant-primary focus:outline-none"
        :disabled="loading"
        @keyup.enter="applyVoucher"
      />
      <button
        v-if="cartStore.voucherCode"
        type="button"
        class="rounded-xl px-3 text-slate-400 hover:bg-slate-100"
        @click="removeVoucher"
      >
        <i class="pi pi-times" />
      </button>
      <button
        type="button"
        class="shrink-0 rounded-xl bg-merchant-primary px-4 py-2 text-xs font-bold text-white"
        :disabled="loading || !code.trim()"
        @click="applyVoucher"
      >
        <i v-if="loading" class="pi pi-spin pi-spinner" />
        <span v-else>OK</span>
      </button>
    </div>
    <p
      v-if="message"
      class="text-xs font-semibold"
      :class="messageType === 'success' ? 'text-emerald-600' : 'text-rose-600'"
    >
      {{ message }}
    </p>
  </div>
</template>
