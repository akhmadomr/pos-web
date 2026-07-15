<script setup>
import { ref, watch } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import { useAuthStore } from '@/stores/auth.store'
import client from '@/api/client'

const props = defineProps({
  show: Boolean,
})

const emit = defineEmits(['close'])

const authStore = useAuthStore()

const loading = ref(false)
const error = ref('')
const success = ref('')

const form = ref({
  name: '',
  phone: '',
  password: '',
  password_confirmation: '',
})

watch(
  () => props.show,
  (val) => {
    if (val) {
      form.value.name = authStore.user?.name || ''
      form.value.phone = authStore.user?.phone || ''
      form.value.password = ''
      form.value.password_confirmation = ''
      error.value = ''
      success.value = ''
    }
  },
)

const handleSave = async () => {
  error.value = ''
  success.value = ''
  loading.value = true
  try {
    const payload = {
      name: form.value.name,
      phone: form.value.phone,
    }
    if (form.value.password) {
      if (form.value.password !== form.value.password_confirmation) {
        throw new Error('Konfirmasi password tidak cocok.')
      }
      payload.password = form.value.password
      payload.password_confirmation = form.value.password_confirmation
    }

    // Ideally, there should be an endpoint like PUT /auth/profile
    // Since we don't have it defined right now, let's just make a mock request or call it
    await client.put('/auth/profile', payload)

    // Update local user data
    await authStore.fetchUser()
    
    success.value = 'Profil berhasil diperbarui.'
    
    setTimeout(() => {
      emit('close')
    }, 1500)
  } catch (err) {
    if (err.response?.status === 422 && err.response?.data?.errors) {
      const errors = err.response.data.errors
      error.value = Object.values(errors)[0][0]
    } else {
      error.value = err.message || err.response?.data?.message || 'Terjadi kesalahan saat menyimpan profil.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-0">
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" @click="emit('close')" />
    
    <div class="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div class="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <h3 class="text-lg font-black text-slate-900">Edit Profil</h3>
        <button
          class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
          @click="emit('close')"
        >
          <i class="pi pi-times" />
        </button>
      </div>

      <div class="p-6">
        <div v-if="error" class="mb-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-600">
          {{ error }}
        </div>
        <div v-if="success" class="mb-4 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-600">
          {{ success }}
        </div>

        <form @submit.prevent="handleSave" class="space-y-4">
          <div>
            <label class="mb-1 block text-xs font-bold text-slate-500">Nama (Username)</label>
            <input
              v-model="form.name"
              type="text"
              required
              class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-900 focus:border-merchant-primary focus:outline-none focus:ring-1 focus:ring-merchant-primary"
            />
          </div>
          <div>
            <label class="mb-1 block text-xs font-bold text-slate-500">Nomor Telepon</label>
            <input
              v-model="form.phone"
              type="text"
              class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-900 focus:border-merchant-primary focus:outline-none focus:ring-1 focus:ring-merchant-primary"
            />
          </div>
          <div class="pt-2">
            <p class="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Ganti Password (Opsional)</p>
          </div>
          <div>
            <label class="mb-1 block text-xs font-bold text-slate-500">Password Baru</label>
            <input
              v-model="form.password"
              type="password"
              class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-900 focus:border-merchant-primary focus:outline-none focus:ring-1 focus:ring-merchant-primary"
            />
          </div>
          <div>
            <label class="mb-1 block text-xs font-bold text-slate-500">Konfirmasi Password Baru</label>
            <input
              v-model="form.password_confirmation"
              type="password"
              class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-900 focus:border-merchant-primary focus:outline-none focus:ring-1 focus:ring-merchant-primary"
            />
          </div>
          <div class="pt-4">
            <AppButton type="submit" :loading="loading" class="w-full py-3">
              Simpan Perubahan
            </AppButton>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
