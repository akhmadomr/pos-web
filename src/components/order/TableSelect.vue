<script setup>
import { computed, onMounted, ref } from 'vue'
import { fetchTables } from '@/api/tables'
import { useAuthStore } from '@/stores/auth.store'

const props = defineProps({
  modelValue: {
    type: Number,
    default: null,
  },
})

const emit = defineEmits(['update:modelValue'])

const authStore = useAuthStore()
const tables = ref([])
const loading = ref(false)

const loadTables = async () => {
  loading.value = true
  try {
    tables.value = await fetchTables(authStore.outletId)
  } catch {
    tables.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadTables()
})

const selectedTable = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})
</script>

<template>
  <div class="w-full">
    <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
      Nomor Meja
    </label>
    <div class="relative">
      <select
        v-model="selectedTable"
        class="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm font-semibold text-slate-700 focus:border-merchant-primary focus:outline-none focus:ring-2 focus:ring-merchant-primary/20 disabled:bg-slate-50"
        :disabled="loading"
      >
        <option :value="null">Pilih Meja...</option>
        <option v-for="table in tables" :key="table.id" :value="table.id">
          {{ table.table_number }} {{ table.name ? `— ${table.name}` : '' }}
        </option>
      </select>
      <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
        <i v-if="loading" class="pi pi-spin pi-spinner text-slate-400" />
        <i v-else class="pi pi-chevron-down text-slate-400" />
      </div>
    </div>
  </div>
</template>
