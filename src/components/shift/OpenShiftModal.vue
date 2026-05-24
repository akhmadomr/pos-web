<script setup>
import { ref } from 'vue'
import AppAlert from '@/components/common/AppAlert.vue'
import AppNumpad from '@/components/common/AppNumpad.vue'
import { openShift } from '@/api/shifts'
import { useAuthStore } from '@/stores/auth.store'

const emit = defineEmits(['opened'])

const authStore = useAuthStore()

const openingCash = ref('')
const loading = ref(false)
const error = ref('')

const submitOpenShift = async () => {
  if (loading.value) return
  error.value = ''

  const outletId = authStore.user?.outlet_id
  if (!outletId) {
    error.value = 'Akun tidak terhubung ke outlet. Hubungi administrator.'
    return
  }

  const amount = Number(openingCash.value.replace(/\D/g, '') || 0)
  if (Number.isNaN(amount) || amount < 0) {
    error.value = 'Saldo kas awal tidak valid.'
    return
  }

  loading.value = true
  try {
    const shift = await openShift({
      outlet_id: outletId,
      opening_cash: amount,
    })
    authStore.setShift(shift)
    emit('opened', shift)
  } catch (err) {
    error.value = err.data?.message || err.response?.data?.message || 'Gagal membuka shift.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <label class="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
        Saldo Kas Awal
      </label>
      <AppNumpad
        v-model="openingCash"
        confirm-label="Mulai Shift"
        :show-confirm="true"
        @confirm="submitOpenShift"
      />
      <p v-if="loading" class="text-center text-sm font-semibold text-merchant-primary">
        <i class="pi pi-spin pi-spinner" />
        Membuka shift...
      </p>
    </div>

    <AppAlert v-if="error" type="error" :message="error" dismissible @dismiss="error = ''" />
  </div>
</template>
