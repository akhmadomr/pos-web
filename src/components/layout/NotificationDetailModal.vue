<script setup>
import { computed } from 'vue'
import dayjs from 'dayjs'

const props = defineProps({
  show: Boolean,
  notification: Object,
})

const emit = defineEmits(['close'])

const getTypeColor = (type) => {
  switch (type) {
    case 'danger': return 'text-rose-500 bg-rose-50 border-rose-100'
    case 'warning': return 'text-amber-500 bg-amber-50 border-amber-100'
    case 'success': return 'text-emerald-500 bg-emerald-50 border-emerald-100'
    default: return 'text-blue-500 bg-blue-50 border-blue-100'
  }
}

const getTypeIcon = (type) => {
  switch (type) {
    case 'danger': return 'pi-exclamation-circle'
    case 'warning': return 'pi-exclamation-triangle'
    case 'success': return 'pi-check-circle'
    default: return 'pi-info-circle'
  }
}

const labelMap = {
  current_stock: 'Stok Saat Ini',
  min_stock: 'Stok Minimum',
  unit: 'Satuan',
  amount: 'Nominal',
  total: 'Total',
  status: 'Status',
  reason: 'Alasan',
  category: 'Kategori',
  qty: 'Kuantitas',
  price: 'Harga',
  price_per_item: 'Harga Satuan'
}

const getLabel = (key) => {
  return labelMap[key] || key.replace(/_/g, ' ')
}

const filteredData = computed(() => {
  if (!props.notification?.data) return {}
  const ignoredKeys = ['title', 'message', 'type', 'action_url', 'actionUrl', 'id', 'user_id', 'created_at', 'updated_at']
  const filtered = {}
  for (const [key, value] of Object.entries(props.notification.data)) {
    if (!ignoredKeys.includes(key) && value !== null && value !== '') {
      filtered[key] = value
    }
  }
  return filtered
})
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" @click.self="emit('close')">
    <div class="w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden animate-fade-in-up">
      <div class="flex items-center justify-between border-b border-slate-100 p-4">
        <h3 class="font-bold text-slate-800">Detail Notifikasi</h3>
        <button @click="emit('close')" class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
          <i class="pi pi-times" />
        </button>
      </div>
      
      <div v-if="notification" class="p-6">
        <div class="mb-4 flex items-center gap-3">
          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border" :class="getTypeColor(notification.type)">
            <i class="pi text-xl" :class="getTypeIcon(notification.type)" />
          </div>
          <div>
            <p class="font-bold text-slate-900">{{ notification.title }}</p>
            <p class="text-xs text-slate-400">{{ dayjs(notification.created_at).format('DD MMM YYYY, HH:mm') }}</p>
          </div>
        </div>
        
        <div class="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 leading-relaxed">
          {{ notification.message }}
        </div>
        
        <!-- Extracted Data if needed -->
        <div v-if="Object.keys(filteredData).length > 0" class="mt-4 rounded-2xl border border-slate-100 bg-white p-4">
          <p class="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Data Tambahan</p>
          <ul class="space-y-1">
            <li v-for="(value, key) in filteredData" :key="key" class="flex justify-between text-xs border-b border-slate-50 pb-1 last:border-0 last:pb-0">
              <span class="text-slate-500 capitalize">{{ getLabel(key) }}</span>
              <span class="font-bold text-slate-800">{{ value }}</span>
            </li>
          </ul>
        </div>
      </div>
      
      <div class="p-4 pt-0">
        <button @click="emit('close')" class="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800">
          Tutup
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-fade-in-up {
  animation: fadeInUp 0.3s ease-out forwards;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
