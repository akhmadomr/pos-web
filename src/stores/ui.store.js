import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const sidebarOpen = ref(false)
  const toasts = ref([])

  let toastId = 0

  function toast(message, type = 'info', duration = 3500) {
    const id = ++toastId
    toasts.value.push({ id, message, type })
    setTimeout(() => dismiss(id), duration)
    return id
  }

  function dismiss(id) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function success(message, duration) {
    return toast(message, 'success', duration)
  }

  function error(message, duration) {
    return toast(message, 'error', duration)
  }

  function info(message, duration) {
    return toast(message, 'info', duration)
  }

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value
  }

  return {
    sidebarOpen,
    toasts,
    toast,
    dismiss,
    success,
    error,
    info,
    toggleSidebar,
  }
})
