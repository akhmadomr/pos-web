<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const deferredPrompt = ref(null)
const showPrompt = ref(false)

const handleBeforeInstallPrompt = (e) => {
  e.preventDefault()
  deferredPrompt.value = e
  showPrompt.value = true
}

const handleAppInstalled = () => {
  showPrompt.value = false
  deferredPrompt.value = null
}

onMounted(() => {
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  window.addEventListener('appinstalled', handleAppInstalled)
})

onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  window.removeEventListener('appinstalled', handleAppInstalled)
})

const install = async () => {
  if (!deferredPrompt.value) return
  
  deferredPrompt.value.prompt()
  const { outcome } = await deferredPrompt.value.userChoice
  
  if (outcome === 'accepted') {
    showPrompt.value = false
  }
  deferredPrompt.value = null
}

const dismiss = () => {
  showPrompt.value = false
}
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="translate-y-10 opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-10 opacity-0"
  >
    <div
      v-if="showPrompt"
      class="fixed bottom-4 left-4 right-4 z-[9999] sm:bottom-6 sm:left-auto sm:right-6 sm:w-96"
    >
      <div class="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div class="flex items-start justify-between gap-3">
          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-merchant-primary/10 text-merchant-primary">
            <i class="pi pi-download text-xl" />
          </div>
          <div class="flex-1">
            <h3 class="font-bold text-slate-900">Install Aplikasi POS</h3>
            <p class="mt-1 text-xs text-slate-500">Install Kasir Kopirex ke layar utama Anda agar bisa diakses secara offline dan lebih cepat!</p>
          </div>
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
            @click="dismiss"
          >
            <i class="pi pi-times text-sm" />
          </button>
        </div>
        <button
          type="button"
          class="w-full rounded-xl bg-merchant-primary px-4 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-merchant-primary/90"
          @click="install"
        >
          Install Sekarang
        </button>
      </div>
    </div>
  </Transition>
</template>
