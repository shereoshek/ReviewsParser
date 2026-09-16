<script setup>
import { useRouter } from 'vue-router'
import api from './api/axios'

const router = useRouter()

const logout = async () => {
  try {
    await api.post('/logout')
  } catch (error) {
    // Локальная сессия всё равно должна быть очищена.
  } finally {
    localStorage.removeItem('token')
    router.push('/login')
  }
}
</script>

<template>
  <div class="app">
    <header
      v-if="router.currentRoute.value.meta.requiresAuth"
      class="header"
    >
      <div class="header-inner">
        <button
          class="logo"
          type="button"
          @click="router.push('/organizations')"
        >
          Yandex Reviews Parser
        </button>

        <button
          class="logout-button"
          type="button"
          @click="logout"
        >
          Выйти
        </button>
      </div>
    </header>

    <RouterView />
  </div>
</template>