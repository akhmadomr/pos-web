<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppAlert from '@/components/common/AppAlert.vue'
import PaymentModal from '@/components/payment/PaymentModal.vue'
import PaymentSuccess from '@/components/payment/PaymentSuccess.vue'
import CategoryTabs from '@/components/product/CategoryTabs.vue'
import OrderCart from '@/components/order/OrderCart.vue'
import ProductGrid from '@/components/product/ProductGrid.vue'
import ProductSearch from '@/components/product/ProductSearch.vue'
import VariantModal from '@/components/product/VariantModal.vue'
import { usePrinter } from '@/composables/usePrinter'
import { usePayment } from '@/composables/usePayment'
import { useAuthStore } from '@/stores/auth.store'
import { useCartStore } from '@/stores/cart.store'
import { useProductStore } from '@/stores/product.store'
import { formatRupiah } from '@/utils/currency'

const authStore = useAuthStore()
const productStore = useProductStore()
const cartStore = useCartStore()
const payment = usePayment()
const printer = usePrinter()
const router = useRouter()

const selectedCategory = ref(null)
const searchQuery = ref('')
const isCartExpanded = ref(false)
const showVariantModal = ref(false)
const selectedProduct = ref(null)
const showPaymentModal = ref(false)
const showPaymentSuccess = ref(false)
const showEditSuccess = ref(false)

const successPayload = ref({
  orderNumber: '',
  total: 0,
  changeAmount: 0,
  paymentMethod: '',
})

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
  selectedProduct.value = product
  showVariantModal.value = true
}

const handleVariantAdd = ({ product, variantSelections, addonIds, quantity, notes }) => {
  cartStore.addItem(product, { variantSelections, addonIds, quantity, notes })
}

const handleCheckout = () => {
  if (!cartStore.items.length) return
  showPaymentModal.value = true
}

const handlePaid = async (payload) => {
  showPaymentModal.value = false

  if (payload.is_edit_request) {
    showEditSuccess.value = true
    setTimeout(() => {
      showEditSuccess.value = false
      cartStore.clearCart()
      payment.resetPayment()
      router.push('/pos/history')
    }, 2500)
    return
  }

  if (payload.receipt_data) {
    await printer.printReceipt(payload.receipt_data)
  }

  successPayload.value = {
    orderNumber: payload.receipt_data?.order_number ?? payload.order?.order_number ?? '',
    total: payload.receipt_data?.total_amount ?? cartStore.total,
    changeAmount: payload.change_amount ?? 0,
    paymentMethod: payment.paymentMethod?.value ?? '',
  }

  showPaymentSuccess.value = true
}

const handlePaymentDone = () => {
  showPaymentSuccess.value = false
  cartStore.clearCart()
  payment.resetPayment()
  isCartExpanded.value = false
}

onMounted(() => {
  productStore.fetchProducts(authStore.outletId ?? authStore.user?.outlet_id)
})
</script>

<template>
  <div class="flex h-[calc(100vh-5.5rem)] min-h-[500px] flex-col lg:h-[calc(100vh-10.5rem)] relative">
    <AppAlert
      v-if="productStore.error"
      type="error"
      :message="productStore.error"
      class="mb-4 shrink-0"
      dismissible
    />

    <div v-if="cartStore.isEditingOrder" class="mb-4 shrink-0 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm flex items-center justify-between">
      <div class="flex items-center gap-3">
        <i class="pi pi-file-edit text-2xl text-amber-500" />
        <div>
          <h3 class="font-black text-amber-900">Mode Edit Transaksi ({{ cartStore.editingOriginalOrder?.order_number }})</h3>
          <p class="text-xs font-semibold text-amber-700">Alasan: {{ cartStore.editingOrderReason }}</p>
        </div>
      </div>
      <button @click="cartStore.clearCart()" class="text-xs font-bold text-amber-700 hover:text-amber-900 underline">Batalkan Edit</button>
    </div>

    <div class="grid min-h-0 flex-1 gap-4 pb-20 lg:grid-cols-5 lg:gap-6 lg:pb-0">
      <section class="flex min-h-0 min-w-0 flex-col gap-4 lg:col-span-3">
        <CategoryTabs v-model="selectedCategory" :categories="productStore.categories" />
        <ProductSearch v-model="searchQuery" />
        <div class="min-h-0 flex-1 overflow-y-auto pr-1">
          <ProductGrid
            :products="filteredProducts"
            :loading="productStore.loading"
            @select="handleProductSelect"
          />
        </div>
      </section>

      <!-- Desktop Cart -->
      <section class="hidden min-h-0 lg:col-span-2 lg:block">
        <OrderCart class="h-full" @checkout="handleCheckout" />
      </section>
    </div>

    <!-- Mobile Bottom Deck Cart -->
    <div
      v-if="cartStore.items.length > 0"
      class="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-3xl border-t border-slate-200 bg-white shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.15)] transition-all duration-300 ease-in-out lg:hidden"
      :class="isCartExpanded ? 'h-[85vh]' : 'h-auto'"
    >
      <div 
        class="flex cursor-pointer items-center justify-between p-4"
        @click="isCartExpanded = !isCartExpanded"
      >
        <div class="flex items-center gap-3">
          <div class="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-merchant-primary/10 text-merchant-primary">
            <i class="pi pi-shopping-cart text-xl" />
            <span class="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white shadow-lg">{{ cartStore.itemCount }}</span>
          </div>
          <div>
            <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Belanja</p>
            <p class="text-lg font-black leading-none text-slate-900">{{ formatRupiah(cartStore.total) }}</p>
          </div>
        </div>
        
        <div class="flex items-center gap-2">
          <button 
            v-if="!isCartExpanded"
            @click.stop="handleCheckout" 
            class="rounded-xl bg-merchant-primary px-6 py-3 text-sm font-bold text-white shadow-lg shadow-merchant-primary/30"
          >
            Checkout
          </button>
          <div class="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <i class="pi" :class="isCartExpanded ? 'pi-chevron-down' : 'pi-chevron-up'" />
          </div>
        </div>
      </div>

      <div v-show="isCartExpanded" class="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50/50">
        <OrderCart class="h-full !rounded-none !border-none !shadow-none" @checkout="handleCheckout" />
      </div>
    </div>

    <VariantModal
      :show="showVariantModal"
      :product="selectedProduct"
      @close="showVariantModal = false"
      @add="handleVariantAdd"
    />

    <PaymentModal :show="showPaymentModal" @close="showPaymentModal = false" @paid="handlePaid" />

    <PaymentSuccess
      :show="showPaymentSuccess"
      :order-number="successPayload.orderNumber"
      :total="successPayload.total"
      :change-amount="successPayload.changeAmount"
      :payment-method="successPayload.paymentMethod"
      @done="handlePaymentDone"
    />

    <!-- Edit Success Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-200"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showEditSuccess"
          class="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
        >
          <div class="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl">
            <div
              class="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-amber-100"
              style="animation: pop 0.4s ease-out;"
            >
              <i class="pi pi-file-edit text-5xl text-amber-600" />
            </div>

            <h2 class="text-2xl font-black text-slate-900">Pengajuan Terkirim</h2>
            <p class="mt-2 text-sm text-slate-500 font-medium">
              Pengajuan pengeditan transaksi berhasil dikirim. Silakan hubungi admin untuk mendapatkan persetujuan.
            </p>

            <p class="mt-6 text-xs text-slate-400 font-bold">Mengalihkan ke riwayat...</p>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
@keyframes pop {
  0% { transform: scale(0.5); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
</style>
