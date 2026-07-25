import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import AuthLayout from '@/layouts/AuthLayout.vue'
import PosLayout from '@/layouts/PosLayout.vue'
import Login from '@/pages/auth/Login.vue'

const posRoles = ['cashier', 'admin', 'manager']

const routes = [
  { path: '/', redirect: '/pos' },
  {
    path: '/login',
    component: AuthLayout,
    meta: { guest: true },
    children: [
      {
        path: '',
        name: 'login',
        component: Login,
      },
    ],
  },
  {
    path: '/shift/open',
    name: 'shift-open',
    component: () => import('@/pages/shift/Open.vue'),
    meta: { requiresAuth: true, roles: posRoles },
  },
  {
    path: '/',
    component: PosLayout,
    meta: { requiresAuth: true, requiresShift: true, roles: posRoles },
    children: [
      {
        path: 'pos',
        name: 'pos',
        component: () => import('@/pages/pos/Index.vue'),
      },
      {
        path: 'pos/expenses',
        name: 'pos-expenses',
        component: () => import('@/pages/pos/Expenses.vue'),
      },
      {
        path: 'pos/history',
        name: 'pos-history',
        component: () => import('@/pages/pos/History.vue'),
      },
      {
        path: 'pos/shifts/history',
        name: 'pos-shift-history',
        component: () => import('@/pages/pos/ShiftHistory.vue'),
      },
      {
        path: 'pos/shifts/daily/:date',
        name: 'pos-shift-history-detail',
        component: () => import('@/pages/pos/ShiftHistoryDetail.vue'),
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

function resolvePostLoginRoute(authStore) {
  return authStore.hasActiveShift ? { name: 'pos' } : { name: 'shift-open' }
}

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  if (authStore.token && !authStore.user?.email) {
    await authStore.fetchUser()
  }

  if (authStore.isAuthenticated && to.meta.requiresAuth && !to.meta.guest) {
    if (!authStore.shift && !to.meta.skipShiftFetch) {
      await authStore.fetchCurrentShift()
    }
  }

  const isAuthenticated = authStore.isAuthenticated

  if (to.meta.requiresAuth && !isAuthenticated) {
    return { name: 'login' }
  }

  if (to.meta.guest && isAuthenticated) {
    return resolvePostLoginRoute(authStore)
  }

  const requiredRoles = to.matched
    .map((record) => record.meta.roles)
    .filter(Boolean)
    .flat()

  if (requiredRoles.length && authStore.user?.role && !requiredRoles.includes(authStore.user.role)) {
    return { name: 'login' }
  }

  if (to.meta.requiresShift && !authStore.hasActiveShift) {
    return { name: 'shift-open' }
  }

  if (to.name === 'shift-open' && authStore.hasActiveShift) {
    return { name: 'pos' }
  }

  return true
})

export default router
