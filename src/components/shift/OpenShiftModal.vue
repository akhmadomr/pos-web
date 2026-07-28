<script setup>
import { ref, computed } from 'vue'
import AppAlert from '@/components/common/AppAlert.vue'
import AppNumpad from '@/components/common/AppNumpad.vue'
import { openShift } from '@/api/shifts'
import { useAuthStore } from '@/stores/auth.store'
import { useSettingsStore } from '@/stores/settings.store'
import { db } from '@/utils/db'
import { enqueue, SYNC_TYPE } from '@/services/SyncService'

const emit = defineEmits(['opened'])

const authStore = useAuthStore()
const settingsStore = useSettingsStore()

const isContinueCash = computed(() => settingsStore.shift?.continue_cash === '1')

const openingCash = ref('')
const loading = ref(false)
const error = ref('')
const isOfflineMode = ref(false)

const submitOpenShift = async () => {
  if (loading.value) return
  error.value = ''
  isOfflineMode.value = false

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
    // --- ONLINE PATH ---
    const shift = await openShift({
      outlet_id: outletId,
      opening_cash: amount,
    })
    authStore.setShift(shift)
    emit('opened', shift)
  } catch (err) {
    const isNetworkError = !navigator.onLine ||
      err.message === 'Network Error' ||
      err.name === 'TypeError' ||
      err.code === 'ECONNABORTED' ||
      (err.response && err.response.status >= 500)

    if (isNetworkError) {
      // --- OFFLINE PATH ---
      try {
        const localId = 'offline_shift_' + crypto.randomUUID()
        const now = new Date().toISOString()

        const localShift = {
          local_id: localId,
          server_id: null,
          outlet_id: outletId,
          cashier_id: authStore.user?.id,
          cashier_name: authStore.user?.name,
          opening_cash: amount,
          closing_cash: null,
          status: 'open',
          opened_at: now,
          closed_at: null,
          sync_status: 'pending',
        }

        // Simpan ke IndexedDB
        await db.shifts.put(localShift)

        // Masukkan ke antrian sinkronisasi
        await enqueue(SYNC_TYPE.OPEN_SHIFT, {
          outlet_id: outletId,
          opening_cash: amount,
        }, localId)

        // Buat objek shift kompatibel dengan authStore
        const offlineShift = {
          id: localId,
          local_id: localId,
          outlet_id: outletId,
          outlet: authStore.user?.outlet,
          status: 'open',
          opening_cash: amount,
          opened_at: now,
          is_offline: true,
        }

        authStore.setShift(offlineShift)
        isOfflineMode.value = true
        emit('opened', offlineShift)
      } catch (offlineErr) {
        console.error('[OpenShift Offline]', offlineErr)
        error.value = 'Gagal membuka shift secara offline. Coba lagi.'
      }
    } else {
      error.value = err.data?.message || err.response?.data?.message || 'Gagal membuka shift.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Banner offline -->
    <div v-if="isOfflineMode" class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center text-sm font-semibold text-amber-800">
      <i class="pi pi-wifi-off mr-2" />
      Shift dibuka dalam <strong>mode offline</strong>. Data akan tersinkron ke server saat koneksi pulih.
    </div>

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
