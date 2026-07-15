import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as authApi from '@/api/auth'
import * as shiftsApi from '@/api/shifts'

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
      return current
    } catch {
      setShift(null)
      return null
    }
  }

  return {
    user,
    token,
    shift,
    isLoading,
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
