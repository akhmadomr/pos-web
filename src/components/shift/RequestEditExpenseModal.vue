<script setup>
import { ref, onMounted, computed } from 'vue'
import AppModal from '@/components/common/AppModal.vue'
import AppCreatableSelect from '@/components/common/AppCreatableSelect.vue'
import { requestEditExpense, fetchExpenseCategories } from '@/api/shifts'
import { formatRupiah } from '@/utils/currency'

const props = defineProps({
  expense: { type: Object, required: true }
})
const emit = defineEmits(['close', 'submitted'])

const formatInputRupiah = (val) => {
  const num = String(val).replace(/\D/g, '')
  return num ? parseInt(num, 10).toLocaleString('id-ID') : ''
}

const submitting = ref(false)
const reason = ref('')
const priceMode = ref('total') // 'unit' | 'total'

const initialAmount = Math.round(Number(props.expense.amount) || 0)
const initialQty = Number(props.expense.qty) || 1
const initialUnitPrice = Math.round(Number(props.expense.price_per_item) || (initialAmount / initialQty))

const form = ref({
  category: props.expense.category,
  qty: initialQty,
  price_per_item: formatInputRupiah(initialUnitPrice),
  amount: formatInputRupiah(initialAmount),
  notes: props.expense.notes || ''
})

const categories = ref([])

onMounted(async () => {
  try {
    const data = await fetchExpenseCategories()
    categories.value = data.map(c => ({ label: c.name ?? c, value: c.name ?? c }))
    if (!categories.value.find(c => c.value === props.expense.category)) {
      categories.value.push({ label: props.expense.category, value: props.expense.category })
    }
  } catch(e) {}
})

const setPriceMode = (mode) => {
  if (priceMode.value === mode) return
  const qty = Number(form.value.qty) || 1
  if (mode === 'total') {
    const price = Number(String(form.value.price_per_item).replace(/\D/g, '')) || 0
    if (price > 0) {
      form.value.amount = formatInputRupiah(Math.round(price * qty))
    }
  } else {
    const total = Number(String(form.value.amount).replace(/\D/g, '')) || 0
    if (total > 0 && qty > 0) {
      form.value.price_per_item = formatInputRupiah(Math.round(total / qty))
    }
  }
  priceMode.value = mode
}

const amountPreview = computed(() => {
  const qty = Number(form.value.qty) || 0
  if (priceMode.value === 'unit') {
    const price = Number(String(form.value.price_per_item).replace(/\D/g, '')) || 0
    return qty * price
  } else {
    return Number(String(form.value.amount).replace(/\D/g, '')) || 0
  }
})

const unitPricePreview = computed(() => {
  const qty = Number(form.value.qty) || 0
  if (priceMode.value === 'unit') {
    return Number(String(form.value.price_per_item).replace(/\D/g, '')) || 0
  } else {
    const total = Number(String(form.value.amount).replace(/\D/g, '')) || 0
    return qty > 0 ? Math.round(total / qty) : total
  }
})

const submit = async () => {
  if (!reason.value) return alert('Alasan wajib diisi')
  const qty = Number(form.value.qty) || 0
  const amount = amountPreview.value
  const price_per_item = unitPricePreview.value

  if (amount <= 0 || qty <= 0 || !form.value.category) return alert('Data tidak valid')

  const payload = {
    category: form.value.category,
    type: props.expense.type,
    qty: qty,
    amount: amount,
    price_per_item: price_per_item,
    notes: form.value.notes ? form.value.notes.trim() : null
  }

  submitting.value = true
  try {
    await requestEditExpense(props.expense.id, { reason: reason.value, edit_payload: payload })
    alert('Permintaan edit pengeluaran berhasil diajukan')
    emit('submitted')
  } catch(e) {
    alert(e.response?.data?.message || 'Gagal mengajukan edit')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AppModal :show="true" title="Pengajuan Edit Pengeluaran" size="md" @close="$emit('close')">
    <div class="p-4 md:p-6 space-y-4">
      <div class="rounded-lg bg-amber-50 p-4 border border-amber-200">
        <p class="text-sm text-amber-800">Anda mengajukan perubahan data pengeluaran shift ini. Admin perlu menyetujui perubahan ini.</p>
      </div>

      <div class="space-y-1.5">
        <label class="text-xs font-bold text-slate-700 uppercase">Alasan Edit <span class="text-rose-500">*</span></label>
        <textarea v-model="reason" rows="2" class="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-merchant-primary focus:ring-1 focus:ring-merchant-primary outline-none transition" placeholder="Contoh: Salah input nominal"></textarea>
      </div>

      <div class="space-y-1.5">
        <label class="text-xs font-bold text-slate-700 uppercase">Kategori / Keterangan <span class="text-rose-500">*</span></label>
        <AppCreatableSelect
          v-model="form.category"
          :options="categories"
          placeholder="Pilih atau ketik kategori..."
        />
      </div>

      <!-- Mode Selector -->
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label class="text-xs font-bold uppercase tracking-wider text-slate-500">Metode Input Harga</label>
          <div class="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200/60">
            <button
              type="button"
              @click="setPriceMode('unit')"
              class="rounded-md px-2.5 py-1 text-xs font-bold transition flex items-center gap-1"
              :class="priceMode === 'unit' ? 'bg-white text-merchant-primary shadow-sm' : 'text-slate-500 hover:text-slate-800'"
            >
              <i class="pi pi-tag text-[10px]" />
              <span>Harga Satuan</span>
            </button>
            <button
              type="button"
              @click="setPriceMode('total')"
              class="rounded-md px-2.5 py-1 text-xs font-bold transition flex items-center gap-1"
              :class="priceMode === 'total' ? 'bg-white text-merchant-primary shadow-sm' : 'text-slate-500 hover:text-slate-800'"
            >
              <i class="pi pi-calculator text-[10px]" />
              <span>Harga Total</span>
            </button>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-12 gap-3">
        <div class="col-span-4">
          <label class="text-xs font-bold text-slate-700 uppercase mb-1 block">Kuantitas <span class="text-rose-500">*</span></label>
          <input v-model="form.qty" type="number" step="any" min="0.01" class="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-center text-sm font-semibold focus:border-merchant-primary outline-none" required />
        </div>
        <div class="col-span-8">
          <label class="text-xs font-bold text-slate-700 uppercase mb-1 block">
            {{ priceMode === 'unit' ? 'Harga Satuan Baru (Rp)' : 'Harga Total Baru (Rp)' }} <span class="text-rose-500">*</span>
          </label>
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">Rp</span>
            <input
              v-if="priceMode === 'unit'"
              v-model="form.price_per_item"
              type="text"
              class="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm font-semibold focus:border-merchant-primary outline-none"
              placeholder="0"
              @input="form.price_per_item = formatInputRupiah($event.target.value)"
              required
            />
            <input
              v-else
              v-model="form.amount"
              type="text"
              class="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm font-semibold focus:border-merchant-primary outline-none"
              placeholder="0"
              @input="form.amount = formatInputRupiah($event.target.value)"
              required
            />
          </div>
        </div>
      </div>

      <div class="space-y-1.5">
        <label class="text-xs font-bold text-slate-700 uppercase">Keterangan / Catatan (Opsional)</label>
        <input v-model="form.notes" type="text" class="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-merchant-primary outline-none" placeholder="Contoh: Koreksi rincian belanja..." />
      </div>

      <div class="rounded-xl bg-slate-50 p-3 border border-slate-100 flex items-center justify-between">
        <div>
          <span class="text-xs font-bold text-slate-500 block">Total Pengeluaran Baru</span>
          <span v-if="priceMode === 'total' && Number(form.qty) > 0" class="text-xs text-slate-400 font-medium">
            Estimasi Satuan: {{ formatRupiah(unitPricePreview) }}
          </span>
          <span v-else-if="priceMode === 'unit' && Number(form.qty) > 0" class="text-xs text-slate-400 font-medium">
            {{ form.qty }} x {{ formatRupiah(unitPricePreview) }}
          </span>
        </div>
        <span class="text-base font-black text-merchant-primary">{{ formatRupiah(amountPreview) }}</span>
      </div>

      <div class="flex gap-3 pt-2 border-t border-slate-100 mt-4">
        <button @click="$emit('close')" class="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-600 hover:bg-slate-200 transition">Batal</button>
        <button @click="submit" :disabled="!reason || submitting || amountPreview <= 0" class="flex-1 rounded-xl bg-merchant-primary py-3 text-sm font-bold text-white hover:bg-merchant-secondary transition disabled:opacity-50 flex items-center justify-center gap-2">
          <i v-if="submitting" class="pi pi-spin pi-spinner"></i> Ajukan Edit
        </button>
      </div>
    </div>
  </AppModal>
</template>
