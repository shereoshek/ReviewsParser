<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api/axios'

const router = useRouter()

const email = ref('')
const password = ref('')

const loading = ref(false)
const error = ref('')

const login = async () => {
  error.value = ''
  loading.value = true

  try {
    const response = await api.post('/login', {
      email: email.value,
      password: password.value,
    })

    localStorage.setItem('token', response.data.token)

    router.push('/organizations')
  } catch (err) {
    if (err.response?.status === 422) {
      error.value = 'Проверьте правильность введённых данных.'
    } else if (err.response?.status === 401) {
      error.value = 'Неверный email или пароль.'
    } else {
      error.value = 'Не удалось выполнить вход. Попробуйте ещё раз.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-card">
      <h1>Yandex Reviews Parser</h1>

      <p class="subtitle">
        Войдите, чтобы продолжить
      </p>

      <form @submit.prevent="login">
        <div class="form-group">
          <label for="email">Email</label>

          <input
            id="email"
            v-model="email"
            type="email"
            placeholder="Введите email"
            autocomplete="email"
            required
          />
        </div>

        <div class="form-group">
          <label for="password">Пароль</label>

          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="Введите пароль"
            autocomplete="current-password"
            required
          />
        </div>

        <p v-if="error" class="error">
          {{ error }}
        </p>

        <button
          class="primary-button"
          type="submit"
          :disabled="loading"
        >
          {{ loading ? 'Выполняется вход...' : 'Войти' }}
        </button>
      </form>
    </section>
  </main>
</template>