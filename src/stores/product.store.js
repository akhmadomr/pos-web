import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { fetchPosProducts } from '@/api/products'

export const useProductStore = defineStore('product', () => {
  const products = ref([])
  const loading = ref(false)
  const error = ref(null)
  const lastFetchedAt = ref(null)

  const categories = computed(() => {
    const map = new Map()

    products.value.forEach((product) => {
      const cat = product.category
      const id = cat?.id ?? 0
      const name = cat?.name ?? 'Lainnya'

      if (!map.has(id)) {
        map.set(id, { id, name, slug: cat?.slug ?? 'lainnya', count: 0 })
      }
      map.get(id).count += 1
    })

    return [
      { id: null, name: 'Semua', slug: 'all', count: products.value.length },
      ...[...map.values()].sort((a, b) => a.name.localeCompare(b.name)),
    ]
  })

  async function fetchProducts(outletId) {
    loading.value = true
    error.value = null
    try {
      const result = await fetchPosProducts(outletId)
      // Guard: pastikan selalu array meskipun API return null/object
      products.value = Array.isArray(result) ? result : []
      lastFetchedAt.value = new Date().toISOString()
    } catch (err) {
      error.value = err.response?.data?.message || 'Gagal memuat produk.'
      products.value = []
    } finally {
      loading.value = false
    }
  }

  function getProductById(id) {
    return products.value.find((p) => p.id === id) ?? null
  }

  return {
    products,
    loading,
    error,
    lastFetchedAt,
    categories,
    fetchProducts,
    getProductById,
  }
})
