<script setup>
import { ref } from 'vue'
import ProductCard from '@/components/product/ProductCard.vue'

defineProps({
  products: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['select'])

const pressedId = ref(null)

const handleSelect = (product) => {
  pressedId.value = product.id
  emit('select', product)
  window.setTimeout(() => {
    pressedId.value = null
  }, 150)
}
</script>

<template>
  <div v-if="loading" class="grid grid-cols-2 gap-3 md:grid-cols-3">
    <div v-for="n in 9" :key="n" class="min-h-[120px] animate-pulse rounded-2xl bg-slate-200" />
  </div>

  <div
    v-else-if="products.length"
    class="grid grid-cols-2 gap-3 md:grid-cols-3"
  >
    <ProductCard
      v-for="product in products"
      :key="product.id"
      :product="product"
      :pressed="pressedId === product.id"
      @select="handleSelect"
    />
  </div>

  <div v-else class="flex flex-col items-center justify-center py-16 text-center">
    <i class="pi pi-box mb-4 text-5xl text-slate-300" />
    <p class="font-semibold text-slate-500">Produk tidak ditemukan</p>
    <p class="mt-1 text-sm text-slate-400">Coba kategori atau kata kunci lain</p>
  </div>
</template>
