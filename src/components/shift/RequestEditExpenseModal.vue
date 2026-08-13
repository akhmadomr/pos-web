<script setup>
import { ref } from 'vue'
import AppModal from '@/components/common/AppModal.vue'
import { requestEditExpense } from '@/api/shifts'
import { formatRupiah } from '@/utils/currency'

const props = defineProps({
  expense: { type: Object, required: true }
})
const emit = defineEmits(['close', 'submitted'])

const submitting = ref(false)
const reason = ref('')
const form = ref({
  category: props.expense.category,
  qty: props.expense.qty,
  amount: props.expense.amount
})

const handleAmountInput = (e) => {
  let val = e.target.value.replace(/[^0-9]/g, '')
  if (!val) {
    form.value.amount = 0
    return
  }
  form.value.amount = Number(val)
}

const submit = async () => {
  if (!reason.value) return alert('Alasan wajib diisi')
  if (form.value.amount <= 0 || form.value.qty <= 0 || !form.value.category) return alert('Data tidak valid')

  const payload = {
    category: form.value.category,
    qty: Number(form.value.qty),
    amount: Number(form.value.amount),
    price_per_item: Number(form.value.amount) / Number(form.value.qty)
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
        <input v-model="form.category" type="text" class="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-merchant-primary outline-none" required />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-1.5">
          <label class="text-xs font-bold text-slate-700 uppercase">Kuantitas <span class="text-rose-500">*</span></label>
          <input v-model="form.qty" type="number" step="0.1" class="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-merchant-primary outline-none" required />
        </div>
        <div class="space-y-1.5">
          <label class="text-xs font-bold text-slate-700 uppercase">Total (Rp) <span class="text-rose-500">*</span></label>
          <input :value="form.amount" @input="handleAmountInput" type="text" inputmode="numeric" class="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-merchant-primary outline-none" required />
        </div>
      </div>

      <div class="flex gap-3 pt-2 border-t border-slate-100 mt-4">
        <button @click="$emit('close')" class="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-600 hover:bg-slate-200 transition">Batal</button>
        <button @click="submit" :disabled="!reason || submitting" class="flex-1 rounded-xl bg-merchant-primary py-3 text-sm font-bold text-white hover:bg-merchant-secondary transition disabled:opacity-50 flex items-center justify-center gap-2">
          <i v-if="submitting" class="pi pi-spin pi-spinner"></i> Ajukan Edit
        </button>
      </div>
    </div>
  </AppModal>
</template>
