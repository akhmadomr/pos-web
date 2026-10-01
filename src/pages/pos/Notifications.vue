<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationStore } from '@/stores/notification.store'
import NotificationDetailModal from '@/components/layout/NotificationDetailModal.vue'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/id'

dayjs.extend(relativeTime)
dayjs.locale('id')

const router = useRouter()
const notifStore = useNotificationStore()

const selectedNotification = ref(null)
const showDetailModal = ref(false)

const handleAction = async (notif) => {
  if (!notif.read_at) {
    await notifStore.markAsRead(notif.id)
  }
  
  if (notif.action_url && notif.action_url.startsWith('/pos/')) {
    router.push(notif.action_url)
  } else {
    selectedNotification.value = notif
    showDetailModal.value = true
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
  notifStore.fetchNotifications()
})
</script>

<template>
  <div class="mx-auto w-full max-w-4xl pt-4">
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-base font-black text-slate-800">Semua Notifikasi</h1>
      <button 
        v-if="notifStore.unreadCount > 0"
        @click="notifStore.markAllAsRead()"
        class="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-merchant-primary"
      >
        <i class="pi pi-check-circle" /> Tandai Semua Dibaca
      </button>
    </div>

    <div class="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div v-if="notifStore.notifications.length === 0" class="p-12 text-center text-slate-400">
        <i class="pi pi-bell text-4xl mb-4" />
        <p>Belum ada notifikasi</p>
      </div>

      <template v-else>
        <div 
          v-for="notif in notifStore.notifications" 
          :key="notif.id"
          @click="handleAction(notif)"
          class="group flex cursor-pointer gap-4 border-b border-slate-100 p-4 transition-colors hover:bg-slate-50 relative"
          :class="{ 'bg-slate-50/50': !notif.read_at }"
        >
          <div 
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
            :class="getTypeColor(notif.type)"
          >
            <i class="pi text-xl" :class="getTypeIcon(notif.type)" />
          </div>
          
          <div class="flex-1 min-w-0">
            <p class="text-xs font-bold text-slate-900" :class="{ 'text-slate-600': notif.read_at }">
              {{ notif.title }}
            </p>
            <p class="mt-0.5 text-[10px] text-slate-500">
              {{ notif.message }}
            </p>
            <p class="mt-1 text-[9px] font-medium text-slate-400">
              {{ dayjs(notif.created_at).fromNow() }}
            </p>
          </div>
          
          <div v-if="!notif.read_at" class="absolute right-6 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-merchant-primary" />
        </div>
      </template>
    </div>

    <NotificationDetailModal 
      :show="showDetailModal" 
      :notification="selectedNotification" 
      @close="showDetailModal = false" 
    />
  </div>
</template>
