<script setup>
import { ref } from 'vue'
import { findCustomerByPhone } from '@/api/customers'
import { useCartStore } from '@/stores/cart.store'

const cartStore = useCartStore()

const phone = ref(cartStore.customer?.phone ?? '')
const loading = ref(false)
const message = ref('')

const searchCustomer = async () => {
  const trimmed = phone.value.trim()
  if (!trimmed) return

  loading.value = true
  message.value = ''
  try {
    const customer = await findCustomerByPhone(trimmed)
    if (!customer) {
      cartStore.setCustomer(null)
      message.value = 'Pelanggan tidak ditemukan.'
      return
    }
    cartStore.setCustomer(customer)
    message.value = `${customer.name} · ${customer.total_points} poin`
  } catch {
    message.value = 'Gagal mencari pelanggan.'
  } finally {
    loading.value = false
  }
}

const clearCustomer = () => {
  phone.value = ''
  cartStore.setCustomer(null)
  message.value = ''
}
</script>

<template>
  <div class="space-y-2">
    <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Pelanggan (HP)</label>
    <div class="flex gap-2">
      <input
        v-model="phone"
        type="tel"
        placeholder="08xxxxxxxxxx"
        class="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold focus:border-merchant-primary focus:outline-none"
        @keyup.enter="searchCustomer"
      />
      <button
        v-if="cartStore.customer"
        type="button"
        class="rounded-xl px-3 text-slate-400 hover:bg-slate-100"
        @click="clearCustomer"
      >
        <i class="pi pi-times" />
      </button>
      <button
        type="button"
        class="shrink-0 rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white"
        :disabled="loading"
        @click="searchCustomer"
      >
        <i v-if="loading" class="pi pi-spin pi-spinner" />
        <i v-else class="pi pi-search" />
      </button>
    </div>
    <p v-if="message" class="text-xs font-semibold text-slate-500">{{ message }}</p>
  </div>
</template>
