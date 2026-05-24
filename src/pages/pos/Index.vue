<script setup>
import { computed, onMounted, ref } from 'vue'
import AppAlert from '@/components/common/AppAlert.vue'
import CategoryTabs from '@/components/product/CategoryTabs.vue'
import OrderCart from '@/components/order/OrderCart.vue'
import ProductGrid from '@/components/product/ProductGrid.vue'
import ProductSearch from '@/components/product/ProductSearch.vue'
import VariantModal from '@/components/product/VariantModal.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useCartStore } from '@/stores/cart.store'
import { useProductStore } from '@/stores/product.store'

const authStore = useAuthStore()
const productStore = useProductStore()
const cartStore = useCartStore()

const selectedCategory = ref(null)
const searchQuery = ref('')
const activePanel = ref('products')
const showVariantModal = ref(false)
const selectedProduct = ref(null)

const filteredProducts = computed(() => {
  let list = productStore.products

  if (selectedCategory.value != null) {
    list = list.filter((p) => (p.category?.id ?? 0) === selectedCategory.value)
  }

  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.slug?.toLowerCase().includes(q) ||
        p.category?.name?.toLowerCase().includes(q),
    )
  }

  return list
})

const needsConfiguration = (product) =>
  (product.variants?.length ?? 0) > 0 || (product.addons?.length ?? 0) > 0

const handleProductSelect = (product) => {
  if (needsConfiguration(product)) {
    selectedProduct.value = product
    showVariantModal.value = true
    return
  }

  cartStore.addItem(product, { quantity: 1 })
  if (window.innerWidth < 1024) {
    activePanel.value = 'cart'
  }
}

const handleVariantAdd = ({ product, variantSelections, addonIds, quantity, notes }) => {
  cartStore.addItem(product, { variantSelections, addonIds, quantity, notes })
  if (window.innerWidth < 1024) {
    activePanel.value = 'cart'
  }
}

const handleCheckout = () => {
  window.alert('Alur pembayaran akan diimplementasikan pada Task 4.4.')
}

onMounted(() => {
  productStore.fetchProducts(authStore.outletId ?? authStore.user?.outlet_id)
})
</script>

<template>
  <div class="flex h-[calc(100vh-10rem)] min-h-[500px] flex-col lg:h-[calc(100vh-12rem)]">
    <AppAlert
      v-if="productStore.error"
      type="error"
      :message="productStore.error"
      class="mb-4 shrink-0"
      dismissible
    />

    <div class="mb-3 flex shrink-0 gap-2 lg:hidden">
      <button
        type="button"
        class="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition"
        :class="
          activePanel === 'products'
            ? 'bg-merchant-primary text-white'
            : 'bg-white text-slate-600 ring-1 ring-slate-200'
        "
        @click="activePanel = 'products'"
      >
        <i class="pi pi-th-large" />
        Produk
      </button>
      <button
        type="button"
        class="relative flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition"
        :class="
          activePanel === 'cart'
            ? 'bg-merchant-primary text-white'
            : 'bg-white text-slate-600 ring-1 ring-slate-200'
        "
        @click="activePanel = 'cart'"
      >
        <i class="pi pi-shopping-cart" />
        Keranjang
        <span
          v-if="cartStore.itemCount"
          class="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white"
        >
          {{ cartStore.itemCount }}
        </span>
      </button>
    </div>

    <div class="grid min-h-0 flex-1 gap-4 lg:grid-cols-5 lg:gap-6">
      <section
        class="flex min-h-0 flex-col gap-4 lg:col-span-3"
        :class="{ 'hidden lg:flex': activePanel !== 'products' }"
      >
        <CategoryTabs
          v-model="selectedCategory"
          :categories="productStore.categories"
        />
        <ProductSearch v-model="searchQuery" />
        <div class="min-h-0 flex-1 overflow-y-auto pr-1">
          <ProductGrid
            :products="filteredProducts"
            :loading="productStore.loading"
            @select="handleProductSelect"
          />
        </div>
      </section>

      <section
        class="min-h-0 lg:col-span-2"
        :class="{ 'hidden lg:block': activePanel !== 'cart' }"
      >
        <OrderCart class="h-full" @checkout="handleCheckout" />
      </section>
    </div>

    <VariantModal
      :show="showVariantModal"
      :product="selectedProduct"
      @close="showVariantModal = false"
      @add="handleVariantAdd"
    />
  </div>
</template>
