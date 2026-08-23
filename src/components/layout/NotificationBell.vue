<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import client from '@/api/client'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/id'

dayjs.extend(relativeTime)
dayjs.locale('id')

const router = useRouter()
const authStore = useAuthStore()
const notifications = ref([])
const unreadCount = ref(0)
const isOpen = ref(false)
let pollInterval = null

const fetchNotifications = async () => {
  if (!authStore.isAuthenticated) return
  try {
    const res = await client.get('/notifications')
    if (res.data?.success) {
      notifications.value = res.data.data
      unreadCount.value = res.data.unread_count
    }
  } catch (error) {
    console.error('Failed to fetch notifications', error)
  }
}

const toggleBell = () => {
  isOpen.value = !isOpen.value
  if (isOpen.value && notifications.value.length === 0) {
    fetchNotifications()
  }
}

const markAsRead = async (id) => {
  try {
    await client.post(`/notifications/${id}/read`)
    fetchNotifications()
  } catch (error) {
    console.error(error)
  }
}

const markAllAsRead = async () => {
  try {
    await client.post('/notifications/read-all')
    fetchNotifications()
  } catch (error) {
    console.error(error)
  }
}

const handleAction = async (notif) => {
  if (!notif.read_at) {
    await markAsRead(notif.id)
  }
  isOpen.value = false
  if (notif.action_url) {
    router.push(notif.action_url)
  }
}

const getTypeColor = (type) => {
  switch (type) {
    case 'danger': return 'text-rose-500 bg-rose-50'
    case 'warning': return 'text-amber-500 bg-amber-50'
    case 'success': return 'text-emerald-500 bg-emerald-50'
    default: return 'text-blue-500 bg-blue-50'
  }
}

const getTypeIcon = (type) => {
  switch (type) {
    case 'danger': return 'pi-exclamation-circle'
    case 'warning': return 'pi-exclamation-triangle'
    case 'success': return 'pi-check-circle'
    default: return 'pi-info-circle'
  }
}

onMounted(() => {
  fetchNotifications()
  pollInterval = setInterval(fetchNotifications, 30000)
  
  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.notification-container')) {
      isOpen.value = false
    }
  })
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})
</script>

<template>
  <div class="relative notification-container">
    <button 
      @click="toggleBell"
      class="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 text-slate-500 transition-all duration-200 hover:bg-slate-100 hover:text-slate-700"
    >
      <i class="pi pi-bell text-lg" />
      <span 
        v-if="unreadCount > 0"
        class="absolute right-2 top-2 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-rose-500 ring-2 ring-white"
      />
    </button>

    <!-- Dropdown -->
    <div 
      v-if="isOpen"
      class="absolute right-0 top-[120%] z-50 w-80 sm:w-96 rounded-2xl border border-slate-100 bg-white shadow-2xl overflow-hidden"
    >
      <div class="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-4">
        <h3 class="font-bold text-slate-800">Notifikasi</h3>
        <button 
          v-if="unreadCount > 0"
          @click="markAllAsRead"
          class="text-xs font-semibold text-merchant-primary hover:text-merchant-secondary"
        >
          Tandai Semua Dibaca
        </button>
      </div>

      <div class="max-h-[400px] overflow-y-auto">
        <div v-if="notifications.length === 0" class="p-8 text-center text-sm text-slate-400">
          Belum ada notifikasi
        </div>

        <template v-else>
          <div 
            v-for="notif in notifications" 
            :key="notif.id"
            @click="handleAction(notif)"
            class="group flex cursor-pointer gap-3 border-b border-slate-50 p-4 transition-colors hover:bg-slate-50 relative"
            :class="{ 'bg-slate-50/30': !notif.read_at }"
          >
            <div 
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              :class="getTypeColor(notif.type)"
            >
              <i class="pi" :class="getTypeIcon(notif.type)" />
            </div>
            
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-slate-900" :class="{ 'text-slate-600': notif.read_at }">
                {{ notif.title }}
              </p>
              <p class="mt-0.5 text-xs text-slate-500 line-clamp-2">
                {{ notif.message }}
              </p>
              <p class="mt-1.5 text-[10px] font-medium text-slate-400">
                {{ dayjs(notif.created_at).fromNow() }}
              </p>
            </div>
            
            <div v-if="!notif.read_at" class="absolute right-4 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-merchant-primary" />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
