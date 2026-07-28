import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as authApi from '@/api/auth'
import * as shiftsApi from '@/api/shifts'
import { db } from '@/utils/db'

const TOKEN_KEY = 'token'
const USER_KEY = 'user'
const SHIFT_KEY = 'shift'

const POS_ROLES = ['cashier', 'admin', 'manager']

function readJson(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref(readJson(USER_KEY))
  const token = ref(localStorage.getItem(TOKEN_KEY))
  const shift = ref(readJson(SHIFT_KEY))
  const isLoading = ref(false)
  const isShiftVerified = ref(false)

  const isAuthenticated = computed(() => Boolean(token.value))
  const hasActiveShift = computed(() => Boolean(shift.value && shift.value.status === 'open'))
  const cashierName = computed(() => user.value?.name ?? 'Kasir')
  const outletId = computed(() => shift.value?.outlet_id ?? user.value?.outlet_id ?? null)
  const outletName = computed(() => shift.value?.outlet?.name ?? user.value?.outlet?.name ?? 'Outlet')

  function setSession(newToken, newUser) {
    token.value = newToken
    user.value = newUser
    localStorage.setItem(TOKEN_KEY, newToken)
    localStorage.setItem(USER_KEY, JSON.stringify(newUser))
  }

  function setShift(newShift) {
    shift.value = newShift
    if (newShift) {
      localStorage.setItem(SHIFT_KEY, JSON.stringify(newShift))
    } else {
      localStorage.removeItem(SHIFT_KEY)
    }
  }

  function clearAuth() {
    user.value = null
    token.value = null
    shift.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(SHIFT_KEY)
  }

  function assertPosRole(role) {
    if (!POS_ROLES.includes(role)) {
      throw new Error('Akun ini tidak memiliki akses POS.')
    }
  }

  async function login(name, password) {
    isLoading.value = true
    try {
      const session = await authApi.loginRequest(name, password)
      assertPosRole(session.user.role)
      setSession(session.token, session.user)
      await fetchUser()
      await fetchCurrentShift()
      return user.value
    } finally {
      isLoading.value = false
    }
  }

  async function logout() {
    isLoading.value = true
    try {
      await authApi.logoutRequest()
    } catch {
      // ignore network errors on logout
    } finally {
      clearAuth()
      isLoading.value = false
    }
  }

  async function fetchUser() {
    if (!token.value) return null

    isLoading.value = true
    try {
      const me = await authApi.fetchMe()
      assertPosRole(me.role)
      user.value = me
      localStorage.setItem(USER_KEY, JSON.stringify(me))
      return me
    } catch {
      clearAuth()
      return null
    } finally {
      isLoading.value = false
    }
  }

  async function fetchCurrentShift() {
    if (!token.value) return null

    try {
      const current = await shiftsApi.fetchCurrentShift(user.value?.outlet_id ?? shift.value?.outlet_id)
      setShift(current)
      isShiftVerified.value = true

      // Saat online dan berhasil, update IndexedDB juga
      if (current?.id) {
        try {
          const localShift = {
            local_id: `server_${current.id}`,
            server_id: current.id,
            outlet_id: current.outlet_id,
            status: current.status ?? 'open',
            opening_cash: current.opening_cash,
            opened_at: current.opened_at,
            closed_at: current.closed_at ?? null,
            sync_status: 'synced',
          }
          await db.shifts.put(localShift)
        } catch { /* silent */ }
      }

      return current
    } catch (err) {
      // Saat offline/network error: jangan hapus shift, coba dari IndexedDB
      const isNetworkError = !navigator.onLine ||
        err?.message === 'Network Error' ||
        err?.name === 'TypeError' ||
        err?.code === 'ECONNABORTED'

      if (isNetworkError) {
        // Cek apakah ada shift aktif di memory/localStorage dulu
        const cached = shift.value
        if (cached && cached.status === 'open') {
          isShiftVerified.value = true
          return cached
        }

        // Cek IndexedDB
        try {
          const localShift = await db.shifts
            .where('status').equals('open')
            .first()
          if (localShift) {
            const offlineShift = {
              id: localShift.server_id ?? localShift.local_id,
              local_id: localShift.local_id,
              outlet_id: localShift.outlet_id,
              outlet: user.value?.outlet,
              status: 'open',
              opening_cash: localShift.opening_cash,
              opened_at: localShift.opened_at,
              is_offline: true,
            }
            setShift(offlineShift)
            isShiftVerified.value = true
            return offlineShift
          }
        } catch { /* silent */ }
        
        // Tidak ada shift di mana pun – tetap set verified agar tidak loop
        isShiftVerified.value = true
        return null
      }

      // Jika error bukan karena jaringan (misal 401), baru hapus shift
      setShift(null)
      isShiftVerified.value = true
      return null
    }
  }

  // Listen to cross-tab storage events
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key === SHIFT_KEY) {
        if (!event.newValue) {
          shift.value = null
          if (window.location.pathname !== '/shift/open' && window.location.pathname !== '/login') {
            window.location.href = '/shift/open'
          }
        } else {
          shift.value = JSON.parse(event.newValue)
        }
      }

      if (event.key === TOKEN_KEY) {
        if (!event.newValue) {
          user.value = null
          token.value = null
          shift.value = null
          if (window.location.pathname !== '/login') {
            window.location.href = '/login'
          }
        }
      }
    })
  }

  return {
    user,
    token,
    shift,
    isLoading,
    isShiftVerified,
    isAuthenticated,
    hasActiveShift,
    cashierName,
    outletId,
    outletName,
    login,
    logout,
    fetchUser,
    fetchCurrentShift,
    setShift,
    clearAuth,
  }
})
