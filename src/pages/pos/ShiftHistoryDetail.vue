<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import VueApexCharts from 'vue3-apexcharts'
import { fetchShiftAnalytics, exportShiftDetailPdf, exportShiftDetailExcel } from '@/api/shifts'
import { formatRupiah } from '@/utils/currency'
import dayjs from 'dayjs'
import 'dayjs/locale/id'

dayjs.locale('id')

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const error = ref('')
const analytics = ref(null)

const isExportingPdf = ref(false)
const isExportingExcel = ref(false)

const handleDownload = async (exportFn, type) => {
  if (type === 'pdf') isExportingPdf.value = true
  else isExportingExcel.value = true

  try {
    const response = await exportFn(route.params.id)
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    
    let filename = `Shift_Detail_${route.params.id}.${type === 'pdf' ? 'pdf' : 'xlsx'}`
    const disposition = response.headers['content-disposition']
    if (disposition && disposition.indexOf('attachment') !== -1) {
      const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition)
      if (matches != null && matches[1]) filename = matches[1].replace(/['"]/g, '')
    }
    
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  } catch(e) {
    console.error('Export failed', e)
    alert('Gagal mengekspor data.')
  } finally {
    if (type === 'pdf') isExportingPdf.value = false
    else isExportingExcel.value = false
  }
}

const downloadPdf = () => handleDownload(exportShiftDetailPdf, 'pdf')
const downloadExcel = () => handleDownload(exportShiftDetailExcel, 'excel')

const loadAnalytics = async () => {
  loading.value = true
  try {
    analytics.value = await fetchShiftAnalytics(route.params.id)
  } catch (err) {
    error.value = 'Gagal memuat detail shift.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadAnalytics()
})

const goBack = () => {
  router.push({ name: 'pos-shift-history' })
}

// Analytics Helpers
const premiumColors = ["#194a7a", "#44a4b4", "#f4c46c", "#ff5e5e", "#10b981", "#f59e0b"]

const trendSeries = computed(() => {
  if (!analytics.value?.hourly_trend) return []
  return [
    { name: "Pesanan", type: "area", data: analytics.value.hourly_trend.map(d => d.transactions) },
    { name: "Pendapatan (Rp)", type: "area", data: analytics.value.hourly_trend.map(d => d.revenue) }
  ]
})

const trendOptions = computed(() => {
  const data = analytics.value?.hourly_trend || []
  if (!data.length) return {}
  
  let maxTransIdx = 0
  let maxRevIdx = 0
  data.forEach((d, i) => {
    if (d.transactions > data[maxTransIdx].transactions) maxTransIdx = i
    if (d.revenue > data[maxRevIdx].revenue) maxRevIdx = i
  })

  return {
    chart: { type: "area", height: 350, fontFamily: "Inter, sans-serif", toolbar: { show: false } },
    stroke: { curve: "smooth", width: [3, 3] },
    fill: { type: "gradient", gradient: { enabled: true, opacityFrom: 0.55, opacityTo: 0 } },
    colors: ["#44a4b4", "#194a7a"],
    dataLabels: { enabled: false },
    xaxis: { categories: data.map(d => d.label), labels: { style: { colors: "#64748b", fontSize: "10px" }, hideOverlappingLabels: true } },
    yaxis: [
      { title: { text: "Pesanan", style: { color: "#44a4b4", fontWeight: 600, fontSize: "10px" } }, labels: { formatter: v => Math.round(v), style: { colors: "#64748b", fontSize: "10px" } } },
      { opposite: true, title: { text: "Rp", style: { color: "#194a7a", fontWeight: 600, fontSize: "10px" } }, labels: { formatter: v => {
        if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M'
        if (v >= 1000) return (v / 1000).toFixed(0) + 'K'
        return v
      }, style: { colors: "#64748b", fontSize: "10px" } } }
    ],
    annotations: {
      points: [
        {
          x: data[maxTransIdx].label, y: data[maxTransIdx].transactions,
          marker: { size: 6, fillColor: "#fff", strokeColor: "#44a4b4", strokeWidth: 2 },
          label: { text: "Pesanan Terbanyak", style: { background: "#44a4b4", color: "#fff", padding: { left: 5, right: 5, top: 2, bottom: 2 } } }
        },
        {
          x: data[maxRevIdx].label, y: data[maxRevIdx].revenue, yAxisIndex: 1,
          marker: { size: 6, fillColor: "#fff", strokeColor: "#194a7a", strokeWidth: 2 },
          label: { text: "Pendapatan Tertinggi", style: { background: "#194a7a", color: "#fff", padding: { left: 5, right: 5, top: 2, bottom: 2 } } }
        }
      ]
    },
    legend: { position: "top", horizontalAlign: "right", fontWeight: 500, fontSize: '11px' },
    grid: { borderColor: "#f1f5f9", xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } }, padding: { left: 0, right: 0 } }
  }
})

const getRankClass = (idx) => {
  if (idx === 0) return 'bg-gradient-to-r from-yellow-50 to-amber-50 border-amber-200'
  if (idx === 1) return 'bg-gradient-to-r from-gray-50 to-slate-100 border-gray-300'
  if (idx === 2) return 'bg-gradient-to-r from-orange-50 to-orange-100 border-orange-300'
  return 'bg-white border-gray-100 hover:bg-gray-50'
}

const getRankBadgeClass = (idx) => {
  if (idx === 0) return 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white border-2 border-amber-200 shadow-sm'
  if (idx === 1) return 'bg-gradient-to-br from-gray-400 to-slate-500 text-white border-2 border-gray-200 shadow-sm'
  if (idx === 2) return 'bg-gradient-to-br from-orange-400 to-amber-600 text-white border-2 border-orange-200 shadow-sm'
  return 'bg-gray-100 text-gray-600 border border-gray-200'
}
</script>

<template>
  <div class="space-y-6 pb-10">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <button @click="goBack" class="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition">
          <i class="pi pi-arrow-left" />
        </button>
        <div>
          <h1 class="text-xl font-black text-slate-900">Detail & Analisis Shift</h1>
          <p class="text-sm text-slate-500">Statistik performa penjualan selama shift berlangsung</p>
        </div>
      </div>
      <div class="flex gap-2" v-if="!loading && !error && analytics">
        <button @click="downloadPdf" :disabled="isExportingPdf" class="px-4 py-2 bg-rose-50 text-rose-600 border border-rose-200 font-bold rounded-xl hover:bg-rose-100 flex items-center gap-2 transition text-sm disabled:opacity-50">
          <i :class="isExportingPdf ? 'pi pi-spin pi-spinner' : 'pi pi-file-pdf'"></i> PDF
        </button>
        <button @click="downloadExcel" :disabled="isExportingExcel" class="px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-200 font-bold rounded-xl hover:bg-emerald-100 flex items-center gap-2 transition text-sm disabled:opacity-50">
          <i :class="isExportingExcel ? 'pi pi-spin pi-spinner' : 'pi pi-file-excel'"></i> Excel
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex flex-col items-center justify-center py-24 gap-4">
      <i class="pi pi-spin pi-spinner text-4xl text-merchant-primary" />
      <p class="text-sm text-gray-500 font-medium">Memuat analisis shift...</p>
    </div>

    <div v-else-if="error" class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
      <i class="pi pi-exclamation-circle text-4xl text-red-400 mb-3" />
      <p class="font-bold text-red-700">{{ error }}</p>
    </div>

    <template v-else-if="analytics">
      <!-- Info Shift Card -->
      <div class="rounded-2xl border border-slate-100 bg-white p-4 sm:p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
        <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <p class="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Kasir</p>
            <p class="mt-1 text-sm sm:text-lg font-black text-slate-900 truncate">{{ analytics.shift.cashier?.name || '-' }}</p>
          </div>
          <div>
            <p class="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Mulai</p>
            <p class="mt-1 text-xs sm:text-base font-bold text-slate-900">{{ dayjs(analytics.shift.opened_at).format('DD MMM, HH:mm') }}</p>
          </div>
          <div>
            <p class="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Tutup</p>
            <p class="mt-1 text-xs sm:text-base font-bold" :class="analytics.shift.closed_at ? 'text-slate-900' : 'text-amber-500'">
              {{ analytics.shift.closed_at ? dayjs(analytics.shift.closed_at).format('DD MMM, HH:mm') : 'Shift Aktif' }}
            </p>
          </div>
          <div>
            <p class="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Kas Awal</p>
            <p class="mt-1 text-sm sm:text-base font-black text-slate-900">{{ formatRupiah(analytics.shift.opening_cash) }}</p>
          </div>
        </div>
      </div>

      <!-- Ringkasan Umum -->
      <div>
        <h2 class="mb-4 flex items-center gap-2 text-base font-black uppercase tracking-widest text-slate-900">
          <i class="pi pi-chart-pie text-merchant-primary" /> Ringkasan Umum
        </h2>
        
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5 sm:gap-4">
          <div class="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition-all hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.1)]">
            <div class="mb-2 sm:mb-3 flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-blue-50 border border-blue-100 text-blue-700">
              <i class="pi pi-shopping-cart text-sm sm:text-lg" />
            </div>
            <p class="mb-0.5 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Transaksi</p>
            <p class="truncate text-lg sm:text-2xl font-black text-slate-900">{{ analytics.shift.total_transactions }}</p>
          </div>
          
          <div class="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition-all hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.1)]">
            <div class="mb-2 sm:mb-3 flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700">
              <i class="pi pi-money-bill text-sm sm:text-lg" />
            </div>
            <p class="mb-0.5 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Pendapatan</p>
            <p class="truncate text-base sm:text-xl font-black text-slate-900">{{ formatRupiah(analytics.shift.total_revenue) }}</p>
          </div>

          <div class="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition-all hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.1)]">
            <div class="mb-2 sm:mb-3 flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-amber-50 border border-amber-100 text-amber-700">
              <i class="pi pi-wallet text-sm sm:text-lg" />
            </div>
            <p class="mb-0.5 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Kas Sistem</p>
            <p class="truncate text-base sm:text-xl font-black text-slate-900">{{ formatRupiah(analytics.shift.system_cash) }}</p>
          </div>

          <div class="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition-all hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.1)]">
            <div class="mb-2 sm:mb-3 flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-purple-50 border border-purple-100 text-purple-700">
              <i class="pi pi-inbox text-sm sm:text-lg" />
            </div>
            <p class="mb-0.5 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Kas Fisik</p>
            <p class="truncate text-base sm:text-xl font-black text-slate-900">
              <template v-if="analytics.shift.closing_cash !== null">
                {{ formatRupiah(analytics.shift.closing_cash) }}
              </template>
              <template v-else>—</template>
            </p>
          </div>

          <div class="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition-all hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.1)]">
            <div class="mb-2 sm:mb-3 flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl border" :class="analytics.shift.cash_difference < 0 ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-sky-50 border-sky-100 text-sky-700'">
              <i class="pi pi-sort-alt text-sm sm:text-lg" />
            </div>
            <p class="mb-0.5 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Selisih Kas</p>
            <p class="truncate text-base sm:text-xl font-black" :class="analytics.shift.cash_difference < 0 ? 'text-rose-600' : 'text-sky-600'">
              <template v-if="analytics.shift.cash_difference !== null">
                {{ analytics.shift.cash_difference >= 0 ? '+' : '' }}{{ formatRupiah(analytics.shift.cash_difference) }}
              </template>
              <template v-else>—</template>
            </p>
          </div>
        </div>
      </div>

      <!-- Chart Tren Per Jam -->
      <div v-if="analytics.hourly_trend.length > 0" class="rounded-2xl border border-slate-100 bg-white p-3 sm:p-6 pb-0 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
        <h2 class="mb-2 sm:mb-6 px-1 flex items-center gap-2 text-sm sm:text-base font-black uppercase tracking-widest text-slate-900">
          <i class="pi pi-chart-line text-merchant-primary" /> Tren Transaksi Per Jam
        </h2>
        <div class="-mx-3 sm:mx-0">
          <VueApexCharts type="area" height="300" :options="trendOptions" :series="trendSeries" />
        </div>
      </div>

      <!-- Produk Terlaris & Pengeluaran -->
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <!-- Produk -->
        <div class="rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
          <h2 class="mb-4 flex items-center gap-2 text-base font-black uppercase tracking-widest text-slate-900">
            <i class="pi pi-box text-merchant-primary" /> Produk Terlaris
          </h2>
          <div class="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            <div v-for="(p, i) in analytics.top_products" :key="i"
                 :class="['flex items-center gap-4 rounded-xl border p-3 transition-colors', getRankClass(i)]">
              <span :class="['flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black shadow-sm', getRankBadgeClass(i)]">
                  {{ i + 1 }}
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-bold text-slate-900">{{ p.name }}</p>
              </div>
              <div class="shrink-0 text-right">
                <p class="text-sm font-bold text-slate-900">{{ p.total_qty }} porsi</p>
                <p class="text-[10px] font-black text-emerald-600">{{ formatRupiah(p.total_revenue) }}</p>
              </div>
            </div>
            <p v-if="!analytics.top_products.length" class="py-4 text-center text-sm text-slate-400">Belum ada produk terjual</p>
          </div>
        </div>

        <!-- Pengeluaran -->
        <div class="rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
          <h2 class="mb-4 flex items-center gap-2 text-base font-black uppercase tracking-widest text-slate-900">
            <i class="pi pi-money-bill text-rose-500" /> Daftar Pengeluaran
          </h2>
          <div v-if="analytics.expenses.length" class="space-y-3">
            <div v-for="exp in analytics.expenses" :key="exp.id" class="flex flex-col rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-bold text-slate-700">{{ exp.category }}</span>
                <span class="rounded-lg bg-white px-3 py-1 text-sm font-black text-rose-600 shadow-sm border border-slate-100">{{ formatRupiah(exp.amount) }}</span>
              </div>
              <p class="text-xs font-semibold text-slate-500">{{ exp.qty }} x {{ formatRupiah(exp.price_per_item) }}</p>
            </div>
          </div>
          <div v-else class="flex flex-col items-center justify-center py-8">
            <i class="pi pi-check-circle text-4xl text-slate-200 mb-2" />
            <p class="text-sm text-slate-400">Tidak ada pengeluaran tambahan pada shift ini</p>
          </div>

          <div v-if="analytics.shift.notes" class="mt-6 rounded-xl border border-amber-100 bg-amber-50 p-4">
            <p class="text-xs font-bold uppercase text-amber-700 mb-1">Catatan Shift</p>
            <p class="text-sm text-amber-900">{{ analytics.shift.notes }}</p>
          </div>
        </div>
      </div>

      <!-- Riwayat Pesanan Shift -->
      <div class="mt-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
        <h2 class="mb-4 flex items-center gap-2 text-base font-black uppercase tracking-widest text-slate-900">
          <i class="pi pi-receipt text-merchant-primary" /> Riwayat Pesanan
        </h2>
        <div v-if="analytics.orders && analytics.orders.length" class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="border-b border-slate-100 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th class="p-3">Waktu</th>
                <th class="p-3">No. Pesanan</th>
                <th class="p-3">Tipe</th>
                <th class="p-3">Item</th>
                <th class="p-3">Status</th>
                <th class="p-3 text-right">Total (Rp)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="order in analytics.orders" :key="order.id" class="transition-colors hover:bg-slate-50">
                <td class="p-3 text-slate-500">{{ dayjs(order.created_at).format('HH:mm') }}</td>
                <td class="p-3 font-bold text-slate-900">{{ order.order_number }}</td>
                <td class="p-3 text-slate-600">
                  {{ order.order_type === 'dine_in' ? `Dine In (Meja ${order.table_number || '-'})` : 'Take Away' }}
                </td>
                <td class="p-3 text-slate-600">{{ order.items_count }} Item</td>
                <td class="p-3">
                  <span class="rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wider"
                        :class="order.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 
                               (order.status === 'cancelled' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700')">
                    {{ order.status === 'completed' ? 'Selesai' : (order.status === 'cancelled' ? 'Batal' : 'Proses') }}
                  </span>
                </td>
                <td class="p-3 text-right font-bold text-slate-900">{{ formatRupiah(order.total_amount) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="py-8 text-center text-sm text-slate-400">
          Belum ada pesanan pada shift ini.
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>
