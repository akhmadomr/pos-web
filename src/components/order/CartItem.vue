<script setup>
import { ref, watch } from 'vue'
import { formatRupiah } from '@/utils/currency'
import { resolveImageUrl } from '@/utils/media'

const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
  index: {
    type: Number,
    required: true,
  },
})

const emit = defineEmits(['update-qty', 'remove'])

const bump = ref(false)

watch(
  () => props.item.quantity,
  () => {
    bump.value = true
    window.setTimeout(() => {
      bump.value = false
    }, 200)
  },
)

const lineTotal = () =>
  (Number(String(props.item.unit_price || 0).replace(/[^\d.-]/g, '')) + Number(String(props.item.addons_price || 0).replace(/[^\d.-]/g, ''))) * (Number(props.item.quantity) || 1)
</script>

<template>
  <div
    class="flex flex-col gap-2 rounded-xl border border-slate-100 bg-white p-2.5 md:p-3 transition"
    :class="{ 'scale-[1.02] ring-2 ring-merchant-primary/30': bump }"
  >
    <!-- Top Row: Image, Name, Variants, Trash -->
    <div class="flex items-start gap-2.5">
      <div class="h-12 w-12 md:h-14 md:w-14 shrink-0 overflow-hidden rounded-lg bg-merchant-accent">
        <img
          v-if="resolveImageUrl(item.image)"
          :src="resolveImageUrl(item.image)"
          :alt="item.product_name"
          class="h-full w-full object-cover"
        />
        <div v-else class="flex h-full items-center justify-center text-merchant-primary/30">
          <i class="pi pi-image text-sm" />
        </div>
      </div>

      <div class="min-w-0 flex-1 flex items-start justify-between gap-1.5">
        <div class="min-w-0">
          <p class="truncate text-sm font-bold text-slate-900 leading-tight">{{ item.product_name }}</p>
          <p v-if="item.variant_label" class="mt-0.5 text-[10px] md:text-xs text-slate-500 leading-tight">{{ item.variant_label }}</p>
          <p v-if="item.addons_label" class="text-[10px] md:text-xs text-merchant-primary leading-tight">{{ item.addons_label }}</p>
          <p v-if="item.notes" class="mt-0.5 text-[10px] md:text-xs italic text-slate-400 leading-tight">{{ item.notes }}</p>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
          @click="emit('remove', index)"
        >
          <i class="pi pi-trash text-xs md:text-sm" />
        </button>
      </div>
    </div>

    <!-- Bottom Row: Quantity Controls and Price (Spans full width) -->
    <div class="flex items-center justify-between mt-0.5">
      <div class="flex items-center gap-1.5 md:gap-2">
        <button
          type="button"
          class="flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-md md:rounded-lg bg-slate-100 text-xs md:text-sm font-bold text-slate-700 hover:bg-slate-200"
          @click="emit('update-qty', index, item.quantity - 1)"
        >
          −
        </button>
        <span class="min-w-[1.25rem] md:min-w-[1.5rem] text-center text-sm md:text-base font-black tabular-nums">{{ item.quantity }}</span>
        <button
          type="button"
          class="flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-md md:rounded-lg bg-merchant-primary text-xs md:text-sm font-bold text-white hover:bg-merchant-primary/90"
          @click="emit('update-qty', index, item.quantity + 1)"
        >
          +
        </button>
      </div>
      <span class="text-sm md:text-base font-black text-slate-900 shrink-0 truncate ml-2">{{ formatRupiah(lineTotal()) }}</span>
    </div>
  </div>
</template>
