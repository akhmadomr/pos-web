<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import AppButton from '@/components/common/AppButton.vue'
import CloseShiftModal from '@/components/shift/CloseShiftModal.vue'
import ShiftSummary from '@/components/shift/ShiftSummary.vue'
import ProfileModal from '@/components/profile/ProfileModal.vue'
import { useAuthStore } from '@/stores/auth.store'
import { usePrinter } from '@/composables/usePrinter'
import { useSettingsStore } from '@/stores/settings.store'
import logoUrl from '@/assets/logo kopirex-01.png'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const printer = usePrinter()

const now = ref(dayjs())
const showCloseModal = ref(false)
const ignoredShiftBannerId = ref(null)
const shiftSummaryRef = ref(null)
let clockTimer = null
let printerReconnectTimer = null
const isFullscreen = ref(false)
const isSidebarOpen = ref(false)
const showDropdown = ref(false)
const showProfileModal = ref(false)

const isOnline = ref(navigator.onLine)
const updateOnlineStatus = () => { isOnline.value = navigator.onLine }

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.warn('Error attempting to enable fullscreen:', err.message)
    })
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen()
    }
  }
}

const clockLabel = computed(() => now.value.format('HH:mm:ss'))
const dateLabel = computed(() => now.value.format('dddd, DD MMM YYYY'))

const isShiftEndingSoon = computed(() => {
  const shift = authStore.shift
  const schedule = shift?.schedule
  if (!schedule || !schedule.end_time) return false
  if (ignoredShiftBannerId.value === shift.id) return false

  const currentTime = now.value.format('HH:mm:ss')
  const startTime = schedule.start_time
  const endTime = schedule.end_time

  const endParts = endTime.split(':')
  let warnHour = parseInt(endParts[0], 10) - 1
  if (warnHour < 0) warnHour = 23
  const warnTime = `${warnHour.toString().padStart(2, '0')}:${endParts[1]}:${endParts[2]}`

  if (startTime > endTime) {
     // Overnight shift (e.g. 22:00 to 06:00)
     if (currentTime >= warnTime || currentTime < endTime) return true
     if (currentTime > endTime && currentTime < startTime) return true
  } else {
     // Normal shift
     if (currentTime >= warnTime) return true
  }
  return false
})

const navItems = [
  { label: 'Kasir', path: '/pos', icon: 'pi-shopping-cart' },
  { label: 'Order', path: '/pos/orders', icon: 'pi-receipt' },
  { label: 'Riwayat', path: '/pos/history', icon: 'pi-history' },
  { label: 'Histori Shift', path: '/pos/shifts/history', icon: 'pi-calendar-clock' },
]

const isActive = (path) => route.path === path

const handleLogout = async () => {
  await authStore.logout()
  router.push({ name: 'login' })
}

const onShiftClosed = () => {
  shiftSummaryRef.value?.refresh?.()
}

onMounted(() => {
  settingsStore.load()
  printer.autoConnectBluetooth()
  
  clockTimer = window.setInterval(() => {
    now.value = dayjs()
  }, 1000)

  // Polling dihapus karena spamming connect() di background menyebabkan Android Bluetooth stack crash (NetworkError).
  // Sebagai gantinya, koneksi otomatis dipanggil sekali saat load, dan dipicu manual lewat ikon print.

  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
  })

  window.addEventListener('online', updateOnlineStatus)
  window.addEventListener('offline', updateOnlineStatus)
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
  window.removeEventListener('online', updateOnlineStatus)
  window.removeEventListener('offline', updateOnlineStatus)
})
</script>

<template>
  <div class="flex min-h-screen bg-slate-100">
    <!-- Overlay for Sidebar -->
    <div 
      v-if="isSidebarOpen" 
      class="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm transition-opacity" 
      @click="isSidebarOpen = false"
    />

    <!-- Sidebar (Offcanvas) -->
    <aside 
      class="fixed bottom-0 left-0 top-0 z-[70] flex w-64 flex-col bg-white shadow-2xl transition-transform duration-300"
      :class="isSidebarOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="flex items-center justify-between border-b border-slate-100 p-4">
        <img :src="logoUrl" alt="Kopirex" class="h-8 w-auto" />
        <button @click="isSidebarOpen = false" class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <i class="pi pi-times text-xl" />
        </button>
      </div>

      <nav class="flex-1 space-y-1 overflow-y-auto p-4">
        <p class="mb-2 px-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Menu Utama</p>
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition"
          :class="isActive(item.path) ? 'bg-merchant-primary/10 text-merchant-primary' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'"
          @click="isSidebarOpen = false"
        >
          <i :class="['pi', item.icon]" />
          {{ item.label }}
        </router-link>
        
        <div class="my-4 border-t border-slate-100" />
        <p class="mb-2 px-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Akun & Sistem</p>

        <button @click="showProfileModal = true; isSidebarOpen = false" class="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700">
          <i class="pi pi-user-edit" />
          Profil Saya
        </button>

        <div class="my-4 border-t border-slate-100" />
        <p class="mb-2 px-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</p>

        <div class="space-y-1">
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition hover:bg-slate-50"
            :class="printer.printerOnline.value ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-700'"
            @click="printer.checkPrinterStatus()"
          >
            <i class="pi pi-print" />
            {{ printer.printerOnline.value ? 'Printer Online' : 'Browser Print' }}
          </button>

          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition hover:bg-slate-50"
            :class="printer.bluetoothDevice.value ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'"
            @click="printer.connectBluetooth()"
          >
            <i v-if="printer.isConnectingBluetooth.value" class="pi pi-spin pi-spinner text-blue-500" />
            <i v-else class="pi pi-bluetooth" />
            {{ printer.isConnectingBluetooth.value ? 'Menyambungkan...' : (printer.bluetoothDevice.value ? 'Bluetooth Terhubung' : 'Koneksikan Bluetooth') }}
          </button>
          
          <div class="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-emerald-600">
            <i class="pi pi-check-circle" />
            Shift Aktif
          </div>

          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
            @click="toggleFullscreen(); isSidebarOpen = false"
          >
            <i :class="['pi', isFullscreen ? 'pi-window-minimize' : 'pi-window-maximize']" />
            {{ isFullscreen ? 'Exit Fullscreen' : 'Fullscreen' }}
          </button>
          
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-rose-600 transition hover:bg-rose-50"
            @click="handleLogout"
          >
            <i class="pi pi-power-off" />
            Logout
          </button>
        </div>
      </nav>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <header class="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm">
        <div class="flex items-center justify-between gap-2 px-3 py-2 lg:px-6 lg:py-3">
          
          <!-- LEFT: Logo (Trigger Sidebar) -->
          <button 
            class="flex shrink-0 items-center justify-center rounded-xl p-1 transition hover:bg-slate-50 lg:p-2"
            @click="isSidebarOpen = true"
          >
            <img :src="logoUrl" alt="Kopirex" class="h-8 w-auto lg:h-10" />
          </button>

          <!-- CENTER: Shift Summary -->
          <div class="flex min-w-0 flex-1 justify-center overflow-x-auto overflow-y-hidden no-scrollbar">
            <ShiftSummary ref="shiftSummaryRef" />
          </div>

          <!-- RIGHT: Clock & Avatar Dropdown -->
          <div class="flex shrink-0 items-center gap-2 lg:gap-3">
            
            <!-- Status Icons -->
            <div class="flex items-center gap-1.5 lg:gap-2 mr-1">
              <div class="relative flex h-8 w-8 items-center justify-center rounded-full"
                   :class="isOnline ? 'text-emerald-500 bg-emerald-50' : 'text-slate-400 bg-slate-100'"
                   title="Status Internet">
                <i class="pi pi-wifi text-sm lg:text-base" />
                <div v-if="!isOnline" class="absolute h-0.5 w-5 rotate-45 rounded-full bg-slate-500" />
              </div>
              <div class="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full"
                   :class="(printer.printerOnline.value || printer.bluetoothDevice.value) ? 'text-emerald-500 bg-emerald-50 hover:bg-emerald-100' : 'text-slate-400 bg-slate-100 hover:bg-slate-200'"
                   title="Status Printer (Klik untuk sambungkan manual)"
                   @click="printer.connectBluetooth()">
                <i v-if="printer.isConnectingBluetooth.value" class="pi pi-spin pi-spinner text-sm lg:text-base text-blue-500" />
                <template v-else>
                  <i class="pi pi-print text-sm lg:text-base" />
                  <div v-if="!printer.printerOnline.value && !printer.bluetoothDevice.value" class="absolute h-0.5 w-5 rotate-45 rounded-full bg-slate-500" />
                </template>
              </div>
            </div>

            <div class="hidden text-right lg:block">
              <p class="font-mono text-xl font-black leading-none tabular-nums text-slate-900">{{ clockLabel }}</p>
              <p class="mt-1 text-xs capitalize text-slate-500">{{ dateLabel }}</p>
            </div>

            <div class="relative">
              <button 
                @click="showDropdown = !showDropdown" 
                class="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-slate-600 transition hover:bg-slate-300 lg:h-10 lg:w-10"
              >
                <i class="pi pi-user text-base lg:text-lg" />
              </button>

              <!-- Dropdown Menu -->
              <div v-if="showDropdown" class="absolute right-0 top-full mt-2 w-48 rounded-xl border border-slate-200 bg-white shadow-xl lg:w-56">
                 <div class="border-b border-slate-100 px-4 py-3">
                   <p class="truncate text-sm font-bold text-slate-900">{{ authStore.cashierName }}</p>
                   <p class="truncate text-[10px] uppercase tracking-wider text-slate-500">{{ authStore.outletName }}</p>
                 </div>
                 <div class="py-1">
                   <button @click="showDropdown = false; showProfileModal = true" class="flex w-full items-center px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                     <i class="pi pi-user-edit w-6 text-slate-400" /> Profil Saya
                   </button>
                   <button @click="showDropdown = false; showCloseModal = true" class="flex w-full items-center px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                     <i class="pi pi-sign-out w-6 text-slate-400" /> Tutup Shift
                   </button>
                   <div class="my-1 border-t border-slate-100" />
                   <button @click="showDropdown = false; handleLogout()" class="flex w-full items-center px-4 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50">
                     <i class="pi pi-power-off w-6" /> Logout
                   </button>
                 </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Desktop Horizontal Nav -->
        <nav class="hidden gap-1 overflow-x-auto border-t border-slate-100 px-6 lg:flex">
          <router-link
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            class="flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition"
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

      <!-- Sticky Shift Warning Banner -->
      <div v-if="authStore.hasActiveShift && isShiftEndingSoon" class="sticky top-[60px] lg:top-[105px] z-30 flex flex-col sm:flex-row items-center justify-between gap-2 bg-rose-500 px-4 py-2 text-white shadow-md">
        <div class="flex items-center gap-2 text-sm font-bold flex-1">
          <i class="pi pi-exclamation-triangle text-lg" />
          <span>Waktu {{ authStore.shift.schedule.name }} akan/telah berakhir ({{ authStore.shift.schedule.end_time.substring(0, 5) }}). Harap segera Tutup Shift.</span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button @click="showCloseModal = true" class="rounded-lg bg-white px-3 py-1.5 text-xs font-black text-rose-600 shadow-sm transition hover:bg-rose-50">
            Tutup Shift
          </button>
          <button @click="ignoredShiftBannerId = authStore.shift.id" class="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-rose-600 text-white transition hover:bg-rose-700" title="Abaikan untuk shift ini">
            <i class="pi pi-times" />
          </button>
        </div>
      </div>

      <main class="flex-1 p-2 sm:p-4 lg:p-6">
        <router-view />
      </main>
    </div>

    <CloseShiftModal :show="showCloseModal" @close="showCloseModal = false" @closed="onShiftClosed" />
    <ProfileModal :show="showProfileModal" @close="showProfileModal = false" />
  </div>
</template>
