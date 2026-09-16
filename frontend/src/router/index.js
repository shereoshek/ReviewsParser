import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),

  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: {
        guest: true,
      },
    },
    {
      path: '/organizations',
      name: 'organizations',
      component: () => import('../views/OrganizationsView.vue'),
      meta: {
        requiresAuth: true,
      },
    },
    {
      path: '/organizations/:id',
      name: 'organization',
      component: () => import('../views/OrganizationView.vue'),
      meta: {
        requiresAuth: true,
      },
    },
    {
      path: '/',
      redirect: '/organizations',
    },
  ],
})

router.beforeEach((to) => {
  const token = localStorage.getItem('token')

  if (to.meta.requiresAuth && !token) {
    return {
      name: 'login',
    }
  }

  if (to.meta.guest && token) {
    return {
      name: 'organizations',
    }
  }
})

export default router