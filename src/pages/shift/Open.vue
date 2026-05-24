<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppAlert from '@/components/common/AppAlert.vue'
import AppButton from '@/components/common/AppButton.vue'
import { openShift } from '@/api/shifts'
import { useAuthStore } from '@/stores/auth.store'
import { formatRupiah } from '@/utils/currency'

const router = useRouter()
const authStore = useAuthStore()

const loading = ref(false)
const error = ref('')

const form = reactive({
  opening_cash: '',
})

const outletLabel = computed(() => authStore.user?.outlet?.name ?? `Outlet #${authStore.user?.outlet_id}`)

const handleOpenShift = async () => {
  error.value = ''

  const outletId = authStore.user?.outlet_id
  if (!outletId) {
    error.value = 'Akun tidak terhubung ke outlet. Hubungi administrator.'
    return
  }

  const openingCash = Number(String(form.opening_cash).replace(/[^\d]/g, ''))
  if (Number.isNaN(openingCash) || openingCash < 0) {
    error.value = 'Saldo kas awal tidak valid.'
    return
  }

  loading.value = true
  try {
    const shift = await openShift({
      outlet_id: outletId,
      opening_cash: openingCash,
    })
    authStore.setShift(shift)
    router.push({ name: 'pos' })
  } catch (err) {
    error.value = err.data?.message || err.response?.data?.message || 'Gagal membuka shift.'
  } finally {
    loading.value = false
  }
}

const handleLogout = async () => {
  await authStore.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-100 p-4">
    <div class="glass-card w-full max-w-lg p-8">
      <div class="mb-8 text-center">
        <div
          class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-merchant-primary text-2xl font-black text-white"
        >
          K
        </div>
        <h1 class="text-2xl font-black text-slate-900">Buka Shift</h1>
        <p class="mt-2 text-sm text-slate-500">
          Halo {{ authStore.cashierName }}, siap melayani di <strong>{{ outletLabel }}</strong>
        </p>
      </div>

      <AppAlert v-if="error" type="error" :message="error" class="mb-6" dismissible @dismiss="error = ''" />

      <form class="space-y-6" @submit.prevent="handleOpenShift">
        <div>
          <label class="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
            Saldo Kas Awal
          </label>
          <div class="relative">
            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">Rp</span>
            <input
              v-model="form.opening_cash"
              type="number"
              min="0"
              required
              placeholder="0"
              class="w-full rounded-2xl border border-slate-200 py-4 pl-12 pr-4 text-2xl font-black text-slate-900 focus:border-merchant-primary focus:outline-none focus:ring-2 focus:ring-merchant-primary/20"
            />
          </div>
          <p v-if="form.opening_cash" class="mt-2 text-sm text-slate-500">
            {{ formatRupiah(form.opening_cash) }}
          </p>
        </div>

        <AppButton type="submit" class="w-full py-4 text-base" :loading="loading">
          Buka Shift & Mulai Kasir
        </AppButton>

        <AppButton type="button" variant="secondary" class="w-full" @click="handleLogout">Keluar</AppButton>
      </form>
    </div>
  </div>
</template>
