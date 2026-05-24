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
  (Number(props.item.unit_price) + Number(props.item.addons_price)) * props.item.quantity
</script>

<template>
  <div
    class="flex gap-3 rounded-2xl border border-slate-100 bg-white p-3 transition"
    :class="{ 'scale-[1.02] ring-2 ring-merchant-primary/30': bump }"
  >
    <div class="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-merchant-accent">
      <img
        v-if="resolveImageUrl(item.image)"
        :src="resolveImageUrl(item.image)"
        :alt="item.product_name"
        class="h-full w-full object-cover"
      />
      <div v-else class="flex h-full items-center justify-center text-merchant-primary/30">
        <i class="pi pi-image" />
      </div>
    </div>

    <div class="min-w-0 flex-1">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="truncate font-bold text-slate-900">{{ item.product_name }}</p>
          <p v-if="item.variant_label" class="text-xs text-slate-500">{{ item.variant_label }}</p>
          <p v-if="item.addons_label" class="text-xs text-merchant-primary">{{ item.addons_label }}</p>
          <p v-if="item.notes" class="mt-0.5 text-xs italic text-slate-400">{{ item.notes }}</p>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
          @click="emit('remove', index)"
        >
          <i class="pi pi-trash text-sm" />
        </button>
      </div>

      <div class="mt-2 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-700"
            @click="emit('update-qty', index, item.quantity - 1)"
          >
            −
          </button>
          <span class="min-w-[1.5rem] text-center text-sm font-black tabular-nums">{{ item.quantity }}</span>
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-lg bg-merchant-primary text-sm font-bold text-white"
            @click="emit('update-qty', index, item.quantity + 1)"
          >
            +
          </button>
        </div>
        <span class="text-sm font-black text-slate-900">{{ formatRupiah(lineTotal()) }}</span>
      </div>
    </div>
  </div>
</template>
