<script setup>
import { ref, computed } from 'vue'
import AppAlert from '@/components/common/AppAlert.vue'
import AppNumpad from '@/components/common/AppNumpad.vue'
import { openShift } from '@/api/shifts'
import { useAuthStore } from '@/stores/auth.store'
import { useSettingsStore } from '@/stores/settings.store'

const emit = defineEmits(['opened'])

const authStore = useAuthStore()
const settingsStore = useSettingsStore()

const isContinueCash = computed(() => settingsStore.shift?.continue_cash === '1')

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

  let amount = 0
  
  if (!isContinueCash.value) {
    amount = Number(openingCash.value.replace(/\D/g, '') || 0)
    if (Number.isNaN(amount) || amount < 0) {
      error.value = 'Saldo kas awal tidak valid.'
      return
    }
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
    <div v-if="isContinueCash" class="rounded-2xl border border-merchant-primary/20 bg-merchant-accent p-6 text-center">
      <i class="pi pi-wallet text-4xl text-merchant-primary mb-4" />
      <h4 class="text-lg font-bold text-slate-900">Uang Kas Dilanjutkan</h4>
      <p class="text-sm text-slate-600 mt-2 mb-6">Saldo kas awal akan otomatis diambil dari sisa kas fisik shift terakhir yang ditutup.</p>
      
      <button 
        type="button" 
        class="w-full rounded-xl bg-merchant-primary px-4 py-3 text-sm font-bold text-white shadow-lg shadow-merchant-primary/30 disabled:opacity-50"
        :disabled="loading"
        @click="submitOpenShift"
      >
        <i v-if="loading" class="pi pi-spin pi-spinner mr-2" />
        Mulai Shift Sekarang
      </button>
    </div>

    <div v-else>
      <label class="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
        Saldo Kas Awal
      </label>
      <AppNumpad
        v-model="openingCash"
        confirm-label="Mulai Shift"
        :show-confirm="true"
        @confirm="submitOpenShift"
      />
      <p v-if="loading" class="text-center text-sm font-semibold text-merchant-primary mt-4">
        <i class="pi pi-spin pi-spinner" />
        Membuka shift...
      </p>
    </div>

    <AppAlert v-if="error" type="error" :message="error" dismissible @dismiss="error = ''" />
  </div>
</template>
