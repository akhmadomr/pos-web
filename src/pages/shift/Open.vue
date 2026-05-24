<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import AppButton from '@/components/common/AppButton.vue'
import OpenShiftModal from '@/components/shift/OpenShiftModal.vue'
import { useAuthStore } from '@/stores/auth.store'

const router = useRouter()
const authStore = useAuthStore()

const todayLabel = computed(() => dayjs().format('dddd, DD MMMM YYYY'))
const outletLabel = computed(() => authStore.user?.outlet?.name ?? `Outlet #${authStore.user?.outlet_id}`)

const handleOpened = () => {
  router.push({ name: 'pos' })
}

const handleLogout = async () => {
  await authStore.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-merchant-accent via-white to-slate-100">
    <div class="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 lg:px-8 lg:py-10">
      <header class="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <div
            class="flex h-14 w-14 items-center justify-center rounded-2xl bg-merchant-primary text-2xl font-black text-white shadow-lg shadow-merchant-primary/30"
          >
            K
          </div>
          <div>
            <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Kopirex POS</p>
            <h1 class="text-2xl font-black text-slate-900">Buka Shift</h1>
          </div>
        </div>
        <AppButton variant="secondary" @click="handleLogout">
          <i class="pi pi-power-off" />
          Keluar
        </AppButton>
      </header>

      <div class="grid flex-1 gap-8 lg:grid-cols-2 lg:items-start">
        <section class="glass-card flex flex-col justify-center p-8 lg:p-10">
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-merchant-primary">Siap melayani</p>
          <h2 class="mt-3 text-3xl font-black text-slate-900">{{ authStore.cashierName }}</h2>
          <p class="mt-2 text-lg text-slate-600">{{ outletLabel }}</p>

          <div class="mt-8 space-y-4 border-t border-slate-100 pt-8">
            <div class="flex items-center gap-3 text-slate-600">
              <i class="pi pi-calendar text-merchant-primary" />
              <span class="font-semibold capitalize">{{ todayLabel }}</span>
            </div>
            <div class="flex items-center gap-3 text-slate-600">
              <i class="pi pi-info-circle text-merchant-primary" />
              <span class="text-sm">Masukkan saldo kas awal sebelum memulai transaksi.</span>
            </div>
          </div>
        </section>

        <section class="glass-card p-6 lg:p-8">
          <h3 class="mb-6 text-lg font-bold text-slate-900">Saldo Kas Awal</h3>
          <OpenShiftModal @opened="handleOpened" />
        </section>
      </div>
    </div>
  </div>
</template>
