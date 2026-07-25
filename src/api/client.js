import axios from 'axios'

const TOKEN_KEY = 'token'

function withOfflineStore(callback) {
  import('@/stores/offline.store').then(({ useOfflineStore }) => {
    callback(useOfflineStore())
  })
}

console.log('ENV:', import.meta.env.VITE_API_URL)

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

console.log('BASE URL:', client.defaults.baseURL)

client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  (response) => {
    withOfflineStore((offlineStore) => {
      if (offlineStore.isOffline) {
        offlineStore.setOffline(false)
      }
    })
    return response
  },
  (error) => {
    if (!error.response) {
      withOfflineStore((offlineStore) => offlineStore.setOffline(true))
    }

    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem('user')
      localStorage.removeItem('shift')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    if (error.response?.status === 422) {
      const errors = error.response.data?.errors || {}
      if (errors.shift_id) {
        const shiftErrors = errors.shift_id.join(' ').toLowerCase()
        if (shiftErrors.includes('sudah ditutup') || shiftErrors.includes('tidak ditemukan') || shiftErrors.includes('bukan milik kasir')) {
          localStorage.removeItem('shift')
          import('@/stores/auth.store').then(({ useAuthStore }) => {
            const authStore = useAuthStore()
            authStore.shift = null
            if (window.location.pathname !== '/pos/shift/open') {
              window.location.href = '/pos/shift/open'
            }
          })
        }
      }
      return Promise.reject(error.response)
    }

    return Promise.reject(error)
  },
)

export default client
