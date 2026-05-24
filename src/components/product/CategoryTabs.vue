<script setup>
defineProps({
  categories: {
    type: Array,
    default: () => [],
  },
})

const selected = defineModel({ type: [Number, null], default: null })
</script>

<template>
  <div class="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    <button
      v-for="cat in categories"
      :key="cat.id ?? 'all'"
      type="button"
      class="flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition active:scale-95"
      :class="
        selected === cat.id
          ? 'bg-merchant-primary text-white shadow-lg shadow-merchant-primary/25'
          : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-merchant-accent'
      "
      @click="selected = cat.id"
    >
      {{ cat.name }}
      <span
        class="rounded-full px-2 py-0.5 text-[10px] font-black"
        :class="selected === cat.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'"
      >
        {{ cat.count }}
      </span>
    </button>
  </div>
</template>
