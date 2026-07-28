<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import 'dayjs/locale/id'

dayjs.locale('id')
import AppButton from '@/components/common/AppButton.vue'
import OpenShiftModal from '@/components/shift/OpenShiftModal.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useSettingsStore } from '@/stores/settings.store'
import logoUrl from '@/assets/logo kopirex-01.png'

const router = useRouter()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()

const todayLabel = computed(() => dayjs().format('dddd, DD MMMM YYYY'))
const outletLabel = computed(() => authStore.user?.outlet?.name ?? `Outlet #${authStore.user?.outlet_id}`)

onMounted(() => {
  settingsStore.load()
})

const handleOpened = () => {
  router.push({ name: 'pos' })
}

const handleLogout = async () => {
  await authStore.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="min-h-[100dvh] bg-gradient-to-br from-merchant-accent via-white to-slate-100">
    <div class="mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-4 py-4 lg:px-8 lg:py-10">
      <header class="mb-4 lg:mb-8 flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3 lg:gap-4">
          <img :src="logoUrl" alt="Kopirex" class="h-10 lg:h-14 w-auto drop-shadow-lg" />
          <div>
            <p class="text-[10px] lg:text-xs font-bold uppercase tracking-wider text-slate-400">Kasir Kopirex</p>
            <h1 class="text-lg lg:text-2xl font-black text-slate-900">Buka Shift</h1>
          </div>
        </div>
        <AppButton variant="secondary" @click="handleLogout" class="!px-3 lg:!px-4 !py-2 lg:!py-2.5 text-sm">
          <i class="pi pi-power-off" />
          <span class="hidden sm:inline">Keluar</span>
        </AppButton>
      </header>

      <div class="grid flex-1 gap-4 lg:gap-8 lg:grid-cols-2 lg:items-start">
        <section class="hidden lg:flex glass-card flex-col justify-center p-8 lg:p-10">
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

        <section class="glass-card p-5 lg:p-8 flex flex-col justify-center">
          <div class="lg:hidden mb-5 text-center border-b border-slate-100 pb-5">
            <h2 class="text-xl font-black text-slate-900">Halo, {{ authStore.cashierName }}</h2>
            <p class="text-[11px] text-slate-500 mt-1">{{ outletLabel }} &bull; {{ todayLabel }}</p>
          </div>
          <h3 class="hidden lg:block mb-6 text-lg font-bold text-slate-900">Saldo Kas Awal</h3>
          <OpenShiftModal @opened="handleOpened" />
        </section>
      </div>
    </div>
  </div>
</template>
