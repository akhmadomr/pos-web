import { useAuthStore } from '@/stores/auth.store'
import { useRouter } from 'vue-router'

/**
 * Composable untuk aksi auth di component:
 * login, logout, redirect setelah login.
 */
export function useAuth() {
  const authStore = useAuthStore()
  const router = useRouter()

  async function login(email, password) {
    const user = await authStore.login(email, password)
    if (authStore.hasActiveShift) {
      router.push({ name: 'pos' })
    } else {
      router.push({ name: 'shift-open' })
    }
    return user
  }

  async function logout() {
    await authStore.logout()
    router.push({ name: 'login' })
  }

  return {
    authStore,
    login,
    logout,
  }
}
