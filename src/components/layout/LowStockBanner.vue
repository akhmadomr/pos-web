<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import client from '@/api/client'

const authStore = useAuthStore()
const lowStockIngredients = ref([])
const SUPPRESS_DURATION = 30 * 60 * 1000 // 30 minutes in ms
let pollInterval = null
const formatNum = (val) => (Math.round((Number(val) || 0) * 100) / 100).toLocaleString("id-ID", { maximumFractionDigits: 2 })

const fetchLowStock = async () => {
  if (!authStore.isAuthenticated) return
  
  try {
    const res = await client.get('/pos/ingredients/low-stock', {
      params: { outlet_id: authStore.outletId }
    })
    
    if (res.data?.success) {
      const allLowStocks = res.data.data || []
      
      // Filter out those suppressed within 30 mins
      const now = Date.now()
      lowStockIngredients.value = allLowStocks.filter(item => {
        const suppressedAt = localStorage.getItem(`lowstock_suppressed_${item.id}`)
        if (!suppressedAt) return true
        
        if (now - parseInt(suppressedAt) > SUPPRESS_DURATION) {
          localStorage.removeItem(`lowstock_suppressed_${item.id}`)
          return true
        }
        return false
      })
    }
  } catch (error) {
    console.error('Failed to fetch low stock ingredients', error)
  }
}

const dismissBanner = (id) => {
  localStorage.setItem(`lowstock_suppressed_${id}`, Date.now().toString())
  lowStockIngredients.value = lowStockIngredients.value.filter(item => item.id !== id)
}

onMounted(() => {
  fetchLowStock()
  // Poll every 5 minutes (or 1 minute if preferred, let's do 1 minute to be responsive to stock changes, 
  // but wait, the prompt says "30-minute polling-based Low Stock Banner", wait "30-minute polling-based" means checking every 30 minutes?
  // "tracks alert dismissal history via browser storage... 30-minute polling-based"
  // Actually, I'll poll every 1 minute but suppress for 30 minutes on close.
  pollInterval = setInterval(fetchLowStock, 60 * 1000)
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})
</script>

<template>
  <div class="flex flex-col">
    <div 
      v-for="item in lowStockIngredients" 
      :key="item.id"
      class="sticky top-[100px] lg:top-[145px] z-20 relative flex flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 bg-amber-500 px-3 sm:px-4 py-2 text-amber-950 shadow-md border-t border-amber-600"
    >
      <div class="flex items-start sm:items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs lg:text-sm font-bold flex-1 pr-8 sm:pr-0 leading-tight">
        <i class="pi pi-exclamation-triangle text-xs sm:text-sm lg:text-lg mt-0.5 sm:mt-0 shrink-0" />
        <span>Bahan Baku Menipis: {{ item.name }} (Sisa: {{ formatNum(item.current_stock) }} {{ item.unit }} - Min: {{ formatNum(item.min_stock_outlet ?? item.min_stock) }} {{ item.unit }}).</span>
      </div>
      <button @click="dismissBanner(item.id)" class="absolute right-2 top-1.5 sm:static flex h-5 w-5 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded bg-amber-600 text-white transition hover:bg-amber-700" title="Abaikan selama 30 menit">
        <i class="pi pi-times text-[10px] sm:text-sm" />
      </button>
    </div>
  </div>
</template>
