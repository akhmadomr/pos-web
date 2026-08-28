import { defineStore } from 'pinia'
import { ref } from 'vue'
import client from '@/api/client'

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref([])
  const unreadCount = ref(0)
  
  const fetchNotifications = async () => {
    try {
      const res = await client.get('/auth/notifications', { params: { limit: 10 } })
      if (res.data?.success) {
        notifications.value = res.data.data.notifications || []
        unreadCount.value = res.data.data.unread_count || 0
      }
    } catch (error) {
      console.error('Failed to fetch notifications', error)
    }
  }

  const markAsRead = async (id) => {
    try {
      await client.post(`/auth/notifications/${id}/read`)
      await fetchNotifications()
    } catch (error) {
      console.error(error)
    }
  }

  const markAllAsRead = async () => {
    try {
      await client.post('/auth/notifications/read-all')
      await fetchNotifications()
    } catch (error) {
      console.error(error)
    }
  }

  return {
    notifications,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead
  }
})
