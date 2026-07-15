<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { fetchShiftHistory } from '@/api/shifts'
import { formatRupiah } from '@/utils/currency'
import dayjs from 'dayjs'
import 'dayjs/locale/id'

dayjs.locale('id')

const router = useRouter()
const shifts = ref([])
const loading = ref(false)
const meta = ref({ current_page: 1, last_page: 1 })

const loadHistory = async (page = 1) => {
  loading.value = true
  try {
    const data = await fetchShiftHistory({ page })
    shifts.value = data.data
    meta.value = data.meta
  } catch (error) {
    console.error('Failed to fetch shifts:', error)
  } finally {
    loading.value = false
  }
}

const goToDetail = (id) => {
  router.push({ name: 'pos-shift-history-detail', params: { id } })
}

const formatDuration = (start, end) => {
  if (!start || !end) return '-'
  const diffHours = dayjs(end).diff(dayjs(start), 'hour')
  const diffMinutes = dayjs(end).diff(dayjs(start), 'minute') % 60
  return `${diffHours}j ${diffMinutes}m`
}

onMounted(() => {
  loadHistory()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 class="text-xl font-black text-slate-900">Riwayat Shift</h1>
        <p class="text-sm text-slate-500">Daftar shift yang telah selesai</p>
      </div>
    </div>

    <div class="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <div v-if="loading" class="flex justify-center py-12">
        <i class="pi pi-spin pi-spinner text-3xl text-merchant-primary" />
      </div>

      <div v-else-if="shifts.length === 0" class="text-center py-12 text-slate-500">
        Belum ada riwayat shift.
      </div>

      <div v-else class="space-y-4">
        <div 
          v-for="shift in shifts" 
          :key="shift.id"
          class="flex cursor-pointer flex-col gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 transition-colors hover:border-merchant-primary/30 hover:bg-merchant-primary/5 sm:flex-row sm:items-center sm:justify-between"
          @click="goToDetail(shift.id)"
        >
          <div class="flex items-center gap-4">
            <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm text-merchant-primary">
              <i class="pi pi-calendar text-xl" />
            </div>
            <div>
              <p class="font-bold text-slate-900">{{ dayjs(shift.opened_at).format('DD MMMM YYYY') }}</p>
              <p class="text-sm text-slate-500">
                {{ dayjs(shift.opened_at).format('HH:mm') }} - {{ dayjs(shift.closed_at).format('HH:mm') }} 
                <span class="font-medium text-slate-400">({{ formatDuration(shift.opened_at, shift.closed_at) }})</span>
              </p>
            </div>
          </div>
          
          <div class="flex items-center gap-6 sm:text-right">
            <div>
              <p class="text-xs font-bold uppercase text-slate-400">Kasir</p>
              <p class="text-sm font-semibold text-slate-800">{{ shift.cashier?.name || 'Unknown' }}</p>
            </div>
            <div>
              <p class="text-xs font-bold uppercase text-slate-400">Pesanan</p>
              <p class="text-sm font-bold text-slate-900">{{ shift.total_transactions }}</p>
            </div>
            <div>
              <p class="text-xs font-bold uppercase text-slate-400">Pendapatan</p>
              <p class="text-sm font-black text-emerald-600">{{ formatRupiah(shift.total_revenue) }}</p>
            </div>
            <i class="pi pi-chevron-right text-slate-400 ml-2" />
          </div>
        </div>

        <div v-if="meta.last_page > 1" class="mt-6 flex justify-center gap-2">
          <button
            v-for="p in meta.last_page"
            :key="p"
            class="h-8 w-8 rounded-lg font-bold transition-colors"
            :class="p === meta.current_page ? 'bg-merchant-primary text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'"
            @click="loadHistory(p)"
          >
            {{ p }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
