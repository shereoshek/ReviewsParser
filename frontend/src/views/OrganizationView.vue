<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api/axios'

const route = useRoute()
const router = useRouter()

const organization = ref(null)
const reviews = ref([])

const loading = ref(true)
const reviewsLoading = ref(false)
const error = ref('')

const currentPage = ref(1)
const lastPage = ref(1)
const totalReviews = ref(0)

const loadOrganization = async () => {
  try {
    const response = await api.get(
      `/organizations/${route.params.id}`
    )

    organization.value = response.data.data
  } catch (err) {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      router.push('/login')
      return
    }

    if (err.response?.status === 404) {
      error.value = 'Организация не найдена.'
      return
    }

    error.value = 'Не удалось загрузить организацию.'
  }
}

const loadReviews = async (page = 1) => {
  reviewsLoading.value = true

  try {
    const response = await api.get(
      `/organizations/${route.params.id}/reviews`,
      {
        params: {
          page,
        },
      }
    )

    const data = response.data

    reviews.value = data.data
    currentPage.value = data.current_page
    lastPage.value = data.last_page
    totalReviews.value = data.total
  } catch (err) {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      router.push('/login')
      return
    }

    if (err.response?.status === 404) {
      error.value = 'Организация не найдена.'
      return
    }

    error.value = 'Не удалось загрузить отзывы.'
  } finally {
    reviewsLoading.value = false
  }
}

const changePage = (page) => {
  if (
    page < 1 ||
    page > lastPage.value ||
    page === currentPage.value
  ) {
    return
  }

  loadReviews(page)

  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  })
}

const getPageNumbers = () => {
  const pages = []

  const start = Math.max(1, currentPage.value - 2)
  const end = Math.min(lastPage.value, currentPage.value + 2)

  for (let page = start; page <= end; page++) {
    pages.push(page)
  }

  return pages
}

const formatDate = (date) => {
  if (!date) {
    return 'Дата не указана'
  }

  return new Date(date).toLocaleDateString('ru-RU')
}

onMounted(async () => {
  loading.value = true

  await loadOrganization()

  if (!error.value) {
    await loadReviews()
  }

  loading.value = false
})
</script>

<template>
  <main class="organization-page">
    <section class="organization-container">
      <button
        class="back-button"
        type="button"
        @click="router.push('/organizations')"
      >
        Назад к организациям
      </button>

      <div
        v-if="loading"
        class="state"
      >
        Загрузка организации...
      </div>

      <div
        v-else-if="error"
        class="state error"
      >
        {{ error }}
      </div>

      <template v-else-if="organization">
        <section class="organization-header">
          <div>
            <h1>{{ organization.name }}</h1>

            <p class="organization-url">
              {{ organization.url }}
            </p>
          </div>

          <div class="organization-summary">
            <div class="summary-item">
              <span class="summary-value">
                {{ organization.rating ?? '—' }}
              </span>

              <span class="summary-label">
                Рейтинг
              </span>
            </div>

            <div class="summary-item">
              <span class="summary-value">
                {{ organization.ratings_count }}
              </span>

              <span class="summary-label">
                Оценок
              </span>
            </div>

            <div class="summary-item">
              <span class="summary-value">
                {{ organization.reviews_count }}
              </span>

              <span class="summary-label">
                Отзывов
              </span>
            </div>
          </div>
        </section>

        <section class="reviews-section">
          <div class="section-header">
            <div>
              <h2>Отзывы</h2>

              <p>
                Всего отзывов: {{ totalReviews }}
              </p>
            </div>

            <span class="page-info">
              Страница {{ currentPage }} из {{ lastPage }}
            </span>
          </div>

          <div
            v-if="reviewsLoading"
            class="state"
          >
            Загрузка отзывов...
          </div>

          <div
            v-else-if="reviews.length === 0"
            class="state"
          >
            У этой организации пока нет отзывов.
          </div>

          <div
            v-else
            class="reviews-list"
          >
            <article
              v-for="review in reviews"
              :key="review.id"
              class="review-card"
            >
              <div class="review-header">
                <div>
                  <h3>{{ review.author }}</h3>

                  <time>
                    {{ formatDate(review.published_at) }}
                  </time>
                </div>

                <span class="review-rating">
                  {{ review.rating }} / 5
                </span>
              </div>

              <p class="review-text">
                {{ review.text }}
              </p>
            </article>
          </div>

          <nav
            v-if="lastPage > 1"
            class="pagination"
            aria-label="Пагинация отзывов"
          >
            <button
              type="button"
              :disabled="currentPage === 1"
              @click="changePage(currentPage - 1)"
            >
              Назад
            </button>

            <button
              v-for="page in getPageNumbers()"
              :key="page"
              type="button"
              :class="{
                active: page === currentPage,
              }"
              @click="changePage(page)"
            >
              {{ page }}
            </button>

            <button
              type="button"
              :disabled="currentPage === lastPage"
              @click="changePage(currentPage + 1)"
            >
              Далее
            </button>
          </nav>
        </section>
      </template>
    </section>
  </main>
</template>