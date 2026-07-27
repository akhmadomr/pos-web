<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import VueApexCharts from 'vue3-apexcharts'
import { fetchShiftAnalytics, fetchDailyShiftAnalytics, exportShiftDetailPdf, exportShiftDetailExcel } from '@/api/shifts'
import { formatRupiah } from '@/utils/currency'
import dayjs from 'dayjs'
import 'dayjs/locale/id'

dayjs.locale('id')

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const error = ref('')
const dailyData = ref(null)
const shiftAnalytics = ref({})
const activeTab = ref('daily')

// currentView holds the data currently being displayed (daily data or specific shift data)
const currentView = ref(null)

const isExportingPdf = ref(false)
const isExportingExcel = ref(false)

const handleDownload = async (exportFn, type) => {
  if (type === 'pdf') isExportingPdf.value = true
  else isExportingExcel.value = true

  try {
    const response = await exportFn(route.params.date)
    const url = window.URL.createObjectURL(new Blob([response.data]))
    // ...
    let filename = `Shift_Detail_${route.params.date}.${type === 'pdf' ? 'pdf' : 'xlsx'}`
    const disposition = response.headers['content-disposition']
    if (disposition && disposition.indexOf('attachment') !== -1) {
      const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition)
      if (matches != null && matches[1]) filename = matches[1].replace(/['"]/g, '')
    }
    
    const link = document.createElement('a')
    link.href = url
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

const loadDailyAnalytics = async () => {
  loading.value = true
  try {
    dailyData.value = await fetchDailyShiftAnalytics(route.params.date)
    currentView.value = {
      isDaily: true,
      summary: dailyData.value.summary,
      data: dailyData.value.data
    }
  } catch (err) {
    error.value = 'Gagal memuat detail shift.'
  } finally {
    loading.value = false
  }
}

const selectTab = async (tab) => {
  activeTab.value = tab
  if (tab === 'daily') {
    currentView.value = {
      isDaily: true,
      summary: dailyData.value.summary,
      data: dailyData.value.data
    }
  } else {
    if (!shiftAnalytics.value[tab]) {
      loading.value = true
      try {
         shiftAnalytics.value[tab] = await fetchShiftAnalytics(tab)
      } catch(e) {
         console.error(e)
      } finally {
         loading.value = false
      }
    }
    currentView.value = {
      isDaily: false,
      shift: shiftAnalytics.value[tab].shift,
      summary: {
         total_transactions: shiftAnalytics.value[tab].shift.total_transactions,
         total_revenue: shiftAnalytics.value[tab].shift.total_revenue,
         system_cash: shiftAnalytics.value[tab].shift.system_cash,
         closing_cash: shiftAnalytics.value[tab].shift.closing_cash,
         cash_difference: shiftAnalytics.value[tab].shift.cash_difference,
      },
      data: {
         hourly_trend: shiftAnalytics.value[tab].hourly_trend,
         top_products: shiftAnalytics.value[tab].top_products,
         expenses: shiftAnalytics.value[tab].expenses,
         orders: shiftAnalytics.value[tab].orders,
      }
    }
  }
}

onMounted(() => {
  loadDailyAnalytics()
})

const goBack = () => {
  router.push({ name: 'pos-shift-history' })
}

// Analytics Helpers
const premiumColors = ["#194a7a", "#44a4b4", "#f4c46c", "#ff5e5e", "#10b981", "#f59e0b"]

const trendSeries = computed(() => {
  if (!currentView.value?.data?.hourly_trend) return []
  return [
    { name: "Pesanan", type: "area", data: currentView.value.data.hourly_trend.map(d => d.transactions) },
    { name: "Pendapatan (Rp)", type: "area", data: currentView.value.data.hourly_trend.map(d => d.revenue) }
  ]
})

const trendOptions = computed(() => {
  const data = currentView.value?.data?.hourly_trend || []
  if (!data.length) return {}
  
  let maxTransIdx = 0
  let maxRevIdx = 0
  data.forEach((d, i) => {
    if (Number(d.transactions) > Number(data[maxTransIdx].transactions)) maxTransIdx = i
    if (Number(d.revenue) > Number(data[maxRevIdx].revenue)) maxRevIdx = i
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
          x: data[maxTransIdx].label, y: Number(data[maxTransIdx].transactions),
          marker: { size: 0 },
          image: {
            path: "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 640' fill='%2344a4b4'%3E%3Cpath d='M256.5 37.6C265.8 29.8 279.5 30.1 288.4 38.5C300.7 50.1 311.7 62.9 322.3 75.9C335.8 92.4 352 114.2 367.6 140.1C372.8 133.3 377.6 127.3 381.8 122.2C382.9 120.9 384 119.5 385.1 118.1C393 108.3 402.8 96 415.9 96C429.3 96 438.7 107.9 446.7 118.1C448 119.8 449.3 121.4 450.6 122.9C460.9 135.3 474.6 153.2 488.3 175.3C515.5 219.2 543.9 281.7 543.9 351.9C543.9 475.6 443.6 575.9 319.9 575.9C196.2 575.9 96 475.7 96 352C96 260.9 137.1 182 176.5 127C196.4 99.3 216.2 77.1 231.1 61.9C239.3 53.5 247.6 45.2 256.6 37.7zM321.7 480C347 480 369.4 473 390.5 459C432.6 429.6 443.9 370.8 418.6 324.6C414.1 315.6 402.6 315 396.1 322.6L370.9 351.9C364.3 359.5 352.4 359.3 346.2 351.4C328.9 329.3 297.1 289 280.9 268.4C275.5 261.5 265.7 260.4 259.4 266.5C241.1 284.3 207.9 323.3 207.9 370.8C207.9 439.4 258.5 480 321.6 480z'/%3E%3C/svg%3E",
            width: 24,
            height: 24,
            offsetY: -12,
            offsetX: -12
          }
        },
        {
          x: data[maxRevIdx].label, y: Number(data[maxRevIdx].revenue), yAxisIndex: 1,
          marker: { size: 0 },
          image: {
            path: "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 640' fill='%23194a7a'%3E%3Cpath d='M256.5 37.6C265.8 29.8 279.5 30.1 288.4 38.5C300.7 50.1 311.7 62.9 322.3 75.9C335.8 92.4 352 114.2 367.6 140.1C372.8 133.3 377.6 127.3 381.8 122.2C382.9 120.9 384 119.5 385.1 118.1C393 108.3 402.8 96 415.9 96C429.3 96 438.7 107.9 446.7 118.1C448 119.8 449.3 121.4 450.6 122.9C460.9 135.3 474.6 153.2 488.3 175.3C515.5 219.2 543.9 281.7 543.9 351.9C543.9 475.6 443.6 575.9 319.9 575.9C196.2 575.9 96 475.7 96 352C96 260.9 137.1 182 176.5 127C196.4 99.3 216.2 77.1 231.1 61.9C239.3 53.5 247.6 45.2 256.6 37.7zM321.7 480C347 480 369.4 473 390.5 459C432.6 429.6 443.9 370.8 418.6 324.6C414.1 315.6 402.6 315 396.1 322.6L370.9 351.9C364.3 359.5 352.4 359.3 346.2 351.4C328.9 329.3 297.1 289 280.9 268.4C275.5 261.5 265.7 260.4 259.4 266.5C241.1 284.3 207.9 323.3 207.9 370.8C207.9 439.4 258.5 480 321.6 480z'/%3E%3C/svg%3E",
            width: 24,
            height: 24,
            offsetY: -12,
            offsetX: -12
          }
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
    <div class="flex justify-between items-start md:items-center gap-2 md:gap-4">
      <div class="flex items-start md:items-center gap-2 md:gap-4 min-w-0">
        <button @click="goBack" class="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition shrink-0 mt-0.5 md:mt-0">
          <i class="pi pi-arrow-left text-sm md:text-base" />
        </button>
        <div class="min-w-0">
          <h1 class="text-lg md:text-xl font-black text-slate-900 leading-tight truncate">Detail Shift</h1>
          <p class="text-[10px] md:text-sm text-slate-500 mt-0.5 md:mt-1 leading-tight truncate">Statistik performa shift</p>
        </div>
      </div>
      <div class="flex gap-2 shrink-0" v-if="!loading && !error && dailyData">
        <button @click="downloadPdf" :disabled="isExportingPdf" class="h-8 w-8 md:h-10 md:w-10 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl hover:bg-rose-100 flex items-center justify-center transition disabled:opacity-50" title="Export PDF">
          <i :class="isExportingPdf ? 'pi pi-spin pi-spinner' : 'pi pi-file-pdf'"></i>
        </button>
        <button @click="downloadExcel" :disabled="isExportingExcel" class="h-8 w-8 md:h-10 md:w-10 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-xl hover:bg-emerald-100 flex items-center justify-center transition disabled:opacity-50" title="Export Excel">
          <i :class="isExportingExcel ? 'pi pi-spin pi-spinner' : 'pi pi-file-excel'"></i>
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div v-if="dailyData" class="flex flex-nowrap overflow-x-auto gap-2 border-b border-slate-200 pb-2 custom-scrollbar">
      <button 
        @click="selectTab('daily')" 
        class="shrink-0 px-4 py-2 md:px-5 md:py-2.5 rounded-t-xl font-bold text-xs md:text-sm transition-colors border-b-2"
        :class="activeTab === 'daily' ? 'border-merchant-primary text-merchant-primary bg-merchant-primary/5' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'"
      >
        <i class="pi pi-calendar-day mr-1.5 md:mr-2"></i> Ringkasan Harian
      </button>
      <button 
        v-for="(s, idx) in dailyData.shifts" 
        :key="s.id"
        @click="selectTab(s.id)" 
        class="shrink-0 px-4 py-2 md:px-5 md:py-2.5 rounded-t-xl font-bold text-xs md:text-sm transition-colors border-b-2"
        :class="activeTab === s.id ? 'border-merchant-primary text-merchant-primary bg-merchant-primary/5' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'"
      >
        <i class="pi pi-clock mr-1.5 md:mr-2"></i> {{ s.schedule?.name ?? `Shift ${idx + 1}` }}
      </button>
    </div>

    <div v-if="loading" class="flex flex-col items-center justify-center py-24 gap-4">
      <i class="pi pi-spin pi-spinner text-4xl text-merchant-primary" />
      <p class="text-sm text-gray-500 font-medium">Memuat data...</p>
    </div>

    <div v-else-if="error" class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
      <i class="pi pi-exclamation-circle text-4xl text-red-400 mb-3" />
      <p class="font-bold text-red-700">{{ error }}</p>
    </div>

    <template v-else-if="currentView">
      <!-- Info Shift Card (Hanya muncul jika bukan tab harian) -->
      <div v-if="!currentView.isDaily && currentView.shift" class="rounded-xl md:rounded-2xl border border-slate-100 bg-white p-3 sm:p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
        <div class="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-4">
          <div class="bg-slate-50 p-3 rounded-lg border border-slate-100 md:border-0 md:bg-transparent md:p-0">
            <p class="text-[9px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Kasir</p>
            <p class="mt-0.5 md:mt-1 text-sm sm:text-lg font-black text-slate-900 truncate">{{ currentView.shift.cashier?.name || '-' }}</p>
          </div>
          <div class="bg-slate-50 p-3 rounded-lg border border-slate-100 md:border-0 md:bg-transparent md:p-0">
            <p class="text-[9px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Mulai</p>
            <p class="mt-0.5 md:mt-1 text-xs sm:text-base font-bold text-slate-900">{{ dayjs(currentView.shift.opened_at).format('DD MMM, HH:mm') }}</p>
          </div>
          <div class="bg-slate-50 p-3 rounded-lg border border-slate-100 md:border-0 md:bg-transparent md:p-0">
            <p class="text-[9px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Tutup</p>
            <p class="mt-0.5 md:mt-1 text-xs sm:text-base font-bold" :class="currentView.shift.closed_at ? 'text-slate-900' : 'text-amber-500'">
              {{ currentView.shift.closed_at ? dayjs(currentView.shift.closed_at).format('DD MMM, HH:mm') : 'Shift Aktif' }}
            </p>
          </div>
          <div class="bg-slate-50 p-3 rounded-lg border border-slate-100 md:border-0 md:bg-transparent md:p-0">
            <p class="text-[9px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Kas Awal</p>
            <p class="mt-0.5 md:mt-1 text-sm sm:text-base font-black text-slate-900">{{ formatRupiah(currentView.shift.opening_cash) }}</p>
          </div>
        </div>
      </div>

      <!-- Ringkasan Umum -->
      <div>
        <h2 class="mb-4 flex items-center gap-2 text-base font-black uppercase tracking-widest text-slate-900">
          <i class="pi pi-chart-pie text-merchant-primary" /> Ringkasan Umum
        </h2>
        
        <div class="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-5 sm:gap-4">
          <div class="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition-all flex items-center gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 border border-blue-100 text-blue-700">
              <i class="pi pi-shopping-cart text-lg" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">Total Transaksi</p>
              <p class="truncate text-sm md:text-base font-black text-slate-900 leading-tight">{{ currentView.summary.total_transactions }}</p>
            </div>
          </div>
          
          <div class="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition-all flex items-center gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700">
              <i class="pi pi-money-bill text-lg" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">Total Pendapatan</p>
              <p class="truncate text-sm md:text-base font-black text-slate-900 leading-tight">{{ formatRupiah(currentView.summary.total_revenue) }}</p>
            </div>
          </div>

          <div class="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition-all flex items-center gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 border border-amber-100 text-amber-700">
              <i class="pi pi-wallet text-lg" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">Kas Sistem</p>
              <p class="truncate text-sm md:text-base font-black text-slate-900 leading-tight">{{ formatRupiah(currentView.summary.system_cash) }}</p>
            </div>
          </div>

          <div class="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition-all flex items-center gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 border border-purple-100 text-purple-700">
              <i class="pi pi-inbox text-lg" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">Kas Fisik</p>
              <p class="truncate text-sm md:text-base font-black text-slate-900 leading-tight">
                <template v-if="currentView.summary.closing_cash !== null">
                  {{ formatRupiah(currentView.summary.closing_cash) }}
                </template>
                <template v-else>—</template>
              </p>
            </div>
          </div>

          <div class="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition-all flex items-center gap-3 col-span-2 sm:col-span-1">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border" :class="currentView.summary.cash_difference < 0 ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-sky-50 border-sky-100 text-sky-700'">
              <i class="pi pi-sort-alt text-lg" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">Selisih Kas</p>
              <p class="truncate text-sm md:text-base font-black leading-tight" :class="currentView.summary.cash_difference < 0 ? 'text-rose-600' : 'text-sky-600'">
                <template v-if="currentView.summary.cash_difference !== null">
                  {{ currentView.summary.cash_difference >= 0 ? '+' : '' }}{{ formatRupiah(currentView.summary.cash_difference) }}
                </template>
                <template v-else>—</template>
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Chart Tren Per Jam -->
      <div v-if="currentView.data.hourly_trend.length > 0" class="rounded-2xl border border-slate-100 bg-white p-3 sm:p-6 pb-0 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
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
            <div v-for="(p, i) in currentView.data.top_products" :key="i"
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
            <p v-if="!currentView.data.top_products.length" class="py-4 text-center text-sm text-slate-400">Belum ada produk terjual</p>
          </div>
        </div>

        <!-- Pengeluaran -->
        <div class="rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
          <h2 class="mb-4 flex items-center gap-2 text-base font-black uppercase tracking-widest text-slate-900">
            <i class="pi pi-money-bill text-rose-500" /> Daftar Pengeluaran
          </h2>
          <div v-if="currentView.data.expenses.length" class="space-y-3">
            <div v-for="exp in currentView.data.expenses" :key="exp.id" class="flex flex-col rounded-xl border border-slate-100 bg-slate-50 p-4">
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

          <div v-if="!currentView.isDaily && currentView.shift?.notes" class="mt-6 rounded-xl border border-amber-100 bg-amber-50 p-4">
            <p class="text-xs font-bold uppercase text-amber-700 mb-1">Catatan Shift</p>
            <p class="text-sm text-amber-900">{{ currentView.shift.notes }}</p>
          </div>
        </div>
      </div>

      <!-- Riwayat Pesanan Shift -->
      <div class="mt-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
        <h2 class="mb-4 flex items-center gap-2 text-base font-black uppercase tracking-widest text-slate-900">
          <i class="pi pi-receipt text-merchant-primary" /> Riwayat Pesanan
        </h2>
        <div v-if="currentView.data.orders && currentView.data.orders.length">
          <div class="hidden md:block overflow-x-auto">
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
                <tr v-for="order in currentView.data.orders" :key="order.id" class="transition-colors hover:bg-slate-50">
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
          
          <div class="md:hidden space-y-3">
            <div v-for="order in currentView.data.orders" :key="order.id" class="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
              <div class="flex justify-between items-start mb-2">
                <div>
                  <span class="font-bold text-slate-900 text-sm">{{ order.order_number }}</span>
                  <p class="text-[10px] text-slate-500 mt-0.5">{{ dayjs(order.created_at).format('DD MMM, HH:mm') }}</p>
                </div>
                <span class="rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
                      :class="order.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : (order.status === 'cancelled' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700')">
                  {{ order.status === 'completed' ? 'Selesai' : (order.status === 'cancelled' ? 'Batal' : 'Proses') }}
                </span>
              </div>
              <div class="flex justify-between items-end border-t border-slate-50 pt-2 mt-1">
                <div>
                  <p class="text-[10px] text-slate-600 font-semibold">{{ order.order_type === 'dine_in' ? `Dine In (Meja ${order.table_number || '-'})` : 'Take Away' }}</p>
                  <p class="text-[10px] text-slate-500">{{ order.items_count }} Item</p>
                </div>
                <p class="text-xs font-black text-merchant-primary">{{ formatRupiah(order.total_amount) }}</p>
              </div>
            </div>
          </div>
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
