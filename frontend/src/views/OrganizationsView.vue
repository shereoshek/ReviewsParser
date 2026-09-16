<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api/axios'

const router = useRouter()

const organizations = ref([])
const parsingRequests = ref([])

const url = ref('')
const loading = ref(false)
const error = ref('')

const statusIntervals = new Map()

const loadOrganizations = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await api.get('/organizations')

    organizations.value = response.data.data
  } catch (err) {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      router.push('/login')
      return
    }

    error.value = 'Не удалось загрузить историю.'
  } finally {
    loading.value = false
  }
}

const startParsing = async () => {
  error.value = ''

  if (!url.value.trim()) {
    error.value = 'Введите URL организации.'
    return
  }

  const parsingUrl = url.value.trim()

  try {
    const response = await api.post('/organizations/parse', {
      url: parsingUrl,
    })

    const parsingRequest = {
      id: response.data.parsing_request_id,
      url: parsingUrl,
      status: 'pending',
      progress: 0,
      error: null,
      organizationId: null,
    }

    parsingRequests.value.unshift(parsingRequest)

    url.value = ''

    startStatusPolling(parsingRequest.id)
  } catch (err) {
    if (err.response?.status === 422) {
      error.value = 'Введите корректный URL Yandex Maps.'
    } else if (err.response?.status === 401) {
      localStorage.removeItem('token')
      router.push('/login')
    } else {
      error.value = 'Не удалось запустить парсинг.'
    }
  }
}

const getParsingRequest = (id) => {
  return parsingRequests.value.find(
    (parsingRequest) => parsingRequest.id === id
  )
}

const checkParsingStatus = async (id) => {
  const parsingRequest = getParsingRequest(id)

  if (!parsingRequest) {
    stopStatusPolling(id)
    return
  }

  try {
    const response = await api.get(`/parsing-requests/${id}`)

    const data = response.data.data

    parsingRequest.status = data.status
    parsingRequest.progress = data.progress
    parsingRequest.error = data.error
    parsingRequest.organizationId = data.organization_id

    if (data.status === 'completed') {
      stopStatusPolling(id)

      await loadOrganizations()
    }

    if (data.status === 'failed') {
      stopStatusPolling(id)
    }
  } catch (err) {
    stopStatusPolling(id)

    parsingRequest.status = 'failed'
    parsingRequest.error = 'Не удалось получить статус парсинга.'
  }
}

const startStatusPolling = (id) => {
  stopStatusPolling(id)

  checkParsingStatus(id)

  const interval = setInterval(() => {
    checkParsingStatus(id)
  }, 2000)

  statusIntervals.set(id, interval)
}

const stopStatusPolling = (id) => {
  const interval = statusIntervals.get(id)

  if (interval) {
    clearInterval(interval)
    statusIntervals.delete(id)
  }
}

const getStatusClass = (status) => {
  return {
    pending: 'status-pending',
    processing: 'status-processing',
    completed: 'status-completed',
    failed: 'status-failed',
  }[status]
}

const getStatusLabel = (status) => {
  return {
    pending: 'В очереди',
    processing: 'Выполняется',
    completed: 'Завершено',
    failed: 'Ошибка',
  }[status] || status
}

const getStatusMessage = (status) => {
  return {
    pending: 'Запрос ожидает выполнения.',
    processing: 'Выполняется обработка данных.',
    completed: 'Парсинг успешно завершён.',
    failed: 'Парсинг завершился с ошибкой.',
  }[status] || 'Обработка запроса.'
}

const formatDate = (date) => {
  if (!date) {
    return 'Дата не указана'
  }

  return new Date(date).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const formatDateTime = (date) => {
  if (!date) {
    return 'Дата не указана'
  }

  return new Date(date).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

onMounted(loadOrganizations)

onUnmounted(() => {
  statusIntervals.forEach((interval) => {
    clearInterval(interval)
  })

  statusIntervals.clear()
})
</script>

<template>
  <main class="organizations-page">
    <section class="organizations-container">
      <header class="page-header">
        <h1>Yandex Reviews Parser</h1>

        <p>
          Парсинг отзывов организаций из Yandex Maps
        </p>
      </header>

      <section class="parser-card">
        <h2>Добавить организацию</h2>

        <form
          class="parser-form"
          @submit.prevent="startParsing"
        >
          <div class="form-group">
            <label for="organization-url">
              URL организации Yandex Maps
            </label>

            <input
              id="organization-url"
              v-model="url"
              type="url"
              placeholder="https://yandex.ru/maps/..."
            />
          </div>

          <button type="submit">
            Запустить парсинг
          </button>
        </form>

        <p v-if="error" class="error">
          {{ error }}
        </p>
      </section>

      <div class="content-grid">
        <section class="column">
          <div class="section-title">
            <div>
              <h2>Парсинги</h2>

              <p>
                Текущие и завершённые запросы
              </p>
            </div>

            <span>{{ parsingRequests.length }}</span>
          </div>

          <div
            v-if="parsingRequests.length === 0"
            class="state"
          >
            Пока нет запущенных парсингов.
          </div>

          <div v-else class="parsing-list">
            <article
              v-for="parsingRequest in parsingRequests"
              :key="parsingRequest.id"
              class="parsing-card"
            >
              <div class="parsing-card-header">
                <div>
                  <h3>
                    Парсинг #{{ parsingRequest.id }}
                  </h3>

                  <p class="parsing-url">
                    {{ parsingRequest.url }}
                  </p>
                </div>

                <span
                  class="status"
                  :class="getStatusClass(parsingRequest.status)"
                >
                  {{ getStatusLabel(parsingRequest.status) }}
                </span>
              </div>

              <div class="progress-header">
                <span>
                  {{ getStatusMessage(parsingRequest.status) }}
                </span>

                <strong>
                  {{ parsingRequest.progress }}%
                </strong>
              </div>

              <div class="progress-bar">
                <div
                  class="progress-value"
                  :style="{
                    width: `${parsingRequest.progress}%`,
                  }"
                ></div>
              </div>

              <p
                v-if="parsingRequest.status === 'failed'"
                class="error"
              >
                {{
                  parsingRequest.error ||
                  'Парсинг завершился с ошибкой.'
                }}
              </p>

              <button
                v-if="
                  parsingRequest.status === 'completed' &&
                  parsingRequest.organizationId
                "
                class="details-button"
                type="button"
                @click="
                  router.push(
                    `/organizations/${parsingRequest.organizationId}`
                  )
                "
              >
                Открыть организацию
              </button>
            </article>
          </div>
        </section>

        <section class="column">
          <div class="section-title">
            <div>
              <h2>История</h2>

              <p>
                Ранее обработанные организации
              </p>
            </div>

            <span>{{ organizations.length }}</span>
          </div>

          <div
            v-if="loading"
            class="state"
          >
            Загрузка истории...
          </div>

          <div
            v-else-if="organizations.length === 0"
            class="state"
          >
            История пока пуста.
          </div>

          <div
            v-else
            class="organizations-list"
          >
            <article
              v-for="organization in organizations"
              :key="organization.id"
              class="organization-card"
              @click="
                router.push(`/organizations/${organization.id}`)
              "
            >
              <div class="organization-info">
                <div class="organization-title-row">
                  <h3>{{ organization.name }}</h3>

                  <span class="history-date">
                    {{ formatDate(organization.created_at) }}
                  </span>
                </div>

                <p class="url">
                  {{ organization.url }}
                </p>
              </div>

              <div class="organization-stats">
                <div class="stat">
                  <span class="stat-value">
                    {{ organization.rating ?? '—' }}
                  </span>

                  <span class="stat-label">
                    Рейтинг
                  </span>
                </div>

                <div class="stat">
                  <span class="stat-value">
                    {{ organization.ratings_count }}
                  </span>

                  <span class="stat-label">
                    Оценок
                  </span>
                </div>

                <div class="stat">
                  <span class="stat-value">
                    {{ organization.reviews_count }}
                  </span>

                  <span class="stat-label">
                    Отзывов
                  </span>
                </div>
              </div>

              <div class="organization-footer">
                Добавлено {{ formatDateTime(organization.created_at) }}
              </div>
            </article>
          </div>
        </section>
      </div>
    </section>
  </main>
</template>