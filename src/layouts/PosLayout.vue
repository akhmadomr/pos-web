<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { useAuthStore } from '@/stores/auth.store'
import { closeShift } from '@/api/shifts'
import AppButton from '@/components/common/AppButton.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const now = ref(dayjs())
let clockTimer = null
const closingShift = ref(false)

const clockLabel = computed(() => now.value.format('HH:mm:ss'))
const dateLabel = computed(() => now.value.format('dddd, DD MMM YYYY'))

const navItems = [
  { label: 'Kasir', path: '/pos', icon: 'pi-shopping-cart' },
  { label: 'Order', path: '/pos/orders', icon: 'pi-receipt' },
  { label: 'Riwayat', path: '/pos/history', icon: 'pi-history' },
]

const isActive = (path) => route.path === path

const handleCloseShift = async () => {
  const input = window.prompt('Masukkan jumlah kas fisik saat tutup shift:', '0')
  if (input === null) return

  const closingCash = Number(input.replace(/[^\d]/g, ''))
  if (Number.isNaN(closingCash)) return

  closingShift.value = true
  try {
    await closeShift({ closing_cash: closingCash })
    authStore.setShift(null)
    router.push({ name: 'shift-open' })
  } catch (err) {
    window.alert(err.response?.data?.message || 'Gagal menutup shift.')
  } finally {
    closingShift.value = false
  }
}

const handleLogout = async () => {
  await authStore.logout()
  router.push({ name: 'login' })
}

onMounted(() => {
  clockTimer = window.setInterval(() => {
    now.value = dayjs()
  }, 1000)
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
})
</script>

<template>
  <div class="flex min-h-screen flex-col bg-slate-100">
    <header class="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-4 px-4 py-3 lg:px-6">
        <div class="flex items-center gap-4">
          <div
            class="flex h-11 w-11 items-center justify-center rounded-2xl bg-merchant-primary text-lg font-black text-white"
          >
            K
          </div>
          <div>
            <p class="text-sm font-bold text-slate-900">{{ authStore.cashierName }}</p>
            <p class="text-xs text-slate-500">{{ authStore.outletName }}</p>
          </div>
        </div>

        <div class="text-right">
          <p class="font-mono text-xl font-black tabular-nums text-slate-900">{{ clockLabel }}</p>
          <p class="text-xs capitalize text-slate-500">{{ dateLabel }}</p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <span
            class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
          >
            <span class="h-2 w-2 rounded-full bg-emerald-500" />
            Shift Aktif
          </span>

          <AppButton variant="secondary" :loading="closingShift" @click="handleCloseShift">
            <i class="pi pi-sign-out" />
            Tutup Shift
          </AppButton>

          <button
            type="button"
            class="rounded-xl p-2.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            title="Keluar"
            @click="handleLogout"
          >
            <i class="pi pi-power-off" />
          </button>
        </div>
      </div>

      <nav class="flex gap-1 border-t border-slate-100 px-4 lg:px-6">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition"
          :class="
            isActive(item.path)
              ? 'border-merchant-primary text-merchant-primary'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          "
        >
          <i :class="['pi', item.icon]" />
          {{ item.label }}
        </router-link>
      </nav>
    </header>

    <main class="flex-1 p-4 lg:p-6">
      <router-view />
    </main>
  </div>
</template>
