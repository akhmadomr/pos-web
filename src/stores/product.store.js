import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { fetchPosProducts } from '@/api/products'
import { db } from '@/utils/db'

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

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 jam

  async function fetchProducts(outletId) {
    loading.value = true
    error.value = null
    try {
      if (!navigator.onLine) {
        throw new Error('Offline')
      }
      const result = await fetchPosProducts(outletId)
      // Guard: pastikan selalu array meskipun API return null/object
      products.value = Array.isArray(result) ? result : []
      lastFetchedAt.value = new Date().toISOString()
      
      // Simpan ke IndexedDB untuk offline fallback (dengan timestamp cache)
      try {
        const now = new Date().toISOString()
        const enriched = JSON.parse(JSON.stringify(products.value)).map(p => ({ ...p, cached_at: now }))
        await db.products.clear()
        await db.products.bulkPut(enriched)
      } catch (dbErr) {
        console.warn('Gagal menyimpan ke IndexedDB', dbErr)
      }
    } catch (err) {
      if (!navigator.onLine || err.message === 'Network Error' || err.name === 'TypeError' || err.message?.includes('fetch') || err.message === 'Offline') {
        // Fallback baca dari IndexedDB
        const offlineProducts = await db.products.toArray()
        if (offlineProducts.length > 0) {
          const cachedAt = offlineProducts[0]?.cached_at
          const isStale = cachedAt ? (Date.now() - new Date(cachedAt).getTime() > CACHE_TTL_MS) : true
          products.value = offlineProducts
          error.value = isStale
            ? 'Mode Offline: Data produk mungkin sudah tidak terkini (> 24 jam).'
            : null
          return
        }
      }
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
