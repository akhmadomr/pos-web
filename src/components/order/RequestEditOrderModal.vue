<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import AppModal from '@/components/common/AppModal.vue'
import { fetchOrder, requestEditOrder } from '@/api/orders'
import { fetchPosProducts } from '@/api/products'
import { formatRupiah } from '@/utils/currency'

const props = defineProps({
  orderId: { type: [Number, String], required: true }
})
const emit = defineEmits(['close', 'submitted'])

const order = ref(null)
const loading = ref(true)
const submitting = ref(false)
const reason = ref('')
const products = ref([])
const editItems = ref([])
const newProductQuery = ref('')

const loadData = async () => {
  try {
    const [orderData, productsData] = await Promise.all([
      fetchOrder(props.orderId),
      fetchPosProducts(localStorage.getItem('kopirex_active_outlet_id') || undefined)
    ])
    order.value = orderData
    products.value = productsData
    
    // Initialize edit array
    editItems.value = orderData.order_items.map(item => ({
      id: item.id,
      product_id: item.product_id,
      product_name: item.product_name,
      variant_label: item.variant_label,
      quantity: item.quantity,
      unit_price: item.unit_price,
      notes: item.notes || '',
      addons_price: item.addons_price || 0,
      addons_label: item.addons_label || '',
      is_new: false,
      deleted: false
    }))
  } catch (e) {
    alert('Gagal memuat detail pesanan')
    emit('close')
  } finally {
    loading.value = false
  }
}

onMounted(loadData)

const addProduct = (prod) => {
  editItems.value.push({
    id: 'new-' + Date.now(),
    product_id: prod.id,
    product_name: prod.name,
    variant_label: null,
    quantity: 1,
    unit_price: prod.price,
    notes: '',
    addons_price: 0,
    addons_label: '',
    is_new: true,
    deleted: false
  })
  newProductQuery.value = ''
}

const toggleDelete = (idx) => {
  editItems.value[idx].deleted = !editItems.value[idx].deleted
}

const activeItems = computed(() => editItems.value.filter(i => !i.deleted))

const filteredProducts = computed(() => {
  if (!newProductQuery.value) return []
  const q = newProductQuery.value.toLowerCase()
  return products.value.filter(p => p.name.toLowerCase().includes(q)).slice(0, 5)
})

const totalAmount = computed(() => {
  return activeItems.value.reduce((sum, item) => {
    return sum + (Number(item.quantity) * (Number(item.unit_price) + Number(item.addons_price)))
  }, 0) - (order.value?.discount_amount || 0) + (order.value?.tax_amount || 0)
})

const submit = async () => {
  if (!reason.value) return alert('Alasan wajib diisi')
  if (activeItems.value.length === 0) return alert('Pesanan minimal harus memiliki 1 item aktif')

  const payload = {
    amount: totalAmount.value,
    items: activeItems.value.map(i => ({
      id: i.is_new ? null : i.id,
      product_id: i.product_id,
      quantity: i.quantity,
      unit_price: i.unit_price,
      addons_price: i.addons_price,
      addons_label: i.addons_label,
      notes: i.notes,
      variant_label: i.variant_label
    }))
  }

  submitting.value = true
  try {
    await requestEditOrder(props.orderId, { reason: reason.value, edit_payload: payload })
    alert('Permintaan edit berhasil diajukan')
    emit('submitted')
  } catch(e) {
    alert(e.response?.data?.message || 'Gagal mengajukan edit')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AppModal :show="true" title="Pengajuan Edit Pesanan" size="lg" @close="$emit('close')">
    <div v-if="loading" class="flex justify-center p-12"><i class="pi pi-spin pi-spinner text-2xl text-merchant-primary"></i></div>
    <div v-else class="flex flex-col h-[70vh]">
      <div class="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar space-y-6">
        
        <div class="rounded-lg bg-amber-50 p-4 border border-amber-200">
          <p class="text-sm text-amber-800">Anda mengajukan perubahan data pesanan <strong>{{ order.order_number }}</strong>. Admin perlu menyetujui perubahan ini sebelum transaksi dan stok diperbarui.</p>
        </div>

        <div>
          <label class="text-xs font-bold text-slate-700 uppercase">Alasan Edit <span class="text-rose-500">*</span></label>
          <textarea v-model="reason" rows="2" class="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-merchant-primary focus:ring-1 focus:ring-merchant-primary outline-none transition" placeholder="Contoh: Pembeli minta tambah gula / ganti menu"></textarea>
        </div>

        <div class="space-y-3">
          <label class="text-xs font-bold text-slate-700 uppercase">Daftar Item</label>
          <div v-for="(item, idx) in editItems" :key="item.id" class="p-3 border rounded-xl" :class="item.deleted ? 'bg-slate-50 border-slate-200 opacity-60' : (item.is_new ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-white')">
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1">
                <p class="font-bold text-sm" :class="item.deleted ? 'line-through text-slate-400' : 'text-slate-900'">{{ item.product_name }}</p>
                <p v-if="item.variant_label" class="text-[10px] text-slate-500">{{ item.variant_label }}</p>
                <div v-if="!item.deleted" class="mt-3 flex items-center gap-3">
                  <div class="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                    <button type="button" @click="item.quantity > 1 ? item.quantity-- : null" class="flex h-6 w-6 items-center justify-center rounded-md bg-white shadow-sm font-black">-</button>
                    <span class="w-8 text-center text-xs font-bold">{{ item.quantity }}</span>
                    <button type="button" @click="item.quantity++" class="flex h-6 w-6 items-center justify-center rounded-md bg-white shadow-sm font-black">+</button>
                  </div>
                  <input v-model="item.notes" placeholder="Catatan..." class="flex-1 text-xs px-2 py-1 border rounded bg-slate-50 outline-none" />
                </div>
              </div>
              <div class="text-right flex flex-col items-end gap-2">
                <p class="font-bold text-sm" :class="item.deleted ? 'line-through text-slate-400' : 'text-slate-900'">{{ formatRupiah((item.unit_price + item.addons_price) * item.quantity) }}</p>
                <button type="button" @click="toggleDelete(idx)" class="text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider" :class="item.deleted ? 'bg-slate-200 text-slate-600' : 'bg-rose-100 text-rose-600'">
                  {{ item.deleted ? 'Batal Hapus' : 'Hapus' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Add Item -->
          <div class="relative mt-2">
            <input v-model="newProductQuery" type="text" placeholder="Ketik untuk menambah produk..." class="w-full text-sm border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-merchant-primary" />
            <div v-if="filteredProducts.length" class="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-auto">
              <button type="button" v-for="p in filteredProducts" :key="p.id" @click="addProduct(p)" class="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0 font-medium text-slate-700">
                {{ p.name }} <span class="text-slate-400 text-xs ml-2">{{ formatRupiah(p.price) }}</span>
              </button>
            </div>
          </div>
        </div>

      </div>
      <div class="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
        <div>
          <p class="text-[10px] uppercase font-bold text-slate-500">Total Baru</p>
          <p class="text-lg font-black text-merchant-primary">{{ formatRupiah(totalAmount) }}</p>
        </div>
        <div class="flex gap-2">
          <button @click="$emit('close')" class="px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">Batal</button>
          <button @click="submit" :disabled="submitting || !reason" class="px-4 py-2 rounded-xl bg-merchant-primary text-sm font-bold text-white hover:bg-merchant-secondary disabled:opacity-50 flex items-center gap-2">
            <i v-if="submitting" class="pi pi-spin pi-spinner"></i> Ajukan Edit
          </button>
        </div>
      </div>
    </div>
  </AppModal>
</template>
