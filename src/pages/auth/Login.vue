<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppButton from '@/components/common/AppButton.vue'
import { useAuthStore } from '@/stores/auth.store'
import logoUrl from '@/assets/logo kopirex-01.png'

const router = useRouter()
const authStore = useAuthStore()

const showPassword = ref(false)
const error = ref('')

const form = reactive({
  email: '',
  password: '',
})

const handleLogin = async () => {
  error.value = ''
  try {
    await authStore.login(form.email, form.password)
    router.push(authStore.hasActiveShift ? { name: 'pos' } : { name: 'shift-open' })
  } catch (err) {
    error.value =
      err.message ||
      err.data?.message ||
      err.response?.data?.message ||
      'Email atau password salah.'
  }
}
</script>

<template>
  <div class="flex min-h-screen bg-white">
    <div class="relative hidden w-1/2 flex-col items-center justify-center overflow-hidden bg-white p-12 lg:flex">
      <div class="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-merchant-primary/5 blur-3xl" />
      <div class="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-merchant-primary/5 blur-3xl" />

      <div class="relative z-10 max-w-lg text-center">
        <div class="mb-8 flex items-center justify-center">
          <img :src="logoUrl" alt="Kopirex" class="h-28 w-auto drop-shadow-xl" />
        </div>
        <h1 class="mb-6 text-4xl font-black leading-tight tracking-tight text-slate-900">
          Point of Sale
          <br />
          <span class="text-merchant-primary italic">Kopirex.</span>
        </h1>
        <p class="text-lg text-slate-500">Kasir cepat, shift terkelola, siap offline saat koneksi terputus.</p>
      </div>
    </div>

    <div class="relative flex w-full items-center justify-center overflow-hidden bg-merchant-primary p-6 sm:p-12 lg:w-1/2">
      <div class="relative z-10 w-full max-w-md">
        <div class="mb-10 text-center lg:hidden">
          <div class="mb-4 flex items-center justify-center">
            <img :src="logoUrl" alt="Kopirex" class="h-16 w-auto" />
          </div>
          <h1 class="text-3xl font-black tracking-tight text-white">Kopirex POS</h1>
          <p class="mt-2 font-medium text-white/70">Masuk sebagai kasir</p>
        </div>

        <div class="mb-10 hidden text-white lg:block">
          <h2 class="text-4xl font-black tracking-tight">Masuk Kasir</h2>
          <p class="mt-3 text-lg font-medium text-white/70">Gunakan akun kasir atau manajer outlet</p>
        </div>

        <div class="rounded-[2.5rem] border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-2xl sm:p-12">
          <form class="space-y-8" @submit.prevent="handleLogin">
            <div class="space-y-2">
              <label class="ml-1 block text-[10px] font-black uppercase tracking-[0.2em] text-white/60">EMAIL</label>
              <div class="group relative">
                <i
                  class="pi pi-envelope absolute left-0 top-1/2 -translate-y-1/2 text-white/50 transition-colors group-focus-within:text-white"
                />
                <input
                  v-model="form.email"
                  type="email"
                  required
                  placeholder="cashier@kopirex.com"
                  class="w-full border-b-2 border-white/20 bg-transparent py-3 pl-8 font-bold text-white placeholder-white/30 transition-all focus:border-white focus:outline-none"
                />
              </div>
            </div>

            <div class="space-y-2">
              <label class="ml-1 block text-[10px] font-black uppercase tracking-[0.2em] text-white/60">PASSWORD</label>
              <div class="group relative">
                <i
                  class="pi pi-lock absolute left-0 top-1/2 -translate-y-1/2 text-white/50 transition-colors group-focus-within:text-white"
                />
                <input
                  v-model="form.password"
                  :type="showPassword ? 'text' : 'password'"
                  required
                  placeholder="••••••••"
                  class="w-full border-b-2 border-white/20 bg-transparent py-3 pl-8 pr-10 font-bold text-white placeholder-white/30 transition-all focus:border-white focus:outline-none"
                />
                <button
                  type="button"
                  class="absolute right-0 top-1/2 -translate-y-1/2 text-white/50 transition-colors hover:text-white"
                  @click="showPassword = !showPassword"
                >
                  <i :class="['pi', showPassword ? 'pi-eye-slash' : 'pi-eye']" />
                </button>
              </div>
            </div>

            <div
              v-if="error"
              class="flex animate-shake items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/20 p-4 text-xs font-bold text-white"
            >
              <i class="pi pi-exclamation-circle text-sm" />
              {{ error }}
            </div>

            <AppButton
              type="submit"
              :loading="authStore.isLoading"
              class="w-full !rounded-2xl !bg-white !py-4 !text-base !font-black !text-merchant-primary shadow-2xl hover:!bg-white/90"
            >
              <span v-if="!authStore.isLoading" class="flex items-center justify-center gap-2">
                MASUK KASIR
                <i class="pi pi-arrow-right text-xs" />
              </span>
              <span v-else>MEMPROSES...</span>
            </AppButton>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-4px);
  }
  75% {
    transform: translateX(4px);
  }
}
.animate-shake {
  animation: shake 0.2s ease-in-out 0s 2;
}
</style>
