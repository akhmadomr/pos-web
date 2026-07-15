<script setup>
import { computed } from 'vue'
import { formatRupiah } from '@/utils/currency'
import { resolveImageUrl } from '@/utils/media'

const props = defineProps({
  product: {
    type: Object,
    required: true,
  },
  pressed: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['select'])

const imageUrl = computed(() => resolveImageUrl(props.product.image))

const hasVariants = computed(() => (props.product.variants?.length ?? 0) > 0)
const hasAddons = computed(() => (props.product.addons?.length ?? 0) > 0)

const onClick = () => emit('select', props.product)
</script>

<template>
  <button
    type="button"
    class="group flex min-h-[120px] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition duration-150 active:scale-[0.97]"
    :class="pressed ? 'ring-2 ring-merchant-primary scale-[0.97]' : 'hover:border-merchant-primary/40 hover:shadow-md'"
    @click="onClick"
  >
    <div class="relative aspect-[4/3] w-full overflow-hidden bg-merchant-accent">
      <img
        v-if="imageUrl"
        :src="imageUrl"
        :alt="product.name"
        class="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        loading="lazy"
      />
      <div v-else class="flex h-full w-full items-center justify-center text-merchant-primary/40">
        <i class="pi pi-image text-4xl" />
      </div>

      <span
        v-if="hasVariants || hasAddons"
        class="absolute right-2 top-2 rounded-lg bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase text-merchant-primary shadow"
      >
        {{ hasVariants ? 'Varian' : 'Addon' }}
      </span>
    </div>

    <div class="flex flex-1 flex-col p-3">
      <p class="line-clamp-1 text-sm font-bold leading-snug text-slate-900">{{ product.name }}</p>
      <p v-if="product.slang" class="mt-0.5 line-clamp-1 text-xs font-medium text-slate-400">{{ product.slang }}</p>
      <p class="mt-auto pt-1.5 text-base font-black text-merchant-primary">
        {{ formatRupiah(product.selling_price) }}
      </p>
    </div>
  </button>
</template>
