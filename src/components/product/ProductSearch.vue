<script setup>
const model = defineModel({ type: String, default: '' })
</script>

<template>
  <div class="relative">
    <i class="pi pi-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
    <input
      v-model="model"
      type="search"
      placeholder="Cari produk..."
      class="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-medium text-slate-900 shadow-sm transition focus:border-merchant-primary focus:outline-none focus:ring-2 focus:ring-merchant-primary/20"
    />
    <button
      v-if="model"
      type="button"
      class="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
      @click="model = ''"
    >
      <i class="pi pi-times text-xs" />
    </button>
  </div>
</template>
